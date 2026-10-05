from pathlib import Path
from typing import Any

from sqlmodel import Session, create_engine

from app.core.config import settings

engine_kwargs: dict[str, Any] = {"pool_pre_ping": True}
if str(settings.DATABASE_URL).startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

# SQLite needs its parent directory to exist before the file is created;
# SQLAlchemy won't create folders for us people.
if str(settings.DATABASE_URL).startswith("sqlite://"):
    Path(str(settings.DATABASE_URL).replace("sqlite:///", "")).parent.mkdir(
        parents=True, exist_ok=True
    )

engine = create_engine(str(settings.DATABASE_URL), **engine_kwargs)


def init_db(session: Session) -> None:
    """Create the schema without Alembic.

    Production schema changes go through Alembic migrations
    (see app/alembic/ and scripts/prestart.sh). This hook is used by the test
    suite so it can bootstrap a throwaway database quickly.
    """
    from sqlmodel import SQLModel

    SQLModel.metadata.create_all(engine)
    session.commit()
