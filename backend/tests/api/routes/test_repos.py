"""Tests for /repos, /repos/{id}/comments and /repos/{id}/analyze.

These three route groups had no coverage at all before (see
docs/audit/01-code-audit.md finding M3): 46%, 36% and 52% respectively. They are
also where the mypy fixes in this branch changed runtime behaviour, so the
response shapes are asserted explicitly rather than assumed.
"""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.repo import Repo
from app.models.snapshot import AnalysisSnapshot
from tests.utils.user import auth_headers, create_repo, create_user


def test_connect_repo_returns_public_shape_not_raw_orm(
    client: TestClient, db_session: Session
) -> None:
    """RepoPublic is built explicitly, so the response has exactly its fields."""
    user = create_user(db_session, github_access_token="tok")
    metadata = {"full_name": "octocat/Hello-World", "default_branch": "trunk"}

    with patch(
        "app.api.routes.repos.fetch_repo_metadata",
        new=AsyncMock(return_value=metadata),
    ):
        response = client.post(
            "/repos",
            json={"github_full_name": "octocat/Hello-World"},
            headers=auth_headers(user),
        )

    assert response.status_code == 201, response.text
    body = response.json()
    # Exactly the RepoPublic contract from CONTRACTS.md -- no owner_id-only or
    # token-bearing extras leaking through ORM attribute exposure.
    assert set(body) == {
        "id",
        "owner_id",
        "github_full_name",
        "default_branch",
        "connected_at",
        "last_analyze_error",
    }
    assert body["github_full_name"] == "octocat/Hello-World"
    # The metadata default_branch wins over the RepoCreate default.
    assert body["default_branch"] == "trunk"
    assert body["connected_at"] is not None
    assert body["last_analyze_error"] is None


def test_connect_repo_rejects_duplicate(
    client: TestClient, db_session: Session
) -> None:
    user = create_user(db_session, github_access_token="tok")
    create_repo(db_session, user, "octocat/Hello-World")

    response = client.post(
        "/repos",
        json={"github_full_name": "octocat/Hello-World"},
        headers=auth_headers(user),
    )

    assert response.status_code == 409


def test_connect_repo_requires_a_github_token(
    client: TestClient, db_session: Session
) -> None:
    user = create_user(db_session, github_access_token="")
    response = client.post(
        "/repos",
        json={"github_full_name": "octocat/Hello-World"},
        headers=auth_headers(user),
    )
    assert response.status_code == 401


def test_list_repos_is_newest_first_and_scoped_to_the_owner(
    client: TestClient, db_session: Session
) -> None:
    """Regression test for the order_desc() helper.

    `Repo.connected_at` is `datetime | None` to a type checker, so `.desc()`
    could not be called directly. The typed helper must still emit a real
    DESC ordering -- if it silently degraded, this is the test that catches it.
    """
    user = create_user(db_session)
    other = create_user(db_session)

    # Explicit timestamps, far enough apart that the ordering cannot tie and
    # depend on insertion order.
    now = datetime.now(UTC)
    older = Repo(
        owner_id=user.id,
        github_full_name="octocat/older",
        connected_at=now - timedelta(days=1),
    )
    newer = Repo(
        owner_id=user.id,
        github_full_name="octocat/newer",
        connected_at=now,
    )
    # Another user's repo must never appear in this user's list.
    theirs = Repo(owner_id=other.id, github_full_name="someone-else/theirs")

    db_session.add(older)
    db_session.add(newer)
    db_session.add(theirs)
    db_session.commit()

    response = client.get("/repos", headers=auth_headers(user))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["count"] == 2
    assert [r["github_full_name"] for r in body["data"]] == [
        "octocat/newer",
        "octocat/older",
    ]


def test_list_repos_requires_auth(client: TestClient) -> None:
    assert client.get("/repos").status_code == 401


def test_list_github_repos_returns_picker_shape(
    client: TestClient, db_session: Session
) -> None:
    """GET /github/repos powers the connect picker with a small projection."""
    user = create_user(db_session, github_access_token="tok")
    payload = [
        {
            "full_name": "octocat/Hello-World",
            "private": False,
            "default_branch": "trunk",
            "description": "My example repo",
            "language": "Python",
            "updated_at": "2026-09-01T12:00:00Z",
        },
        {
            "full_name": "octocat/secret",
            "private": True,
            "default_branch": "main",
            "description": None,
            "language": None,
            "updated_at": None,
        },
    ]

    with patch(
        "app.api.routes.repos.fetch_user_repos",
        new=AsyncMock(return_value=payload),
    ):
        response = client.get("/github/repos", headers=auth_headers(user))

    assert response.status_code == 200, response.text
    body = response.json()
    assert [r["full_name"] for r in body] == [
        "octocat/Hello-World",
        "octocat/secret",
    ]
    assert set(body[0]) == {
        "full_name",
        "private",
        "default_branch",
        "description",
        "language",
        "updated_at",
    }
    assert body[1] == {
        "full_name": "octocat/secret",
        "private": True,
        "default_branch": "main",
        "description": None,
        "language": None,
        "updated_at": None,
    }


