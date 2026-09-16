import contextlib
import os
from collections.abc import Generator
from pathlib import Path

# Set env vars BEFORE importing app code so Settings reads them.
os.environ["FASTAPI_ENV"] = "development"
os.environ["PROJECT_NAME"] = "Vorza Test"
os.environ["SECRET_KEY"] = "pytest-secret-key-not-for-production"
os.environ["DATABASE_URL"] = "sqlite:///./vorza_test.db"
os.environ["GITHUB_CLIENT_ID"] = "pytest-client-id"
os.environ["GITHUB_CLIENT_SECRET"] = "pytest-client-secret"
os.environ["GITHUB_WEBHOOK_SECRET"] = "pytest-webhook-secret"

TEST_DB_PATH = Path("vorza_test.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session  # noqa: E402

# Happens after env setup above — do not reorder.
from app.core.db import engine, init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402
from tests.utils.user import create_user  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[Session]:
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    with Session(engine) as session:
        init_db(session)
        yield session
    engine.dispose()
    if TEST_DB_PATH.exists():
        with contextlib.suppress(PermissionError):
            TEST_DB_PATH.unlink()


@pytest.fixture(scope="module")
def client() -> Generator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db_session() -> Generator[Session]:
    with Session(engine) as session:
        yield session


@pytest.fixture
def user(db_session) -> User:
    return create_user(db_session)