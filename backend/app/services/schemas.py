from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    files: list[FileNode] = Field(default_factory=list)
    overall_health_score: float = 100.0


class ReviewFlag(BaseModel):
    file: str
    severity: Severity
    note: str


class AiReview(BaseModel):
    pr_number: int
    risk_score: float = 0.0
    summary: str
    flags: list[ReviewFlag] = Field(default_factory=list)
    updated_files: list[str] = Field(default_factory=list)

    @field_validator("risk_score")
    @classmethod
    def _clamp_risk_score(cls, value: float) -> float:
        return min(max(float(value), 0.0), 100.0)