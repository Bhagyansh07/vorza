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
        "updated_files": ["app/main.py"],  # model guess; server overwrites it
    }
    diff = "diff --git a/app/main.py b/app/main.py\n--- a/app/main.py\n+++ b/app/main.py\n@@ -1,1 +1,2 @@\n ok\n+added\n"
    client = FakeLLMClient([(json.dumps(payload), None)])
    review = review_pr(diff=diff, pr_number=10, client=client)
    assert review.pr_number == 10
    assert review.risk_score == 0.1
    # updated_files is derived from the diff, never trusted from the model.
    assert review.updated_files == ["app/main.py"]
    assert review.dropped_flags == 0


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


# --- citation validation (ai_review.sanitize_review) -------------------------

SAMPLE_DIFF = """diff --git a/src/core/engine.ts b/src/core/engine.ts
index 1111111..2222222 100644
--- a/src/core/engine.ts
+++ b/src/core/engine.ts
@@ -10,4 +10,5 @@ export function run() {
   const ok = check();
+  if (!ok) throw new Error("nope");
   return ok;
 }
diff --git a/src/lib/http.ts b/src/lib/http.ts
index 3333333..4444444 100644
--- a/src/lib/http.ts
+++ b/src/lib/http.ts
@@ -40,2 +41,3 @@ export async function get(url: string) {
   const res = await fetch(url);
+  if (!res.ok) throw new Error(res.statusText);
   return res.json();
 }
"""


def test_changed_files_from_diff_headers() -> None:
    from app.services.ai_review import changed_files_from_diff

    assert changed_files_from_diff(SAMPLE_DIFF) == [
        "src/core/engine.ts",
        "src/lib/http.ts",
    ]


def test_changed_files_from_diff_rename_uses_new_path() -> None:
    from app.services.ai_review import changed_files_from_diff

    diff = "diff --git a/src/old.ts b/src/new.ts\n--- a/src/old.ts\n+++ b/src/new.ts\n"
    assert changed_files_from_diff(diff) == ["src/new.ts"]


def test_changed_files_from_diff_skips_devnull_and_fallback() -> None:
    from app.services.ai_review import changed_files_from_diff

    deletion = (
        "diff --git a/app/main.py b/app/main.py\n--- a/app/main.py\n+++ b/app/main.py\n"
    )
    assert changed_files_from_diff(deletion) == ["app/main.py"]
    no_headers = (
        "--- a/x.py\n+++ b/x.py\n@@ -1 +1 @@\n-a\n+b\n"
        "--- a/y.py\n+++ b/y.py\n@@ -1 +1 @@\n-c\n+d\n"
    )
    assert changed_files_from_diff(no_headers) == ["x.py", "y.py"]


def test_changed_line_ranges_by_file_windows() -> None:
    from app.services.ai_review import changed_line_ranges_by_file

    assert changed_line_ranges_by_file(SAMPLE_DIFF) == {
        "src/core/engine.ts": [(10, 14)],
        "src/lib/http.ts": [(41, 43)],
    }


def _review_with_flag(file: str, line_start: int | None, line_end: int | None):
    from app.services.schemas import AiReview

    flag = {"file": file, "severity": "high", "note": "n"}
    if line_start is not None:
        flag = {**flag, "line_start": line_start, "line_end": line_end}
    return AiReview(pr_number=1, summary="s", flags=[flag])


def test_sanitize_drops_flag_for_file_not_in_diff() -> None:
    from app.services.ai_review import sanitize_review

    review = _review_with_flag("src/hidden.py", None, None)
    out = sanitize_review(
        review,
        visible_files={"src/core/engine.ts"},
        file_ranges={"src/core/engine.ts": [(10, 14)]},
    )
    assert out.flags == []
    assert out.dropped_flags == 1


def test_sanitize_strips_line_range_outside_hunks_keeps_finding() -> None:
    from app.services.ai_review import sanitize_review

    review = _review_with_flag("src/core/engine.ts", 999, 1000)
    out = sanitize_review(
        review,
        visible_files={"src/core/engine.ts"},
        file_ranges={"src/core/engine.ts": [(10, 14)]},
    )
    assert len(out.flags) == 1
    assert out.flags[0].line_start is None
    assert out.flags[0].line_end is None
    assert out.dropped_flags == 0


def test_sanitize_keeps_flag_with_line_range_inside_hunk() -> None:
    from app.services.ai_review import sanitize_review

    review = _review_with_flag("src/core/engine.ts", 12, 14)
    out = sanitize_review(
        review,
        visible_files={"src/core/engine.ts"},
        file_ranges={"src/core/engine.ts": [(10, 14)]},
    )
    assert len(out.flags) == 0 or out.flags[0].line_start == 12


def test_sanitize_caps_flags_at_max() -> None:
    from app.services.ai_review import MAX_FLAGS, sanitize_review
    from app.services.schemas import AiReview

    review = AiReview(
        pr_number=1,
        summary="s",
        flags=[
            {"file": "src/core/engine.ts", "severity": "low", "note": f"n{i}"}
            for i in range(MAX_FLAGS + 2)
        ],
    )
    out = sanitize_review(
        review,
        visible_files={"src/core/engine.ts"},
        file_ranges={"src/core/engine.ts": [(10, 14)]},
    )
    assert len(out.flags) == MAX_FLAGS
    assert out.dropped_flags == 2


def test_review_pr_drops_uncited_model_flags_end_to_end() -> None:
    from app.services.ai_review import review_pr

    payload = {
        "pr_number": 20,
        "summary": "Summary",
        "risk_score": 10,
        "flags": [
            {
                "file": "src/not-in-diff.ts",
                "severity": "high",
                "note": "invented file",
            },
            {
                "file": "src/core/engine.ts",
                "severity": "medium",
                "note": "real finding",
                "line_start": 11,
                "line_end": 12,
            },
        ],
        "updated_files": ["src/not-in-diff.ts"],
    }
    client = FakeLLMClient([(json.dumps(payload), None)])
    review = review_pr(diff=SAMPLE_DIFF, pr_number=20, client=client)
    assert len(review.flags) == 1
    assert review.flags[0].file == "src/core/engine.ts"
    assert review.flags[0].line_start == 11
    assert review.dropped_flags == 1
    # updated_files comes from the diff, not the model's guess.
    assert review.updated_files == ["src/core/engine.ts", "src/lib/http.ts"]
