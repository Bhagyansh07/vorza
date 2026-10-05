import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


class CommentBase(SQLModel):
    file_path: str = Field(max_length=1024)
    body: str = Field(min_length=1)
    x: float
    y: float


class Comment(CommentBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    repo_id: uuid.UUID = Field(
        foreign_key="repo.id", nullable=False, index=True, ondelete="CASCADE"
    )
    snapshot_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="analysissnapshot.id",
        index=True,
        ondelete="SET NULL",
    )
    author_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, index=True, ondelete="CASCADE"
    )
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class CommentCreate(CommentBase):
    snapshot_id: uuid.UUID | None = None


class CommentPublic(CommentBase):
    id: uuid.UUID
    repo_id: uuid.UUID
    snapshot_id: uuid.UUID | None = None
    author_id: uuid.UUID
    created_at: datetime | None = None


class CommentsPublic(SQLModel):
    data: list[CommentPublic]
    count: int
