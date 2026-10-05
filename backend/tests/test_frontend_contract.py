"""Contract tests: the HTTP responses the frontend's ApiClient expects.

The frontend types each list endpoint as a bare array
(`listRepos(): Promise<Repo[]>`) while the backend serves a `{data, count}`
envelope. Nothing in either codebase checks this at build time, because
TypeScript only sees the hand-written type in `lib/api-types.ts`. These tests
pin the actual wire shape so the mismatch cannot be reintroduced silently.

If you change a response shape here, change the matching type in
`frontend/src/lib/api-types.ts` in the same commit.

Audit: docs/audit/01-code-audit.md finding M9.
"""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models.repo import Repo
from app.models.snapshot import AnalysisSnapshot
from tests.utils.user import auth_headers, create_user


def test_list_repos_returns_an_envelope_not_a_bare_array(
    client: TestClient, db_session: Session
) -> None:
    user = create_user(db_session)
    db_session.add(Repo(owner_id=user.id, github_full_name="octocat/one"))
    db_session.commit()

    response = client.get("/repos", headers=auth_headers(user))

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, dict), (
        "frontend expects Repo[]; the API serves {data, count}. If this now "
        "returns an array, update listRepos() in frontend/src/lib/http-client.ts"
    )
    assert set(body) == {"data", "count"}
    assert body["count"] == 1
    assert isinstance(body["data"], list)


def test_list_comments_returns_an_envelope(
    client: TestClient, db_session: Session
) -> None:
    user = create_user(db_session)
    repo = Repo(owner_id=user.id, github_full_name="octocat/one")
    db_session.add(repo)
    db_session.commit()
    db_session.refresh(repo)

    created = client.post(
        f"/repos/{repo.id}/comments",
        json={"file_path": "a.py", "body": "note", "x": 0.0, "y": 0.0},
        headers=auth_headers(user),
    )
    assert created.status_code == 201

    response = client.get(f"/repos/{repo.id}/comments", headers=auth_headers(user))

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, dict), (
        "frontend expects CommentPin[]; the API serves {data, count}"
    )
    assert set(body) == {"data", "count"}
    assert body["count"] == 1


def test_snapshot_history_returns_summaries_not_full_snapshots(
    client: TestClient, db_session: Session
) -> None:
    """History is a summary shape with no `files`; the frontend types it as a
    full AnalysisSnapshot, which claims a field the server never sends."""
    user = create_user(db_session)
    repo = Repo(owner_id=user.id, github_full_name="octocat/one")
    db_session.add(repo)
    db_session.commit()
    db_session.refresh(repo)

    row = AnalysisSnapshot(repo_id=repo.id, overall_health_score=72.5)
    row.created_at = datetime.now(UTC) - timedelta(days=1)
    db_session.add(row)
    db_session.commit()

    response = client.get(
        f"/repos/{repo.id}/snapshots/history", headers=auth_headers(user)
    )

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, dict)
    point = body["data"][0]
    assert set(point) == {"id", "repo_id", "created_at", "overall_health_score"}
    assert "files" not in point


def test_analyze_returns_message_and_repo_id(
    client: TestClient, db_session: Session
) -> None:
    """frontend's analyzeRepo() declares {status: string}; that key is absent."""
    from unittest.mock import patch

    user = create_user(db_session)
    repo = Repo(owner_id=user.id, github_full_name="octocat/one")
    db_session.add(repo)
    db_session.commit()
    db_session.refresh(repo)

    with patch("app.api.routes.analysis.analyze_repo"):
        response = client.post(f"/repos/{repo.id}/analyze", headers=auth_headers(user))

    assert response.status_code == 202
    body = response.json()
    assert set(body) == {"message", "repo_id"}
    assert body["repo_id"] == str(repo.id)
