"""LLM-powered PR review pipeline.

Flow:
  1. Truncate the diff so we never blow context windows or budgets.
  2. Ask the LLM (injected client) for one JSON object.
  3. Validate against the CONTRACTS.md "AI review output shape" (Pydantic).
  4. On malformed output, retry ONCE with a remediation hint, then fail loudly
     — never save garbage silently.
  5. Log token usage + cost of every call, visible while developing.

The LLM provider is injected behind the LLMClient protocol so unit tests run
with a fake client (zero network, zero API keys). The shipped OpenAI adapter
lazy-imports the `openai` package so the rest of the pipeline works without it
installed.
"""

from __future__ import annotations

import json
import logging
import os
import re
from collections import deque
from dataclasses import dataclass, field
from typing import Protocol

from pydantic import ValidationError

from . import prompts
from .schemas import AiReview

logger = logging.getLogger(__name__)

DEFAULT_MAX_DIFF_CHARS = 120_000
MAX_RETRIES = 1
DEFAULT_MODEL = "gpt-4o-mini"

MODEL_PRICES_USD_PER_1M = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "o3-mini": (1.10, 4.40),
}


class LLMError(Exception):
    """The LLM provider call itself failed (network, auth, rate limit)."""


class AiReviewError(Exception):
    """The LLM returned content that could not be validated, even after retry."""


@dataclass
class LlmUsage:
    model: str
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def cost_usd(self) -> float:
        input_price, output_price = MODEL_PRICES_USD_PER_1M.get(self.model, (0.0, 0.0))
        return (self.input_tokens / 1_000_000) * input_price + (self.output_tokens / 1_000_000) * output_price


class LLMClient(Protocol):
    """Anything that can turn a system/user prompt pair into a JSON string."""

    def chat_json(self, *, system: str, user: str) -> tuple[str, LlmUsage]:
        """Return (raw assistant text, usage). Raise LLMError on failure."""


class OpenAIReviewClient:
    """OpenAI adapter using JSON mode (structured output, not string parsing)."""

    def __init__(self, *, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
        self._client = None

    def _connect(self):
        if self._client is None:
            if not self.api_key:
                raise LLMError("OPENAI_API_KEY is not set")
            import openai  # lazy: tests and non-LLM paths don't need it installed

            self._client = openai.OpenAI(api_key=self.api_key)
        return self._client

    def chat_json(self, *, system: str, user: str) -> tuple[str, LlmUsage]:
        client = self._connect()
        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format={"type": "json_object"},
            )
        except Exception as exc:  # openai.APIError, APIConnectionError, auth, ...
            raise LLMError(f"OpenAI call failed: {exc}") from exc
        content = response.choices[0].message.content or ""
        if not content:
            raise LLMError("OpenAI returned an empty response")
        usage = response.usage
        return content, LlmUsage(
            model=self.model,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
        )


def truncate_diff(diff: str, max_chars: int = DEFAULT_MAX_DIFF_CHARS) -> str:
    """Keep head+tail of an oversized diff so context/budget stay capped."""
    if len(diff) <= max_chars:
        return diff
    half = max_chars // 2
    marker = f"\n\n... [diff truncated at {len(diff)} chars, showing {max_chars}] ...\n\n"
    return diff[:half] + marker + diff[-half:]


def parse_review_json(raw: str) -> dict:
    """Parse the LLM's JSON, tolerating markdown fences and stray prose."""
    text = raw.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
        raise


_cost_log: deque[dict] = deque(maxlen=500)

def _cost_log_path() -> str | None:
    return os.getenv("CODATLAS_COST_LOG")


def record_usage(usage: LlmUsage) -> None:
    """Record a call's tokens + cost. Visible via get_cost_log() and appended
    to a file if CODATLAS_COST_LOG env var points at one (dev convenience)."""
    entry = {
        "model": usage.model,
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "total_tokens": usage.input_tokens + usage.output_tokens,
        "cost_usd": round(usage.cost_usd, 6),
    }
    _cost_log.append(entry)
    path = _cost_log_path()
    if path:
        try:
            with open(path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry) + "\n")
        except OSError as exc:
            logger.warning("could not write cost log to %s: %s", path, exc)
    logger.info("LLM call: %s", entry)


def get_cost_log() -> list[dict]:
    return list(_cost_log)


def review_pr(diff: str, pr_number: int, client: LLMClient) -> AiReview:
    """Review a PR diff and return a validated AiReview.

    Raises AiReviewError loudly (after a single retry) if the LLM output can't
    be validated, so garbage is never persisted downstream.
    """
    snippet = truncate_diff(diff)
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        if attempt == 0:
            user_prompt = prompts.build_user_review_prompt(pr_number=pr_number, diff=snippet)
        else:
            user_prompt = prompts.build_retry_review_prompt(pr_number=pr_number, diff=snippet)
        try:
            content, usage = client.chat_json(system=prompts.SYSTEM_REVIEW_PROMPT, user=user_prompt)
        except LLMError as exc:
            raise AiReviewError(f"LLM call failed: {exc}") from exc
        record_usage(usage)
        try:
            payload = parse_review_json(content)
            review = AiReview.model_validate(payload)
            if review.pr_number != pr_number:
                review.pr_number = pr_number
            return review
        except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
            last_error = exc
            logger.warning("review attempt %d failed validation: %s", attempt + 1, last_error)
    raise AiReviewError(f"AiReview failed after {MAX_RETRIES + 1} attempts; last error: {last_error}")