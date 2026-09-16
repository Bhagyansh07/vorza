"""initial Vorza tables

Revision ID: 0001
Revises:
Create Date: 2026-09-14

Models (see app/models/):

- user              (User)
- repo              (Repo)
- analysesnapshot   (AnalysisSnapshot, files stored as JSON)
- comment           (Comment)

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("github_username", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("github_id", sa.Integer(), nullable=True),
        sa.Column("github_access_token", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_email"), "user", ["email"], unique=True)
    op.create_index(
        op.f("ix_user_github_username"), "user", ["github_username"], unique=True
    )
    op.create_index(op.f("ix_user_github_id"), "user", ["github_id"], unique=False)

    op.create_table(
        "repo",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("github_full_name", sa.String(length=255), nullable=False),
        sa.Column("default_branch", sa.String(length=255), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "owner_id", "github_full_name", name="uq_repo_owner_and_full_name"
        ),
    )
    op.create_index(op.f("ix_repo_owner_id"), "repo", ["owner_id"], unique=False)

    op.create_table(
        "analysesnapshot",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("overall_health_score", sa.Float(), nullable=False),
        sa.Column("repo_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("files", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["repo_id"], ["repo.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_analysesnapshot_repo_id"),
        "analysesnapshot",
        ["repo_id"],
        unique=False,
    )

    op.create_table(
        "comment",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("file_path", sa.String(length=1024), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("repo_id", sa.Uuid(), nullable=False),
        sa.Column("snapshot_id", sa.Uuid(), nullable=True),
        sa.Column("author_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["user.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["repo_id"], ["repo.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["snapshot_id"], ["analysesnapshot.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_comment_repo_id"), "comment", ["repo_id"], unique=False)
    op.create_index(
        op.f("ix_comment_author_id"), "comment", ["author_id"], unique=False
    )
    op.create_index(
        op.f("ix_comment_snapshot_id"), "comment", ["snapshot_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_comment_snapshot_id"), table_name="comment")
    op.drop_index(op.f("ix_comment_author_id"), table_name="comment")
    op.drop_index(op.f("ix_comment_repo_id"), table_name="comment")
    op.drop_table("comment")
    op.drop_index(op.f("ix_analysesnapshot_repo_id"), table_name="analysesnapshot")
    op.drop_table("analysesnapshot")
    op.drop_index(op.f("ix_repo_owner_id"), table_name="repo")
    op.drop_table("repo")
    op.drop_index(op.f("ix_user_github_id"), table_name="user")
    op.drop_index(op.f("ix_user_github_username"), table_name="user")
    op.drop_index(op.f("ix_user_email"), table_name="user")
    op.drop_table("user")