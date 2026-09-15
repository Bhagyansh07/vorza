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

    DATABASE_URL: str

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
    GITHUB_OAUTH_CALLBACK_URL: str = "http://localhost:5173/auth/callback"

    # GitHub webhook receiver (POST /webhooks/github)
    GITHUB_WEBHOOK_SECRET: str = "changethis"

    # Redis for the realtime gateway (see backend/app/ws/pubsub.py)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Persistent repo checkouts for analysis (see services/pipeline.py)
    REPO_CHECKOUTS_DIR: str = str(
        Path(__file__).resolve().parents[2] / "data" / "checkouts"
    )

    def _check_default_secret(self, var_name: str, value: str | None) -> None:
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
        self._check_default_secret(
            "GITHUB_WEBHOOK_SECRET", self.GITHUB_WEBHOOK_SECRET
        )
        return self


settings = Settings()  # type: ignore # ty: ignore[unused-ignore-comment]
