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
    # Bump on every deploy that changes the runtime behaviour. Surfaced via
    # `/openapi.json` (info.version) so an operator can confirm which build is
    # live without dashboard access.
    APP_VERSION: str = "2026.10.06.7"
    SECRET_KEY: str
    # 60 minutes * 24 hours * 8 days = 8 days
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    FRONTEND_HOST: str = "http://localhost:5173"
    # Browser origins allowed to call the API in addition to FRONTEND_HOST.
    # GitHub OAuth starts with the login grant fetch from the browser, so any
    # origin that serves the app must be here or "Continue with GitHub" fails
    # with a CORS-blocked request before the user ever reaches GitHub.
    # Comma-separated; keep in sync with docs/DESIGN_SYSTEM.md.
    CORS_ORIGINS: str = (
        "https://vorza-app.vercel.app,"
        "https://getvorza.vercel.app,"
        "https://vorza-sigma.vercel.app,"
        "https://vorza-bhagyansh.vercel.app"
    )
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

    # The scope string sent in the authorize URL.
    #
    # Previously dead config: declared here, documented in .env.example and
    # compose files, but the code hardcoded "read:user repo". Now it is read.
    #
    # Why `repo` and not something smaller: `repo` is read AND write across all
    # public and private repositories. GitHub offers no read-only scope that can
    # clone a repository. For an OAuth app this is the narrowest scope that can
    # do the job; the consent copy names it and states what it grants.
    # Fine-grained read-only permissions exist for GitHub Apps (tracked as F14).
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

    # Redis for the realtime gateway (see backend/app/ws/pubsub.py). Empty
    # means "no Redis" and the app uses the in-process hub, which is correct
    # for a single-instance deployment (Render free has no managed Redis and
    # the blueprint sets no REDIS_URL). Set it to use cross-instance pub/sub.
    REDIS_URL: str = ""

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
