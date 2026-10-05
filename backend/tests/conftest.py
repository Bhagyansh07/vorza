import contextlib
import os
import shutil
import tempfile
from collections.abc import Generator
from pathlib import Path

# A per-session temp directory, not a file in the repo.
#
# The suite used a fixed ./vorza_test.db and unlinked it at session start. On
# Windows that fails with WinError 32 whenever anything still holds a handle --
# a previous crashed run, an editor preview, or antivirus -- which turned every
# run into 30 setup errors. A unique directory per session removes the shared
# handle entirely and keeps the repo clean.
_TMP_DIR = Path(tempfile.mkdtemp(prefix="vorza-test-"))

# Set env vars BEFORE importing app code so Settings reads them.
os.environ["FASTAPI_ENV"] = "development"
os.environ["PROJECT_NAME"] = "Vorza Test"
os.environ["SECRET_KEY"] = "pytest-secret-key-not-for-production"
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP_DIR / 'test.db').as_posix()}"
os.environ["GITHUB_CLIENT_ID"] = "pytest-client-id"
os.environ["GITHUB_CLIENT_SECRET"] = "pytest-client-secret"
os.environ["GITHUB_WEBHOOK_SECRET"] = "pytest-webhook-secret"

TEST_DB_PATH = _TMP_DIR / "test.db"

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
    with Session(engine) as session:
        init_db(session)
        yield session
    engine.dispose()
    # Best effort: the engine may still hold a handle on Windows.
    with contextlib.suppress(OSError):
        shutil.rmtree(_TMP_DIR, ignore_errors=True)


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
