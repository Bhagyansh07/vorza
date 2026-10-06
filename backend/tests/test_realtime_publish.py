"""Tests for the realtime publish path that was declared but never wired.

Before this change:

- ``main.init_runtime()`` was called with no argument, so ``DummyCommentStore``
  stayed bound and every comment posted from the graph was broadcast to other
  viewers and then discarded.
- ``publish_snapshot_updated`` and ``publish_review_new`` existed, were exported
  from ``app.ws``, and had no production caller -- only tests. ``snapshot:updated``
  and ``review:new`` were therefore listed in CONTRACTS.md and could never be
  emitted.
- The gateway passed the client's ``comment`` payload straight to the store,
  including ``repo_id`` and ``author_id``.

Audit: docs/audit/01-code-audit.md findings M1, M11.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models.comment import Comment
from app.models.snapshot import AnalysisSnapshot, FileNode
from app.services import schemas
from app.services.orchestrator import analyze_repo, review_pull_request
from app.ws.comment_store import SqlCommentStore
from tests.utils.user import auth_headers, create_repo, create_user


class TestSqlCommentStore:
    @pytest.mark.asyncio
    async def test_comment_is_persisted_and_readable_via_rest(
        self, client: TestClient, db_session: Session
    ) -> None:
        user = create_user(db_session)
        repo = create_repo(db_session, user)
        snapshot = AnalysisSnapshot(repo_id=repo.id, overall_health_score=70.0)
        db_session.add(snapshot)
        db_session.commit()
        db_session.refresh(snapshot)

        store = SqlCommentStore()
        stored = await store.create(
            {
                "repo_id": str(repo.id),
                "snapshot_id": str(snapshot.id),
                "author_id": str(user.id),
                "file_path": "src/app.py",
                "body": "  risky refactor  ",
                "x": 0.5,
                "y": 0.25,
            }
        )

        # Broadcast payload is JSON-safe and trimmed.
        assert stored["body"] == "risky refactor"
        assert isinstance(stored["id"], str)
        assert isinstance(stored["created_at"], str)

        # The regression that mattered: it must be visible over REST, not just
        # echoed back to the socket that sent it.
        listed = client.get(f"/repos/{repo.id}/comments", headers=auth_headers(user))
        assert listed.status_code == 200, listed.text
        assert listed.json()["count"] == 1
        assert listed.json()["data"][0]["body"] == "risky refactor"

    @pytest.mark.asyncio
    async def test_row_is_in_the_database(self, db_session: Session) -> None:
        user = create_user(db_session)
        repo = create_repo(db_session, user)
        snapshot = AnalysisSnapshot(repo_id=repo.id, overall_health_score=70.0)
        db_session.add(snapshot)
        db_session.commit()
        db_session.refresh(snapshot)

        await SqlCommentStore().create(
            {
                "repo_id": str(repo.id),
                "snapshot_id": str(snapshot.id),
                "author_id": str(user.id),
                "file_path": "src/a.py",
                "body": "note",
                "x": 0.0,
                "y": 0.0,
            }
        )

        db_session.expire_all()
        rows = db_session.exec(select(Comment).where(Comment.repo_id == repo.id)).all()
        assert [r.body for r in rows] == ["note"]

    @pytest.mark.asyncio
    async def test_snapshot_from_another_repo_is_rejected(
        self, db_session: Session
    ) -> None:
        """Same guard as POST /comments, so both surfaces behave alike."""
        user = create_user(db_session)
        repo_a = create_repo(db_session, user, "octocat/a")
        repo_b = create_repo(db_session, user, "octocat/b")
        snapshot_b = AnalysisSnapshot(repo_id=repo_b.id, overall_health_score=50.0)
        db_session.add(snapshot_b)
        db_session.commit()
        db_session.refresh(snapshot_b)

        with pytest.raises(ValueError, match="does not belong to this repo"):
            await SqlCommentStore().create(
                {
                    "repo_id": str(repo_a.id),
                    "snapshot_id": str(snapshot_b.id),
                    "author_id": str(user.id),
                    "file_path": "src/a.py",
                    "body": "cross-repo",
                    "x": 0.0,
                    "y": 0.0,
                }
            )

    @pytest.mark.asyncio
    async def test_malformed_ids_are_rejected_not_raised_as_500(
        self, db_session: Session
    ) -> None:
        with pytest.raises(ValueError, match="not a valid UUID"):
            await SqlCommentStore().create(
                {
                    "repo_id": "not-a-uuid",
                    "snapshot_id": str(uuid.uuid4()),
                    "author_id": str(uuid.uuid4()),
                    "file_path": "a.py",
                    "body": "x",
                    "x": 0.0,
                    "y": 0.0,
                }
            )

    @pytest.mark.asyncio
    async def test_empty_body_is_rejected(self, db_session: Session) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            await SqlCommentStore().create(
                {
                    "repo_id": str(uuid.uuid4()),
                    "snapshot_id": str(uuid.uuid4()),
                    "author_id": str(uuid.uuid4()),
                    "file_path": "a.py",
                    "body": "   ",
                    "x": 0.0,
                    "y": 0.0,
                }
            )


class TestPublishHelpersAreCalled:
    """The helpers existed and were unreachable. Pin that they are now reached."""

    @pytest.mark.asyncio
    async def test_analyze_publishes_snapshot_updated(
        self, db_session: Session
    ) -> None:
        user = create_user(db_session)
        repo = create_repo(db_session, user)

        fake_snapshot = AnalysisSnapshot(
            repo_id=repo.id, overall_health_score=88.0, files=[]
        )

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
            ) as publish,
        ):
            # The persistence Session is faked; the publish helper must still run.
            mock_session.return_value.__enter__.return_value = db_session
            await analyze_repo(repo.id)

        publish.assert_awaited_once()
        assert publish.await_args is not None
        assert publish.await_args.args[0] == str(repo.id)
        assert "overall_health_score" in publish.await_args.args[1]

    @pytest.mark.asyncio
    async def test_analyze_persists_file_nodes_as_json(self, db_session: Session) -> None:
        """FileNode values land in the JSON column as dicts, not model objects.

        Regression: the orchestrator stored FileNode *models* in the JSON
        column and the first non-empty live analyze on Postgres failed with
        "TypeError: Object of type FileNode is not JSON serializable". Every
        earlier test used files=[], which serializes fine and hid the bug.
        """
        user = create_user(db_session)
        repo = create_repo(db_session, user)

        # Mirror what the real _pure_analyze returns: a domain schema snapshot.
        fake_snapshot = schemas.AnalysisSnapshot(
            overall_health_score=88.0,
            files=[
                schemas.FileNode(
                    path="src/a.py",
                    loc=42,
                    complexity_score=10.0,
                    churn_score=5.0,
                    health_score=90.0,
                    imports=["src/b.py"],
                )
            ],
        )

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
            mock_session.return_value.__enter__.return_value = db_session
            # Raises TypeError pre-fix: FileNode is not JSON serializable.
            await analyze_repo(repo.id)

        row = db_session.exec(
            select(AnalysisSnapshot).where(AnalysisSnapshot.repo_id == repo.id)
        ).one()
        assert row.overall_health_score == 88.0
        assert len(row.files) == 1
        # Accept either a dict (raw JSON column) or a coerced FileNode.
        stored = row.files[0]
        node = stored if isinstance(stored, FileNode) else FileNode.model_validate(stored)
        assert node.path == "src/a.py"
        assert node.imports == ["src/b.py"]

    @pytest.mark.asyncio
    async def test_review_publishes_review_new(self, db_session: Session) -> None:
        from app.services.schemas import AiReview

        user = create_user(db_session)
        repo = create_repo(db_session, user)

        review = AiReview(
            pr_number=42,
            risk_score=61,
            summary="Adds a global lock.",
            flags=[],
            updated_files=["src/core.py"],
        )

        with (
            patch(
                "app.services.orchestrator._resolve_repo_and_token",
                return_value=(repo, "tok"),
            ),
            patch(
                "app.services.orchestrator.fetch_pull_request_diff",
                return_value="diff --git a/x b/x",
            ),
            patch("app.services.orchestrator.OpenAIReviewClient") as mock_client,
            patch("app.services.orchestrator.review_pr", return_value=review),
            patch(
                "app.services.orchestrator.publish_review_new", new=AsyncMock()
            ) as publish,
        ):
            mock_client.return_value.configured = True
            await review_pull_request(repo.id, 42)

        publish.assert_awaited_once()
        assert publish.await_args is not None
        assert publish.await_args.args[0] == str(repo.id)
        assert publish.await_args.args[1]["risk_score"] == 61


class TestGatewayCommentIdentity:
    """A client-supplied ``author_id`` must not decide who posted the comment.

    ``repo_id`` comes from the channel path and ``author_id`` from the token
    verified at join time. The gateway overwrites both, so a frame claiming
    someone else's id is recorded against the real user.
    """

    def test_client_supplied_identity_is_overwritten(self, db_session: Session) -> None:
        import asyncio

        from app.ws import gateway as gateway_module
        from app.ws.pubsub import configure_hub, reset_hub

        owner = create_user(db_session)
        repo = create_repo(db_session, owner)
        victim = create_user(db_session)
        snapshot = AnalysisSnapshot(repo_id=repo.id, overall_health_score=60.0)
        db_session.add(snapshot)
        db_session.commit()
        db_session.refresh(snapshot)

        captured: list[dict] = []

        class CapturingStore:
            async def create(self, comment: dict) -> dict:
                captured.append(comment)
                return {**comment, "id": "c1", "created_at": "2026-01-01T00:00:00Z"}

        class FakeSocket:
            def __init__(self) -> None:
                self._frames = [
                    {
                        "type": "comment:new",
                        "payload": {
                            "comment": {
                                "repo_id": str(repo.id),
                                "snapshot_id": str(snapshot.id),
                                # Forged: claims to be the victim.
                                "author_id": str(victim.id),
                                "file_path": "src/a.py",
                                "body": "not yours",
                                "x": 0.0,
                                "y": 0.0,
                            }
                        },
                    }
                ]
                self.sent: list[dict] = []

            async def receive_text(self) -> str:
                import json

                if not self._frames:
                    # The handler loops until the peer goes away.
                    from starlette.websockets import WebSocketDisconnect

                    raise WebSocketDisconnect(code=1000)
                return json.dumps(self._frames.pop(0))

            async def send_json(self, data: dict) -> None:
                self.sent.append(data)

        hub = configure_hub(in_memory=True)
        previous_store = gateway_module._comment_store
        gateway_module._comment_store = CapturingStore()
        try:

            async def run() -> None:
                cursor = gateway_module._manager.throttle_for(str(repo.id))
                try:
                    await gateway_module._handle_client_stream(
                        FakeSocket(), str(repo.id), str(owner.id), cursor
                    )
                except Exception:
                    # The read loop only ends when the fake peer hangs up,
                    # which is how this drive terminates.
                    pass

            asyncio.run(run())
        finally:
            gateway_module._comment_store = previous_store
            reset_hub()
            assert hub is not None

        assert captured, "the gateway never reached the comment store"
        stored = captured[0]
        # The forger's claim is discarded; the authenticated user is recorded.
        assert stored["author_id"] == str(owner.id)
        assert stored["repo_id"] == str(repo.id)
        assert stored["author_id"] != str(victim.id)