def test_list_github_repos_requires_a_github_token(
    client: TestClient, db_session: Session
) -> None:
    user = create_user(db_session, github_access_token="")
    response = client.get("/github/repos", headers=auth_headers(user))
    assert response.status_code == 401


def test_list_github_repos_requires_auth(client: TestClient) -> None:
    assert client.get("/github/repos").status_code == 401


def test_disconnect_repo_deletes_it_and_cascades(
    client: TestClient, db_session: Session
) -> None:
    """DELETE /repos/{id} removes the repo and its snapshots in one go."""
    user = create_user(db_session)
    repo = create_repo(db_session, user)
    db_session.add(AnalysisSnapshot(repo_id=repo.id, overall_health_score=90.0))
    db_session.commit()

    response = client.delete(f"/repos/{repo.id}", headers=auth_headers(user))

    assert response.status_code == 204, response.text
    assert client.get("/repos", headers=auth_headers(user)).json()["count"] == 0
    snapshot_count = db_session.exec(
        select(AnalysisSnapshot).where(AnalysisSnapshot.repo_id == repo.id)
    ).all()
    assert snapshot_count == []


def test_disconnect_someone_elses_repo_is_a_404(
    client: TestClient, db_session: Session
) -> None:
    owner = create_user(db_session)
    intruder = create_user(db_session)
    repo = create_repo(db_session, owner)

    response = client.delete(f"/repos/{repo.id}", headers=auth_headers(intruder))

    assert response.status_code == 404
    assert client.get("/repos", headers=auth_headers(owner)).json()["count"] == 1


def test_list_comments_newest_first_with_public_shape(
    client: TestClient, db_session: Session
) -> None:
    user = create_user(db_session)
    repo = create_repo(db_session, user)

    for i in range(2):
        response = client.post(
            f"/repos/{repo.id}/comments",
            json={
                "file_path": f"src/mod{i}.py",
                "body": f"note {i}",
                "x": 1.0,
                "y": 2.0,
            },
            headers=auth_headers(user),
        )
        assert response.status_code == 201, response.text

    listed = client.get(f"/repos/{repo.id}/comments", headers=auth_headers(user))
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert body["count"] == 2
    assert [c["body"] for c in body["data"]] == ["note 1", "note 0"]
    assert set(body["data"][0]) == {
        "id",
        "repo_id",
        "snapshot_id",
        "author_id",
        "file_path",
        "body",
        "x",
        "y",
        "created_at",
    }


def test_comment_on_someone_elses_repo_is_rejected(
    client: TestClient, db_session: Session
) -> None:
    owner = create_user(db_session)
    intruder = create_user(db_session)
    repo = create_repo(db_session, owner)

    response = client.post(
        f"/repos/{repo.id}/comments",
        json={"file_path": "src/app.py", "body": "not mine", "x": 0.0, "y": 0.0},
        headers=auth_headers(intruder),
    )

    assert response.status_code == 404


def test_comment_rejects_snapshot_from_a_different_repo(
    client: TestClient, db_session: Session
) -> None:
    """Regression test for the snapshot ownership check."""
    user = create_user(db_session)
    repo_a = create_repo(db_session, user, "octocat/a")
    repo_b = create_repo(db_session, user, "octocat/b")

    snapshot = AnalysisSnapshot(repo_id=repo_b.id, overall_health_score=80.0)
    db_session.add(snapshot)
    db_session.commit()
    db_session.refresh(snapshot)

    response = client.post(
        f"/repos/{repo_a.id}/comments",
        json={
            "file_path": "src/app.py",
            "body": "cross-repo",
            "x": 0.0,
            "y": 0.0,
            "snapshot_id": str(snapshot.id),
        },
        headers=auth_headers(user),
    )

    assert response.status_code == 422


