import re
import uuid
from datetime import datetime

from pydantic import field_validator
from sqlalchemy import DateTime, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.user import get_datetime_utc

GITHUB_FULL_NAME_RE = re.compile(r"^[\w.-]+/[\w.-]+$")


def _validate_full_name(value: str) -> str:
    if not GITHUB_FULL_NAME_RE.match(value):
        raise ValueError("must match owner/repo")
    return value


class RepoBase(SQLModel):
    github_full_name: str = Field(max_length=255)
    default_branch: str = Field(default="main", max_length=255)
    # Set when the most recent analysis attempt failed, cleared on the next
    # success. Exposed on RepoPublic so the UI can say *why* the map is missing
    # instead of sitting on "no snapshot yet" forever.
    last_analyze_error: str | None = Field(default=None, max_length=1000)

    @field_validator("github_full_name")
    @classmethod
    def _full_name(cls, value: str) -> str:
        return _validate_full_name(value)


class Repo(RepoBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, index=True, ondelete="CASCADE"
    )
    connected_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )
    # Cascades are enforced at the DB level (ondelete="CASCADE" / "SET NULL"),
    # so no ORM relationships are required between models.

    __table_args__ = (
        UniqueConstraint(
            "owner_id", "github_full_name", name="uq_repo_owner_and_full_name"
        ),
    )


class RepoCreate(SQLModel):
    github_full_name: str = Field(min_length=1, max_length=255)

    @field_validator("github_full_name")
    @classmethod
    def _full_name(cls, value: str) -> str:
        return _validate_full_name(value)


class RepoPublic(RepoBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    connected_at: datetime | None = None


class ReposPublic(SQLModel):
    data: list[RepoPublic]
    count: int


class GitHubRepoLite(SQLModel):
    """One entry of the `GET /github/repos` connect picker.

    A deliberately small projection of GitHub's `/user/repos` payload: enough
    for the UI to list, search and connect a repo, nothing that Vorza does not
    need. `updated_at` stays a raw ISO string; the UI formats it.
    """

    full_name: str
    private: bool = False
    default_branch: str = "main"
    description: str | None = None
    language: str | None = None
    updated_at: str | None = None
