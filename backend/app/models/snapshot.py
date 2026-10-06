import uuid
from datetime import datetime
from typing import Any

from pydantic import Field as PydanticField
from sqlalchemy import JSON, Column, DateTime
from sqlmodel import Field, SQLModel

from app.models.user import get_datetime_utc


class FileNode(SQLModel):
    """One node of the force-directed map.

    Stored embedded (as JSON) inside each AnalysisSnapshot, not as its own
    table. Paths in `imports` reference other FileNode paths in the same
    snapshot.
    """

    path: str
    loc: int = PydanticField(default=0, ge=0)
    complexity_score: float = PydanticField(default=0.0, ge=0.0, le=100.0)
    churn_score: float = PydanticField(default=0.0, ge=0.0, le=100.0)
    health_score: float = PydanticField(default=0.0, ge=0.0, le=100.0)
    imports: list[str] = PydanticField(default_factory=list)


class AnalysisSnapshotBase(SQLModel):
    overall_health_score: float = Field(default=0.0, ge=0.0, le=100.0)


class AnalysisSnapshot(AnalysisSnapshotBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    repo_id: uuid.UUID = Field(
        foreign_key="repo.id", nullable=False, index=True, ondelete="CASCADE"
    )
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )
    # Stored as plain dicts (FileNode.dict / model_dump()); the API boundary
    # (AnalysisSnapshotPublic.files: list[FileNode]) coerces them back to
    # FileNode on the way out. The type is dicts here because the JSON column
    # serializes with json.dumps and pydantic models are not JSON serializable.
    files: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))


class AnalysisSnapshotPublic(AnalysisSnapshotBase):
    id: uuid.UUID
    repo_id: uuid.UUID
    created_at: datetime | None = None
    files: list[FileNode]


class SnapshotSummary(SQLModel):
    """Lightweight shape for trend charts (see CONTRACTS.md)."""

    id: uuid.UUID
    repo_id: uuid.UUID
    created_at: datetime | None = None
    overall_health_score: float


class SnapshotsList(SQLModel):
    data: list[SnapshotSummary]
    count: int


class AiReviewRow(SQLModel, table=True):
    """Persisted AI review for a pull request."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    repo_id: uuid.UUID = Field(
        foreign_key="repo.id", nullable=False, index=True, ondelete="CASCADE"
    )
    pr_number: int = Field(nullable=False)
    risk_score: float = Field(default=0.0, ge=0.0, le=100.0)
    summary: str = Field(default="", max_length=4096)
    flags: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    updated_files: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )
