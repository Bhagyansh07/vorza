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
from dataclasses import dataclass
from typing import Any, Protocol

from openai import OpenAI
from pydantic import ValidationError

from app.core.config import settings

from . import prompts
from .schemas import AiReview, ReviewFlag

logger = logging.getLogger(__name__)

DEFAULT_MAX_DIFF_CHARS = 120_000
MAX_RETRIES = 1
DEFAULT_MODEL = "gpt-4o-mini"

MODEL_PRICES_USD_PER_1M: dict[str, tuple[float, float]] = {
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
        return (self.input_tokens / 1_000_000) * input_price + (
            self.output_tokens / 1_000_000
        ) * output_price


class LLMClient(Protocol):
    """Anything that can turn a system/user prompt pair into a JSON string."""

    def chat_json(self, *, system: str, user: str) -> tuple[str, LlmUsage]:
        """Return (raw assistant text, usage). Raise LLMError on failure."""


class OpenAIReviewClient:
    """OpenAI adapter using JSON mode (structured output, not string parsing)."""

    def __init__(self, *, api_key: str | None = None, model: str | None = None) -> None:
        # Settings first, env second. Reading the raw environment here meant the
        # key was invisible to `Settings`, to `.env.example`, and to any test
        # that patched the config object.
        self.api_key = api_key or settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
        self.model = (
            model or settings.OPENAI_MODEL or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
        )
        self._client: OpenAI | None = None

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def _connect(self) -> OpenAI:
        if self._client is None:
            if not self.api_key:
                raise LLMError("OPENAI_API_KEY is not set")
            # base_url lets any OpenAI-compatible endpoint stand in for the
            # OpenAI API (Groq, GitHub Models, OpenRouter, ...), so a free or
            # self-hosted provider works with no code change -- see
            # settings.OPENAI_BASE_URL.
            self._client = OpenAI(
                api_key=self.api_key, base_url=settings.OPENAI_BASE_URL or None
            )
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
    marker = (
        f"\n\n... [diff truncated at {len(diff)} chars, showing {max_chars}] ...\n\n"
    )
    return diff[:half] + marker + diff[-half:]


def parse_review_json(raw: str) -> dict[str, Any]:
    """Parse the LLM's JSON, tolerating markdown fences and stray prose."""
    text = raw.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    try:
        parsed: dict[str, Any] = json.loads(text)
        return parsed
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            try:
                salvaged: dict[str, Any] = json.loads(text[start : end + 1])
                return salvaged
            except json.JSONDecodeError:
                pass
        raise


DIFF_HEADER_RE = re.compile(r"^diff --git a/(.+?) b/(.+?)$")
DIFF_HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
MAX_FLAGS = 15


def changed_files_from_diff(diff: str) -> list[str]:
    """Extract the new-side file paths from ``diff --git a/X b/Y`` headers.

    Renames carry both paths; the new path is what a reviewer's citation refers
    to. Synthetic paths (``/dev/null`` for deletions) are skipped and
    duplicates are dropped, preserving first-seen order. Falls back to ``+++
    b/...`` lines when a diff omits ``diff --git`` headers entirely (some
    providers strip them).
    """
    paths: list[str] = []
    seen: set[str] = set()
    for line in diff.splitlines():
        match = DIFF_HEADER_RE.match(line)
        if match:
            path = match.group(2)
            if path != "/dev/null" and path not in seen:
                seen.add(path)
                paths.append(path)
    if paths:
        return paths
    for line in diff.splitlines():
        if not line.startswith("+++ b/"):
            continue
        path = line[len("+++ b/") :]
        if path != "/dev/null" and path not in seen:
            seen.add(path)
            paths.append(path)
    return paths


def changed_line_ranges_by_file(diff: str) -> dict[str, list[tuple[int, int]]]:
    """Map each changed file to the inclusive new-file line windows its hunks
    span (``@@ -a,b +c,d @@`` → ``(c, c + d - 1)``).

    Context lines inside a hunk count: a citation may legitimately point at a
    nearby line the hunk makes visible. Files touched only by a rename have no
    hunks and therefore no ranges.
    """
    current: str | None = None
    ranges: dict[str, list[tuple[int, int]]] = {}
    for line in diff.splitlines():
        match = DIFF_HEADER_RE.match(line)
        if match:
            current = match.group(2)
            ranges.setdefault(current, [])
            continue
        if current is None:
            continue
        hunk = DIFF_HUNK_RE.match(line)
        if hunk:
            start = int(hunk.group(1))
            length = int(hunk.group(2) or 1)
            ranges[current].append((start, start + length - 1))
    return ranges


def _overlaps(line_start: int, line_end: int, windows: list[tuple[int, int]]) -> bool:
    return any(a <= line_end and line_start <= b for a, b in windows)


def sanitize_review(
    review: AiReview,
    *,
    visible_files: set[str],
    file_ranges: dict[str, list[tuple[int, int]]],
    max_flags: int = MAX_FLAGS,
) -> AiReview:
    """Drop uncited findings and strip impossible line numbers.

    The model can still invent a ``file`` or a ``line``; nothing in the prompt
    can prevent that, so the server enforces it (CONTRACTS.md "AI review output
    shape"):

    - a flag whose ``file`` is not among ``visible_files`` (the files the
      truncated diff the reviewer actually saw contains) is **dropped**;
    - a ``line_start``/``line_end`` pair that does not fall inside a changed
      hunk visible in the diff is **stripped** (the finding survives, but no
      invented line number does);
    - the flag list is capped at ``max_flags``; the overflow is dropped.

    ``review.dropped_flags`` is set to the total dropped so the UI can honestly
    say "N findings dropped", and ``review.updated_files`` is NOT trusted from
    the model here -- callers overwrite it with the server-derived diff set.
    """
    kept: list[ReviewFlag] = []
    dropped = 0
    for flag in review.flags:
        if flag.file not in visible_files:
            dropped += 1
            continue
        if flag.line_start is not None and flag.line_end is not None:
            if not _overlaps(
                flag.line_start, flag.line_end, file_ranges.get(flag.file, [])
            ):
                flag.line_start = None
                flag.line_end = None
        kept.append(flag)
    if len(kept) > max_flags:
        dropped += len(kept) - max_flags
        kept = kept[:max_flags]
    review.flags = kept
    review.dropped_flags = dropped
    return review


_cost_log: deque[dict[str, Any]] = deque(maxlen=500)


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


def get_cost_log() -> list[dict[str, Any]]:
    return list(_cost_log)


def review_pr(diff: str, pr_number: int, client: LLMClient) -> AiReview:
    """Review a PR diff and return a validated AiReview.

    Raises AiReviewError loudly (after a single retry) if the LLM output can't
    be validated, so garbage is never persisted downstream.
    """
    snippet = truncate_diff(diff)
    # Truth the reviewer actually saw: the SANITIZED flag set may only cite
    # files whose hunks were visible in the (possibly truncated) diff.
    visible_files = set(changed_files_from_diff(snippet))
    file_ranges = changed_line_ranges_by_file(snippet)
    # Truth about the PR itself, used for `updated_files` below: the full diff,
    # even when hunks were truncated away.
    all_changed = changed_files_from_diff(diff)
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        if attempt == 0:
            user_prompt = prompts.build_user_review_prompt(
                pr_number=pr_number, diff=snippet
            )
        else:
            user_prompt = prompts.build_retry_review_prompt(
                pr_number=pr_number, diff=snippet
            )
        try:
            content, usage = client.chat_json(
                system=prompts.SYSTEM_REVIEW_PROMPT, user=user_prompt
            )
        except LLMError as exc:
            raise AiReviewError(f"LLM call failed: {exc}") from exc
        record_usage(usage)
        try:
            payload = parse_review_json(content)
            review = AiReview.model_validate(payload)
            if review.pr_number != pr_number:
                review.pr_number = pr_number
            # The diff is the source of truth for both sets; the model's own
            # updated_files is never trusted (CONTRACTS.md AI review shape).
            sanitize_review(
                review, visible_files=visible_files, file_ranges=file_ranges
            )
            review.updated_files = all_changed
            return review
        except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
            last_error = exc
            logger.warning(
                "review attempt %d failed validation: %s", attempt + 1, last_error
            )
    raise AiReviewError(
        f"AiReview failed after {MAX_RETRIES + 1} attempts; last error: {last_error}"
    )
