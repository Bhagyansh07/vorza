"""Gateway integration tests.

Uses Starlette's TestClient + the in-memory pub/sub backend, so the whole
real-time stack (socket → gateway → hub → Redis channel → other sockets) is
exercised with zero external services. This is the "2 simulated concurrent
browser connections" load test from the task file.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import app.ws.gateway as gateway_module
from app.core.security import create_access_token
from app.ws import publish_snapshot_updated
from app.ws.comment_store import DummyCommentStore
from app.ws.pubsub import configure_hub, reset_hub

from fastapi import FastAPI

REPO = "repo-1"


def make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(gateway_module.ws_router)
    return app


@pytest.fixture
def hub():
    hub = configure_hub(in_memory=True)
    yield hub
    reset_hub()


def until(ws: Any, wanted: str, *, where: dict[str, Any] | None = None) -> dict[str, Any]:
    """Read events until the wanted type arrives, optionally matching payload fields."""
    for _ in range(30):
        event = ws.receive_json()
        if event["type"] != wanted:
            continue
        if where is None:
            return event
        if all(event["payload"].get(k) == v for k, v in where.items()):
            return event
    raise AssertionError(f"never received a {wanted} event matching {where}")


def join(ws: Any, repo_id: str, user_id: str) -> dict[str, Any]:
    token = create_access_token(user_id, expires_delta=timedelta(hours=1))
    ws.send_json({"type": "presence:join", "payload": {"repo_id": repo_id, "token": token}})
    roster = until(ws, "presence:roster")
    assert roster["payload"]["repo_id"] == repo_id
    until(ws, "presence:join")  # drain the self-echo broadcast before the next read
    return roster


def test_hello_world_roundtrip(hub) -> None:
    """Step 1 of the task file: connect → send → receive against the bare gateway."""
    with TestClient(make_app()) as client:
        with client.websocket_connect(f"/ws/repos/{REPO}") as ws:
            roster = join(ws, REPO, "u1")
            assert roster["payload"]["user_ids"] == ["u1"]


def test_connection_without_join_is_rejected(monkeypatch, hub) -> None:
    monkeypatch.setattr(gateway_module, "JOIN_TIMEOUT_SECONDS", 0.05)
    with TestClient(make_app()) as client:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect(f"/ws/repos/{REPO}") as ws:
                ws.receive_json()
        assert exc_info.value.code == 4408


def test_two_clients_see_each_others_join_and_leave(hub) -> None:
    """Definition of done: two tabs on one repo see each other live."""
    with TestClient(make_app()) as client:
        with client.websocket_connect(f"/ws/repos/{REPO}") as ws1:
            join(ws1, REPO, "u1")

            with client.websocket_connect(f"/ws/repos/{REPO}") as ws2:
                join(ws2, REPO, "u2")
                join_event = until(ws1, "presence:join", where={"user_id": "u2"})
                assert join_event["payload"]["user_id"] == "u2"

            # ws2's socket closed → ws1 hears the leave
            leave = until(ws1, "presence:leave")
            assert leave["payload"]["user_id"] == "u2"


def test_cursor_rebroadcasts_to_other_client(hub) -> None:
    """Move a cursor on ws1, see it land on ws2 (the sender also sees it back —
    the frontend filters its own user_id)."""
    with TestClient(make_app()) as client:
        with client.websocket_connect(f"/ws/repos/{REPO}") as ws1:
            join(ws1, REPO, "u1")
            with client.websocket_connect(f"/ws/repos/{REPO}") as ws2:
                join(ws2, REPO, "u2")

                ws1.send_json(
                    {"type": "presence:cursor", "payload": {"user_id": "u1", "x": 42, "y": 24}}
                )
                cursor = until(ws2, "presence:cursor")
                assert cursor["payload"]["user_id"] == "u1"
                assert cursor["payload"]["x"] == 42
                assert cursor["payload"]["y"] == 24


def test_server_uses_registered_identity_for_cursors(hub) -> None:
    """A client cannot spoof another user's cursor — the gateway stamps user_id."""
    with TestClient(make_app()) as client:
        with client.websocket_connect(f"/ws/repos/{REPO}") as ws1:
            join(ws1, REPO, "u1")
            with client.websocket_connect(f"/ws/repos/{REPO}") as ws2:
                join(ws2, REPO, "u2")
                ws1.send_json(
                    {"type": "presence:cursor", "payload": {"user_id": "someone-else", "x": 1, "y": 2}}
                )
                cursor = until(ws2, "presence:cursor")
                assert cursor["payload"]["user_id"] == "u1"
                assert cursor["payload"]["x"] == 1


def test_comment_new_persists_and_fans_out(hub) -> None:
    store = DummyCommentStore()
    gateway_module.init_runtime(store)
    with TestClient(make_app()) as client:
        with client.websocket_connect(f"/ws/repos/{REPO}") as ws1:
            join(ws1, REPO, "u1")
            with client.websocket_connect(f"/ws/repos/{REPO}") as ws2:
                join(ws2, REPO, "u2")

                ws1.send_json(
                    {
                        "type": "comment:new",
                        "payload": {
                            "comment": {
                                "repo_id": REPO,
                                "snapshot_id": "snap-1",
                                "file_path": "README.md",
                                "author_id": "u1",
                                "body": "line 5 is dead code",
                                "x": 10,
                                "y": 20,
                            }
                        },
                    }
                )
                comment_event = until(ws2, "comment:new")
                comment = comment_event["payload"]["comment"]
                assert comment["body"] == "line 5 is dead code"
                assert comment["id"]  # server stamped it
                assert comment["created_at"]  # server stamped it
                assert len(store.comments) == 1
                assert store.comments[0]["id"] == comment["id"]


def test_publisher_snapshot_update_fans_out(hub) -> None:
    """Agent 1 triggers a new snapshot → a connected client sees it with no refresh."""
    with TestClient(make_app()) as client:
        with client.websocket_connect(f"/ws/repos/{REPO}") as ws:
            join(ws, REPO, "u1")
            result = client.portal.call(
                publish_snapshot_updated, REPO, {"id": "snap-99", "files": []}
            )
            assert result is None
            event = until(ws, "snapshot:updated")
        assert event["payload"]["repo_id"] == REPO
        assert event["payload"]["snapshot"]["id"] == "snap-99"