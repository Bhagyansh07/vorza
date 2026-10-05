"""The migration history must produce the schema the models describe.

This exists because it did not. `app/alembic/versions/0001_initial.py` created
`analysesnapshot` where SQLModel derives `analysissnapshot`, and never created
`aireviewrow` at all. Both were invisible: the app lifespan calls
`SQLModel.metadata.create_all`, which creates the model-named table and papers
over the gap, so the app worked on SQLite and would have failed on the first
managed database that only runs migrations.

Reading a migration and comparing it to the models by eye is exactly how that
happened, so this test builds the schema both ways and diffs them. Any future
model change without a matching migration fails here, with the columns named.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect
from sqlmodel import SQLModel

import app.models  # noqa: F401  (registers every table on the shared metadata)

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


def describe(engine) -> dict[str, set[str]]:
    """Table -> set of 'column type [not null]' strings."""
    result: dict[str, set[str]] = {}
    for table in inspect(engine).get_table_names():
        if table.startswith("sqlite_"):
            continue
        columns = []
        for column in inspect(engine).get_columns(table):
            flag = "not null" if not column.get("nullable", True) else "null"
            columns.append(f"{column['name']} {column['type']!s} [{flag}]")
        result[table] = set(columns)
    return result


@pytest.fixture(scope="module")
def migrated_schema(tmp_path_factory: pytest.TempPathFactory) -> dict[str, set[str]]:
    db_path = tmp_path_factory.mktemp("migrations") / "migrated.db"
    env = {
        **os.environ,
        "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
        # The settings object insists on a secret key. This is a throwaway
        # database in a temp directory, not a deployment.
        "SECRET_KEY": "migration-schema-check-not-a-real-secret",
    }
    subprocess.run(  # noqa: S603
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env=env,
        check=True,
        capture_output=True,
    )

    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    try:
        return describe(engine)
    finally:
        engine.dispose()


@pytest.fixture(scope="module")
def model_schema(tmp_path_factory: pytest.TempPathFactory) -> dict[str, set[str]]:
    db_path = tmp_path_factory.mktemp("models") / "models.db"
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    try:
        SQLModel.metadata.create_all(engine)
        return describe(engine)
    finally:
        engine.dispose()


def test_alembic_ini_is_present() -> None:
    # `alembic upgrade head` resolves script_location relative to cwd, so the
    # test asserts the file it depends on rather than failing deep in subprocess.
    assert ALEMBIC_INI.is_file()


def test_migrations_create_the_same_tables_as_the_models(
    migrated_schema: dict[str, set[str]], model_schema: dict[str, set[str]]
) -> None:
    # alembic_version is Alembic's own bookkeeping and has no model.
    missing = set(model_schema) - set(migrated_schema) - {"alembic_version"}
    assert not missing, (
        "these tables exist in app/models but no migration creates them: "
        f"{sorted(missing)}"
    )

    extra = set(migrated_schema) - set(model_schema) - {"alembic_version"}
    assert not extra, (
        "these tables are created by a migration but no model declares them: "
        f"{sorted(extra)}"
    )


def test_migrations_create_the_same_columns_as_the_models(
    migrated_schema: dict[str, set[str]], model_schema: dict[str, set[str]]
) -> None:
    problems: list[str] = []
    for table in sorted(set(migrated_schema) & set(model_schema)):
        if table == "alembic_version":
            continue
        only_migration = migrated_schema[table] - model_schema[table]
        only_model = model_schema[table] - migrated_schema[table]
        if only_migration or only_model:
            problems.append(f"{table}:")
            for column in sorted(only_migration):
                problems.append(f"  migration only: {column}")
            for column in sorted(only_model):
                problems.append(f"  models only:    {column}")

    assert not problems, "\n".join(problems)


def test_snapshot_table_matches_the_model_name(
    migrated_schema: dict[str, set[str]],
) -> None:
    """Named explicitly because this exact bug shipped once.

    SQLModel derives the table name from the class, so `AnalysisSnapshot` becomes
    `analysissnapshot`. The 0001 migration spelled it `analysesnapshot`, and the
    gap stayed invisible behind the lifespan's `create_all`.
    """
    assert "analysissnapshot" in migrated_schema
    assert "analysesnapshot" not in migrated_schema


def test_ai_review_table_is_migrated(migrated_schema: dict[str, set[str]]) -> None:
    """`AiReviewRow` was missing from 0001 entirely, so reviews could not persist."""
    assert "aireviewrow" in migrated_schema
