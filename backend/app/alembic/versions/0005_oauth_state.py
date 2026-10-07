"""add the oauth state store

Revision ID: 0005
Revises: 0004

``OauthState`` backs the "single-use, time-boxed GitHub OAuth state" change in
``app/services/github.py``. Before this, ``state`` was a bare HMAC-signed nonce
with no timestamp and nothing recorded that a state was already spent, so a
captured ``state`` verified forever and could be reused. The new ``oauthstate``
table records each issued nonce with an expiry so the callback can spend a
state atomically (delete + rowcount) and the store can purge expired rows.

Nothing here is made conditional: the table simply did not exist before this
revision, and a stray ``create_all`` has never created it because the model is
new in this same change.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

TABLE = "oauthstate"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("nonce", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("nonce"),
    )
    op.create_index(
        op.f("ix_oauthstate_expires_at"), TABLE, ["expires_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_oauthstate_expires_at"), table_name=TABLE)
    op.drop_table(TABLE)