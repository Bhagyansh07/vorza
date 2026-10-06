"""Tests for LLM-powered PR review service."""

from __future__ import annotations

import json

from app.services.ai_review import (
    AiReviewError,
    LLMError,
    LlmUsage,
    get_cost_log,
    parse_review_json,
    record_usage,
    review_pr,
    truncate_diff,
)


class FakeLLMClient:
    def __init__(self, responses: list[tuple[str, LlmUsage | None]]) -> None:
        self._responses = responses
        self.calls = 0

    def chat_json(self, system: str, user: str) -> tuple[str, LlmUsage]:
        if self.calls >= len(self._responses):
            raise LLMError("out of fake responses")
        content, usage = self._responses[self.calls]
        self.calls += 1
        if usage is None:
            usage = LlmUsage(model="gpt-4o-mini", input_tokens=1, output_tokens=1)
        return content, usage


def test_truncate_diff_short_is_unchanged() -> None:
    diff = "a" * 100
    assert truncate_diff(diff) == diff


def test_truncate_diff_truncates_and_marks_ellipsis() -> None:
    diff = "x" * 2000
    result = truncate_diff(diff, max_chars=100)
    assert len(diff) > len(result)


def test_truncate_diff_empty_is_kept_empty() -> None:
    assert truncate_diff("") == ""


def test_parse_review_json_clean() -> None:
    payload = {
        "pr_number": 5,
        "summary": "ok",
        "risk_score": 0.1,
        "flags": [],
        "updated_files": [],
    }
    text = json.dumps(payload)
    assert parse_review_json(text) == payload


def test_parse_review_json_with_markdown_fences() -> None:
    payload = {
        "pr_number": 1,
        "summary": "s",
        "risk_score": 0.2,
        "flags": [],
        "updated_files": [],
    }
    text = f"```json\n{json.dumps(payload)}\n```"
    assert parse_review_json(text) == payload


def test_parse_review_json_with_leading_prose() -> None:
    payload = {
        "pr_number": 2,
        "summary": "s",
        "risk_score": 0.3,
        "flags": [],
        "updated_files": [],
    }
    text = f"Here is the answer: {json.dumps(payload)} and more."
    assert parse_review_json(text) == payload


def test_record_usage_adds_to_log_and_rounds(monkeypatch) -> None:
    from app.services import ai_review

    ai_review._cost_log.clear()
    record_usage(LlmUsage(model="gpt-4o-mini", input_tokens=10, output_tokens=5))
    log = get_cost_log()
    assert len(log) == 1
    assert log[0]["total_tokens"] == 15


def test_review_pr_happy_path() -> None:
    payload = {
        "pr_number": 10,
        "summary": "Looks good",
        "risk_score": 0.1,
        "flags": [],
        "updated_files": ["app/main.py"],
    }
    client = FakeLLMClient([(json.dumps(payload), None)])
    review = review_pr(diff="diff", pr_number=10, client=client)
    assert review.pr_number == 10
    assert review.risk_score == 0.1
    assert review.updated_files[0] == "app/main.py"


def test_review_pr_retries_once_on_bad_json() -> None:
    bad = "not json"
    payload = {
        "pr_number": 7,
        "summary": "fixed",
        "risk_score": 0.05,
        "flags": [],
        "updated_files": [],
    }
    client = FakeLLMClient([(bad, None), (json.dumps(payload), None)])
    review = review_pr(diff="d", pr_number=7, client=client)
    assert review.risk_score == 0.05
    assert client.calls == 2


def test_review_pr_raises_after_max_attempts() -> None:
    client = FakeLLMClient([("bad", None), ("still bad", None)])
    try:
        review_pr(diff="d", pr_number=3, client=client)
    except AiReviewError as exc:
        msg = str(exc)
        assert "failed after" in msg
        return
    raise AssertionError("expected AiReviewError")


def test_review_pr_raises_on_llm_error() -> None:
    class FailingClient:
        def chat_json(self, system: str, user: str) -> tuple[str, LlmUsage]:
            raise LLMError("network down")

    try:
        review_pr(diff="d", pr_number=4, client=FailingClient())
    except AiReviewError as exc:
        assert "LLM call failed" in str(exc)
        return
    raise AssertionError("expected AiReviewError")
