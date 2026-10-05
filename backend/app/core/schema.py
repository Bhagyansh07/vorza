"""Decide who owns the schema at startup.

The app lifespan used to call ``SQLModel.metadata.create_all(engine)``
unconditionally. That is fine for a throwaway SQLite file and wrong for a
managed database, and the reason it went unnoticed is worth writing down:

- ``create_all`` never alters an existing table. On Postgres it is a no-op the
  moment ``alembic upgrade head`` has run, so a model change with no matching
  migration is silently *not* applied and nothing complains at boot. The app
  looks healthy and then fails on the first query that touches the new column.
- ``create_all`` creates tables under the *model's* names, which is how
  ``0001_initial`` shipping ``analysesnapshot`` instead of ``analysissnapshot``
  stayed invisible for as long as it did.

So: if Alembic has ever stamped this database, Alembic owns the schema and this
module does nothing. If it has not -- a fresh SQLite file, or a container that
runs no migrations -- the tables are created and the revision is stamped so a
later ``alembic upgrade head`` is a no-op rather than a crash on
``CREATE TABLE`` for a table that already exists.
"""

from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import Engine, inspect
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

ALEMBIC_VERSION_TABLE = "alembic_version"


def alembic_owns_schema(engine: Engine) -> bool:
    """True when this database has an Alembic revision recorded."""
    try:
        return ALEMBIC_VERSION_TABLE in inspect(engine).get_table_names()
    except SQLAlchemyError:
        # A brand-new database that does not exist yet reports as missing rather
        # than failing. Treat that as "no migrations yet".
        return False


def _head_revision() -> str | None:
    """The revision id that ``alembic upgrade head`` would land on."""
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory
    except ImportError:  # pragma: no cover - alembic is a main dependency
        return None

    # script_location in alembic.ini is relative ("app/alembic"), which is only
    # resolvable from the backend directory. Resolve it against this file so the
    # answer does not depend on the process working directory -- on a container
    # the cwd is /backend but on a laptop it is wherever pytest was invoked.
    # This file is backend/app/core/schema.py, so parents[2] is the backend root.
    backend_dir = Path(__file__).resolve().parents[2]
    config = Config()
    config.set_main_option("script_location", str(backend_dir / "app" / "alembic"))
    try:
        return ScriptDirectory.from_config(config).get_current_head()
    except Exception:  # noqa: BLE001
        logger.warning("could not resolve the Alembic head revision", exc_info=True)
        return None


def stamp_head(engine: Engine) -> None:
    """Record the head revision without running any migration."""
    head = _head_revision()
    if head is None:
        return

    from sqlalchemy import text

    with engine.begin() as connection:
        connection.execute(
            text(
                f'CREATE TABLE IF NOT EXISTS "{ALEMBIC_VERSION_TABLE}" '
                "(version_num VARCHAR(32) NOT NULL)"
            )
        )
        connection.execute(
            text(f'DELETE FROM "{ALEMBIC_VERSION_TABLE}" WHERE version_num = :head'),
            {"head": head},
        )
        connection.execute(
            text(f'INSERT INTO "{ALEMBIC_VERSION_TABLE}" (version_num) VALUES (:head)'),
            {"head": head},
        )
    logger.info("stamped Alembic head %s on a database with no revision", head)


def ensure_schema(engine: Engine) -> None:
    """Bring the schema up to whatever is authoritative for this database."""
    from sqlmodel import SQLModel

    if alembic_owns_schema(engine):
        # Migrations own it. create_all would only be able to add tables that no
        # migration declares, which is precisely the drift this avoids.
        logger.info("Alembic owns the schema; leaving it to the migrations")
        return

    logger.info("no Alembic revision found; creating tables from the models")
    SQLModel.metadata.create_all(engine)
    stamp_head(engine)
