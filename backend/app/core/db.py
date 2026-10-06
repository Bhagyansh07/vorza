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


# SQLite does not enforce foreign keys unless the connection opts in. The
# models rely on ON DELETE CASCADE at the DB level (see models/repo.py), so a
# local/dev database must behave like the managed Postgres: turn the pragma on
# per connection, or `session.delete(repo)` would orphan its snapshots here
# while cascading fine in production.
if str(settings.DATABASE_URL).startswith("sqlite"):
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(
        dbapi_connection: Any, _connection_record: Any
    ) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def init_db(session: Session) -> None:
    """Create the schema without Alembic.

    Production schema changes go through Alembic migrations
    (see app/alembic/ and scripts/prestart.sh). This hook is used by the test
    suite so it can bootstrap a throwaway database quickly.
    """
    from sqlmodel import SQLModel

    SQLModel.metadata.create_all(engine)
    session.commit()
