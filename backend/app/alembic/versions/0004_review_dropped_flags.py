"""add aireviewrow.dropped_flags

Revision ID: 0004
Revises: 0003

Adds a non-null integer column (default 0) to `aireviewrow` recording how many
of the model's findings were dropped by the server-side citation check in
`ai_review.sanitize_review`: flags citing files absent from the (truncated)
diff, and flags beyond the per-review cap. The UI shows this count so a review
can say "N findings dropped" instead of pretending every model sentence is a
verified finding.

Conditional and idempotent, following the pattern of 0002/0003.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

REVIEW_TABLE = "aireviewrow"
COLUMN = "dropped_flags"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns(REVIEW_TABLE)}
    if COLUMN not in columns:
        op.add_column(
            REVIEW_TABLE,
            sa.Column(COLUMN, sa.Integer(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns(REVIEW_TABLE)}
    if COLUMN in columns:
        op.drop_column(REVIEW_TABLE, COLUMN)