from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field, ValidationInfo, field_validator

Severity = Literal["low", "medium", "high"]


class FileNode(BaseModel):
    path: str
    loc: int = 0
    complexity_score: float = 0.0
    churn_score: float = 0.0
    health_score: float = 100.0
    imports: list[str] = Field(default_factory=list)


class AnalysisSnapshot(BaseModel):
    id: str | None = None
    repo_id: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    files: list[FileNode] = Field(default_factory=list)
    overall_health_score: float = 100.0


class ReviewFlag(BaseModel):
    file: str
    severity: Severity
    note: str
    # Optional, both-or-neither, and validated against the diff's hunks by
    # sanitize_review (ai_review.py) before persistence: a line range that does
    # not fall inside a changed hunk is stripped so the UI never shows
    # invented line numbers.
    line_start: int | None = Field(default=None, ge=1)
    line_end: int | None = Field(default=None, ge=1)

    @field_validator("line_end")
    @classmethod
    def _line_end_gte_start(cls, value: int | None, info: ValidationInfo) -> int | None:
        if value is None:
            return value
        start = info.data.get("line_start")
        if start is not None and value < start:
            raise ValueError("line_end must be >= line_start")
        return value


class AiReview(BaseModel):
    pr_number: int
    risk_score: float = 0.0
    summary: str
    flags: list[ReviewFlag] = Field(default_factory=list)
    updated_files: list[str] = Field(default_factory=list)
    # Server-computed: number of flags dropped because they cited a file that
    # is not in the diff, or because the flag list exceeded the cap. The model
    # never sets this; review_pr() overwrites it after sanitizing.
    dropped_flags: int = Field(default=0, ge=0)

    @field_validator("risk_score")
    @classmethod
    def _clamp_risk_score(cls, value: float) -> float:
        return min(max(float(value), 0.0), 100.0)

    @property
    def kept_flags(self) -> int:
        return len(self.flags)
