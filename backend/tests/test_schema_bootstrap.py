"""Tests for app/core/schema.py.

The behaviour that matters: a database with an Alembic revision must be left
completely alone, and one without must come up usable *and* get stamped, so a
later `alembic upgrade head` is a no-op instead of a crash.
"""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, inspect, text

from app.core.schema import (
    ALEMBIC_VERSION_TABLE,
    alembic_owns_schema,
    ensure_schema,
    stamp_head,
)


@pytest.fixture
def engine(tmp_path):
    created = create_engine(f"sqlite:///{(tmp_path / 'schema.db').as_posix()}")
    try:
        yield created
    finally:
        created.dispose()


class TestAlembicOwnsSchema:
    def test_a_fresh_database_has_no_revision(self, engine) -> None:
        assert alembic_owns_schema(engine) is False

    def test_a_stamped_database_reports_true(self, engine) -> None:
        stamp_head(engine)
        assert alembic_owns_schema(engine) is True


class TestEnsureSchema:
    def test_creates_tables_on_a_database_with_no_migrations(self, engine) -> None:
        ensure_schema(engine)

        tables = set(inspect(engine).get_table_names())
        assert {
            "user",
            "repo",
            "comment",
            "analysissnapshot",
            "aireviewrow",
            "oauthstate",
        } <= tables

    def test_stamps_the_head_so_a_later_upgrade_is_a_noop(self, engine) -> None:
        """Without the stamp, `alembic upgrade head` would try to CREATE TABLE
        user on a table create_all had just made, and the deploy would crash on
        boot with an OperationalError."""
        ensure_schema(engine)

        assert ALEMBIC_VERSION_TABLE in inspect(engine).get_table_names()
        with engine.connect() as connection:
            versions = (
                connection.execute(
                    text(f"SELECT version_num FROM {ALEMBIC_VERSION_TABLE}")
                )
                .scalars()
                .all()
            )
        assert len(versions) == 1
        assert versions[0] == "0005"

    def test_leaves_an_already_migrated_database_untouched(self, engine) -> None:
        ensure_schema(engine)
        before = set(inspect(engine).get_table_names())

        # A table no migration and no model declares: exactly what create_all
        # being skipped must prevent from appearing behind our back.
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE smuggled (id INTEGER)"))

        ensure_schema(engine)

        assert set(inspect(engine).get_table_names()) == before | {"smuggled"}

    def test_is_idempotent(self, engine) -> None:
        ensure_schema(engine)
        first = set(inspect(engine).get_table_names())
        ensure_schema(engine)
        ensure_schema(engine)
        assert set(inspect(engine).get_table_names()) == first

    def test_stamping_twice_does_not_duplicate_the_row(self, engine) -> None:
        stamp_head(engine)
        stamp_head(engine)

        with engine.connect() as connection:
            versions = (
                connection.execute(
                    text(f"SELECT version_num FROM {ALEMBIC_VERSION_TABLE}")
                )
                .scalars()
                .all()
            )
        assert len(versions) == 1