def test_latest_snapshot_returns_public_shape(
    client: TestClient, db_session: Session
) -> None:
    user = create_user(db_session)
    repo = create_repo(db_session, user)

    for health in (70.0, 91.5):
        db_session.add(AnalysisSnapshot(repo_id=repo.id, overall_health_score=health))
    db_session.commit()

    response = client.get(
        f"/repos/{repo.id}/snapshots/latest", headers=auth_headers(user)
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["overall_health_score"] == 91.5, "order_desc must pick the newest"
    assert set(body) == {"id", "repo_id", "created_at", "overall_health_score", "files"}


def test_latest_snapshot_404s_before_any_analysis(
    client: TestClient, db_session: Session
) -> None:
    user = create_user(db_session)
    repo = create_repo(db_session, user)
    response = client.get(
        f"/repos/{repo.id}/snapshots/latest", headers=auth_headers(user)
    )
    assert response.status_code == 404


def test_latest_snapshot_supports_conditional_get_etag(
    client: TestClient, db_session: Session
) -> None:
    """R10: an If-None-Match matching the ETag returns 304, not the graph.

    The payload is the bandwidth-heavy part of the dashboard, so a poll loop
    must be able to prove "nothing changed" without re-downloading it.
    """
    user = create_user(db_session)
    repo = create_repo(db_session, user)
    db_session.add(AnalysisSnapshot(repo_id=repo.id, overall_health_score=88.0))
    db_session.commit()

    url = f"/repos/{repo.id}/snapshots/latest"
    first = client.get(url, headers=auth_headers(user))
    assert first.status_code == 200
    etag = first.headers.get("etag")
    assert etag and etag.startswith('"'), "a strong quoted ETag must be sent"

    # A matching If-None-Match short-circuits with an empty 304.
    second = client.get(url, headers={**auth_headers(user), "If-None-Match": etag})
    assert second.status_code == 304
    assert second.text == ""

    # A stale tag re-sends the full payload.
    third = client.get(
        url, headers={**auth_headers(user), "If-None-Match": '"not-the-tag"'}
    )
    assert third.status_code == 200
    assert third.json()["overall_health_score"] == 88.0

    # The tag is content-derived: a different snapshot gets a different tag.
    db_session.add(
        AnalysisSnapshot(
            repo_id=repo.id,
            overall_health_score=91.5,
            files=[{"path": "a.py", "loc": 1}],
        )
    )
    db_session.commit()
    changed = client.get(url, headers=auth_headers(user))
    assert changed.status_code == 200
    assert changed.headers.get("etag") != etag


def test_snapshot_history_is_oldest_first(
    client: TestClient, db_session: Session
) -> None:
    """Regression test for the order_asc() helper used by the trend chart."""
    user = create_user(db_session)
    repo = create_repo(db_session, user)

    now = datetime.now(UTC)
    for health, created in [(60.0, now - timedelta(days=2)), (95.0, now)]:
        row = AnalysisSnapshot(repo_id=repo.id, overall_health_score=health)
        row.created_at = created
        db_session.add(row)
    db_session.commit()

    response = client.get(
        f"/repos/{repo.id}/snapshots/history", headers=auth_headers(user)
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["count"] == 2
    assert [s["overall_health_score"] for s in body["data"]] == [60.0, 95.0]
    # The trend chart only needs these four fields.
    assert set(body["data"][0]) == {
        "id",
        "repo_id",
        "created_at",
        "overall_health_score",
    }


def test_analyze_is_queued_as_a_background_task(
    client: TestClient, db_session: Session
) -> None:
    user = create_user(db_session)
    repo = create_repo(db_session, user)

    with patch("app.api.routes.analysis.analyze_repo") as mock_analyze:
        response = client.post(f"/repos/{repo.id}/analyze", headers=auth_headers(user))

    assert response.status_code == 202, response.text
    assert response.json() == {"message": "Analysis queued", "repo_id": str(repo.id)}
    mock_analyze.assert_called_once()
    assert mock_analyze.call_args.args[0] == repo.id


def test_snapshots_require_authentication(
    client: TestClient, db_session: Session
) -> None:
    repo = create_repo(db_session, create_user(db_session))
    for path in (
        f"/repos/{repo.id}/snapshots/latest",
        f"/repos/{repo.id}/snapshots/history",
    ):
        assert client.get(path).status_code == 401


def test_unknown_repo_id_is_a_404(client: TestClient, db_session: Session) -> None:
    """A syntactically valid UUID that no user owns must not leak existence."""
    user = create_user(db_session)
    missing = uuid.uuid4()
    response = client.get(f"/repos/{missing}/comments", headers=auth_headers(user))
    assert response.status_code == 404
