"""align the snapshot table name and add the AI review table

Revision ID: 0002
Revises: 0001

Two defects in ``0001_initial``, both found by diffing what ``alembic upgrade
head`` actually produces against ``SQLModel.metadata.create_all`` rather than by
reading the migration:

1. **Wrong table name.** ``0001`` creates ``analysesnapshot`` (single ``s``).
   SQLModel derives the table name from the class name ``AnalysisSnapshot`` and
   produces ``analysissnapshot``. So on any database created by a migration, the
   application queried a table that did not exist -- ``no such table:
   analysissnapshot`` on every snapshot read. This never showed up in
   production because the app lifespan also calls ``create_all``, which creates
   the model-named table and masks it. It would have broken the moment the
   deployment moved to a managed database that only runs migrations.

2. **Missing table.** ``AiReviewRow`` (``aireviewrow``) was never migrated at
   all. The PR-review webhook persists through it, so on a migrated database
   every review insert failed.

Both are handled conditionally, so this revision is correct whether it runs on a
fresh database (where ``0001`` created the old name) or on one that a stray
``create_all`` had already put into the right shape.

Renaming rather than dropping and recreating keeps any existing snapshot rows.
Postgres rewrites foreign-key references when a table is renamed, so
``comment.snapshot_id`` follows ``analysesnapshot`` -> ``analysissnapshot``
without being touched here.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

OLD_SNAPSHOT_TABLE = "analysesnapshot"
SNAPSHOT_TABLE = "analysissnapshot"
REVIEW_TABLE = "aireviewrow"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if OLD_SNAPSHOT_TABLE in existing and SNAPSHOT_TABLE not in existing:
        op.rename_table(OLD_SNAPSHOT_TABLE, SNAPSHOT_TABLE)
    elif OLD_SNAPSHOT_TABLE in existing and SNAPSHOT_TABLE in existing:
        # A database that create_all already fixed up. The migration's table is
        # the stale, empty one, so the rename target is what the app reads.
        op.drop_table(OLD_SNAPSHOT_TABLE)

    if REVIEW_TABLE not in set(sa.inspect(bind).get_table_names()):
        op.create_table(
            REVIEW_TABLE,
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("repo_id", sa.Uuid(), nullable=False),
            sa.Column("pr_number", sa.Integer(), nullable=False),
            sa.Column("risk_score", sa.Float(), nullable=False),
            sa.Column("summary", sa.String(length=4096), nullable=False),
            sa.Column("flags", sa.JSON(), nullable=True),
            sa.Column("updated_files", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["repo_id"], ["repo.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            op.f("ix_aireviewrow_repo_id"), REVIEW_TABLE, ["repo_id"], unique=False
        )


def downgrade() -> None:
    bind = op.get_bind()
    if REVIEW_TABLE in set(sa.inspect(bind).get_table_names()):
        op.drop_index(op.f("ix_aireviewrow_repo_id"), table_name=REVIEW_TABLE)
        op.drop_table(REVIEW_TABLE)

    if SNAPSHOT_TABLE in set(sa.inspect(bind).get_table_names()):
        op.rename_table(SNAPSHOT_TABLE, OLD_SNAPSHOT_TABLE)