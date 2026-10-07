"""Snapshot trimming: keep only the newest N per repo (docs/01-audit.md R6).

The R6 failure mode is unbounded growth: every re-analysis inserts a row with
the full graph JSON, so a repo analyzed a few times a day for months builds a
table that only gets bigger. ``trim_snapshots`` keeps the newest 20 in the
same transaction as the analyze write, and this file pins both the pure
function and the write path that calls it.
"""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlmodel import Session, select

from app.models.snapshot import AnalysisSnapshot
from app.services import schemas
from app.services.orchestrator import SNAPSHOT_KEEP, analyze_repo, trim_snapshots
from tests.utils.user import create_repo, create_user


def _seed_snapshots(
    db_session: Session, repo_id: uuid.UUID, count: int
) -> None:
    """Insert ``count`` snapshots with descending ages, newest first.

    Row ``i`` is created ``i`` hours in the past, so row 0 is the newest. The
    health score doubles as a stable identity (``float(i)``).
    """
    now = datetime.now(UTC)
    for i in range(count):
        row = AnalysisSnapshot(
            repo_id=repo_id, overall_health_score=float(i)
        )
        row.created_at = now - timedelta(hours=i)
        db_session.add(row)
    db_session.commit()


def _snapshot_count(db_session: Session, repo_id: uuid.UUID) -> int:
    return len(
        db_session.exec(
            select(AnalysisSnapshot).where(AnalysisSnapshot.repo_id == repo_id)
        ).all()
    )


def test_trim_keeps_the_newest_twenty(db_session: Session) -> None:
    user = create_user(db_session)
    repo = create_repo(db_session, user)
    _seed_snapshots(db_session, repo.id, count=25)

    pruned = trim_snapshots(db_session, repo.id)
    db_session.commit()

    assert pruned == 5
    remaining = db_session.exec(
        select(AnalysisSnapshot)
        .where(AnalysisSnapshot.repo_id == repo.id)
        .order_by(AnalysisSnapshot.overall_health_score)
    ).all()
    assert len(remaining) == SNAPSHOT_KEEP
    # The oldest five (health 20.0..24.0) are gone; the newest twenty stay.
    assert [s.overall_health_score for s in remaining] == [float(i) for i in range(20)]


def test_trim_is_a_noop_below_the_keep_bound(db_session: Session) -> None:
    user = create_user(db_session)
    repo = create_repo(db_session, user)
    _seed_snapshots(db_session, repo.id, count=3)

    assert trim_snapshots(db_session, repo.id) == 0
    db_session.commit()
    assert _snapshot_count(db_session, repo.id) == 3


def test_trim_only_touches_the_requested_repo(db_session: Session) -> None:
    user = create_user(db_session)
    repo_a = create_repo(db_session, user)
    repo_b = create_repo(db_session, user, github_full_name="octocat/Another")
    _seed_snapshots(db_session, repo_a.id, count=21)
    _seed_snapshots(db_session, repo_b.id, count=1)

    pruned = trim_snapshots(db_session, repo_a.id)
    db_session.commit()

    assert pruned == 1
    assert _snapshot_count(db_session, repo_a.id) == 20
    assert _snapshot_count(db_session, repo_b.id) == 1


@pytest.mark.asyncio
async def test_analyze_write_path_trims(db_session: Session) -> None:
    """21 analyzes must not leave 21 snapshots behind.

    The trim runs in the analyze transaction, so the write path itself keeps
    the invariant -- not a job an operator has to remember to schedule.
    """
    user = create_user(db_session)
    repo = create_repo(db_session, user)

    fake_snapshot = schemas.AnalysisSnapshot(overall_health_score=70.0, files=[])

    with (
        patch(
            "app.services.orchestrator._resolve_repo_and_token",
            return_value=(repo, "tok"),
        ),
        patch(
            "app.services.orchestrator._ensure_checkout",
            return_value="/tmp/checkout",
        ),
        patch(
            "app.services.orchestrator._pure_analyze",
            return_value=fake_snapshot,
        ),
        patch("app.services.orchestrator.Session") as mock_session,
        patch(
            "app.services.orchestrator.publish_snapshot_updated",
            new=AsyncMock(),
        ),
    ):
        # The persistence Session is faked; point it at the real test session
        # so the inserts and the trim actually hit the database.
        mock_session.return_value.__enter__.return_value = db_session

        for _ in range(SNAPSHOT_KEEP + 1):
            await analyze_repo(repo.id)

    assert _snapshot_count(db_session, repo.id) == SNAPSHOT_KEEP
