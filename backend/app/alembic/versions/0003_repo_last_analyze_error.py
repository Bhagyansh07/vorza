"""add repo.last_analyze_error

Revision ID: 0003
Revises: 0002

Adds a nullable text column to `repo` that records why the most recent analysis
attempt failed. The orchestrator writes it on failure and clears it on success;
RepoPublic exposes it so the frontend can surface the reason instead of sitting
on "no snapshot yet" indefinitely.

Conditional and idempotent, following the pattern of 0002: on a database that a
stray `create_all` already put into shape, the column is simply skipped.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

REPO_TABLE = "repo"
COLUMN = "last_analyze_error"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns(REPO_TABLE)}
    if COLUMN not in columns:
        op.add_column(
            REPO_TABLE,
            sa.Column(COLUMN, sa.String(length=1000), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns(REPO_TABLE)}
    if COLUMN in columns:
        op.drop_column(REPO_TABLE, COLUMN)