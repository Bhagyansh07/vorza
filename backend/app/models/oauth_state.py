"""Single-use, expiring GitHub OAuth anti-CSRF nonces."""

from datetime import datetime

from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel


class OauthState(SQLModel, table=True):
    """One issued ``state`` token for GitHub's OAuth redirect.

    ``app.services.github.build_authorize_url`` inserts a row for every issued
    state and the callback spends it with an atomic delete-then-rowcount check,
    so the same ``state`` can never mint two sessions. ``expires_at`` bounds how
    long an unspent state stays valid, and the store self-cleans by deleting
    expired rows on the next issuance ("TTL cache" semantics).
    """

    nonce: str = Field(primary_key=True)
    expires_at: datetime = Field(sa_type=DateTime(timezone=True), index=True)
