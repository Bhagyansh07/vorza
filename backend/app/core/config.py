import warnings
from pathlib import Path
from typing import Literal, Self

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Read backend/.env next to this file's package root.
        env_file=str(Path(__file__).resolve().parents[2] / ".env"),
        env_ignore_empty=True,
        extra="ignore",
    )
    # Route prefix for the API. Kept empty so endpoints match CONTRACTS.md
    # verbatim (e.g. `/repos`, `/me`).
    API_V1_STR: str = ""
    PROJECT_NAME: str = "Vorza"
    SECRET_KEY: str
    # 60 minutes * 24 hours * 8 days = 8 days
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    FRONTEND_HOST: str = "http://localhost:5173"
    FASTAPI_ENV: Literal["development", "production"] | None = None

    # Optional so the free Render/boilerplate tier works without a managed
    # Postgres. Falls back to a local SQLite file next to `data/`. Set
    # DATABASE_URL (postgres://...) in any real deployment.
    DATABASE_URL: str | None = "sqlite:///./data/vorza.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _use_psycopg_driver(cls, value: str | object) -> str:
        database_url = str(value)
        for scheme in ("postgres://", "postgresql://"):
            if database_url.startswith(scheme):
                return database_url.replace(scheme, "postgresql+psycopg://", 1)
        return database_url

    # GitHub OAuth (see CONTRACTS.md Auth section)
    GITHUB_CLIENT_ID: str | None = None
    GITHUB_CLIENT_SECRET: str | None = None
    GITHUB_OAUTH_SCOPES: str = "read:user repo"
    GITHUB_OAUTH_CALLBACK_URL: str = ""  # filled below from FRONTEND_HOST

    # GitHub webhook receiver (POST /webhooks/github).
    #
    # Intentionally NO default. This used to ship a real-looking literal that
    # the `_check_default_secret` guard never rejected (it only denies the exact
    # string "changethis"), so anyone who read the repo could forge a signed
    # webhook and make the app queue PR reviews. Unset now means the receiver is
    # disabled and returns 503, rather than accepting an unverifiable payload.
    # See docs/audit/01-code-audit.md finding C1.
    GITHUB_WEBHOOK_SECRET: str | None = None

    # Redis for the realtime gateway (see backend/app/ws/pubsub.py)
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI PR review (services/ai_review.py). Both optional: without a key the
    # review is skipped with a logged reason instead of raising at import.
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Persistent repo checkouts for analysis (see services/pipeline.py)
    REPO_CHECKOUTS_DIR: str = str(
        Path(__file__).resolve().parents[2] / "data" / "checkouts"
    )

    def _check_default_secret(self, var_name: str, value: str | None) -> None:
        """Refuse a placeholder secret outside development.

        The check is a denylist, which is inherently incomplete: it only catches
        the literal ``"changethis"`` we ship in ``.env.example``. The real
        protection is that no usable default exists to leak -- see
        ``GITHUB_WEBHOOK_SECRET`` below, which is ``None`` rather than a value.
        """
        if value == "changethis":
            message = (
                f'The value of {var_name} is "changethis", '
                "for security, please change it, at least for deployments."
            )
            if self.FASTAPI_ENV == "development":
                warnings.warn(message, stacklevel=1)
            else:
                raise ValueError(message)

    @model_validator(mode="after")
    def _enforce_non_default_secrets(self) -> Self:
        self._check_default_secret("SECRET_KEY", self.SECRET_KEY)
        self._check_default_secret("GITHUB_WEBHOOK_SECRET", self.GITHUB_WEBHOOK_SECRET)
        if self.FASTAPI_ENV == "production" and not self.GITHUB_WEBHOOK_SECRET:
            warnings.warn(
                "GITHUB_WEBHOOK_SECRET is unset: POST /webhooks/github will "
                "return 503. Set it to enable PR reviews.",
                stacklevel=1,
            )
        # Default the OAuth callback to the deployed frontend's /login route
        # (where Login.tsx picks up `code`), so production doesn't redirect to
        # localhost. Set GITHUB_OAUTH_CALLBACK_URL to override explicitly.
        if not self.GITHUB_OAUTH_CALLBACK_URL:
            self.GITHUB_OAUTH_CALLBACK_URL = f"{self.FRONTEND_HOST.rstrip('/')}/login"
        return self


settings = Settings()  # type: ignore # ty: ignore[unused-ignore-comment]
