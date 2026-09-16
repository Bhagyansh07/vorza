"""The WebSocket gateway.

Exposes ``GET/WS /ws/repos/{repo_id}``. Every connected socket subscribes to the
repo's Redis pub/sub channel and rebroadcasts channel events to everyone
watching on this instance. Client events (``presence:cursor``, ``comment:new``)
are re-published to the channel so they fan out consistently across instances;
process-local presence roster lives in ``ConnectionManager``.

Mounting (Agent 1): include ``ws_router`` in the FastAPI app and call
``init_runtime()`` / ``shutdown_runtime()`` from the app's lifespan.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from typing import Any, cast

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.ws.comment_store import CommentStore, DummyCommentStore
from app.ws.events import (
    EVENT_COMMENT_NEW,
    EVENT_ERROR,
    EVENT_PRESENCE_CURSOR,
    EVENT_PRESENCE_JOIN,
    EVENT_PRESENCE_LEAVE,
    EVENT_PRESENCE_ROSTER,
    decode,
    is_client_event_type,
)
from app.ws.manager import ConnectionManager
from app.ws.pubsub import CHANNEL_PREFIX, CHANNEL_SUFFIX, PubSubHub, get_hub
from app.ws.throttler import CursorThrottle

logger = logging.getLogger(__name__)

ws_router = APIRouter(tags=["ws"])

JOIN_TIMEOUT_SECONDS = 15.0
TICK_INTERVAL_SECONDS = 1.0 / 10.0  # cursor coalescing cadence (matches CONTRACTS.md limit)

_manager = ConnectionManager()
_comment_store: CommentStore = DummyCommentStore()


def init_runtime(comment_store: CommentStore | None = None) -> None:
    """Bind (optionally) Agent 1's real comment store.

    Call from the FastAPI app's startup hook. Agent 1 provides a real
    ``CommentStore`` when their persistence layer exists; until then the
    in-memory ``DummyCommentStore`` keeps the gateway runnable. The pub/sub
    hub itself is configured via ``app.ws.configure_hub``.
    """
    global _comment_store
    if comment_store is not None:
        _comment_store = comment_store


async def _repo_channel_handler(channel: str, event: dict[str, Any]) -> None:
    """Everything on the repo channel becomes a broadcast to local watchers.

    The hub routes by full channel (``repo:{id}:events``); strip to the repo id.
    """
    prefix, suffix = CHANNEL_PREFIX, CHANNEL_SUFFIX
    if channel.startswith(prefix) and channel.endswith(suffix):
        repo_id = channel[len(prefix) : -len(suffix)]
    else:
        repo_id = channel
    await _manager.broadcast(repo_id, str(event.get("type", "")), dict(event.get("payload", {})))


async def _cursor_flush_loop(repo_id: str, cursor: CursorThrottle) -> None:
    """Coalesce + drain throttled cursor updates onto the channel.

    ``cursor.due()`` returns only the newest pending position per user that is
    now allowed through, so a fast mover is sampled and never falls behind.
    """
    hub = get_hub()
    while True:
        await asyncio.sleep(TICK_INTERVAL_SECONDS)
        for user_id, (x, y) in cursor.due().items():
            await hub.publish(
                repo_id, EVENT_PRESENCE_CURSOR, {"user_id": user_id, "x": x, "y": y}
            )


@ws_router.websocket("/ws/repos/{repo_id}")
async def repo_socket(websocket: WebSocket, repo_id: str) -> None:
    await websocket.accept()
    cursor = _manager.throttle_for(repo_id)  # shared per-repo cursor throttle

    user_id = await _await_join(websocket, repo_id)
    if user_id is None:
        await websocket.close(code=4408)
        return

    hub = get_hub()
    _manager.register(websocket, repo_id, user_id)
    await hub.subscribe(repo_id, _repo_channel_handler)

    try:
        roster = _manager.roster(repo_id)
        await _manager.send(
            websocket,
            EVENT_PRESENCE_ROSTER,
            {"repo_id": repo_id, "user_ids": roster},
        )
        await hub.publish(repo_id, EVENT_PRESENCE_JOIN, {"repo_id": repo_id, "user_id": user_id})

        flush_task = asyncio.create_task(_cursor_flush_loop(repo_id, cursor))
        try:
            await _handle_client_stream(websocket, repo_id, user_id, cursor)
        except WebSocketDisconnect:
            pass
        finally:
            flush_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await flush_task
    finally:
        removed = _manager.unregister(websocket)
        await hub.unsubscribe(repo_id, _repo_channel_handler)
        if removed is not None:
            await hub.publish(
                repo_id, EVENT_PRESENCE_LEAVE, {"repo_id": repo_id, "user_id": removed[1]}
            )


async def _await_join(websocket: WebSocket, repo_id: str) -> str | None:
    """Wait for the mandatory first message ``presence:join {repo_id, user_id}``."""
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=JOIN_TIMEOUT_SECONDS)
        event = decode(raw)
    except TimeoutError:
        logger.info("ws connect aborted: no presence:join within %.0fs", JOIN_TIMEOUT_SECONDS)
        return None
    except WebSocketDisconnect:
        return None
    except Exception:
        logger.debug("ws connect aborted: join message unparsable", exc_info=True)
        return None
    if event.type != EVENT_PRESENCE_JOIN:
        logger.info("ws connect aborted: first message must be presence:join, got %s", event.type)
        return None
    payload: Any = event.payload
    if not isinstance(payload, dict) or not payload.get("token"):
        logger.info("ws connect aborted: presence:join needs a Bearer token")
        return None
    if payload.get("repo_id") not in (None, repo_id):
        return None
    user_id = decode_access_token(str(payload["token"]))
    if user_id is None:
        logger.info("ws connect aborted: invalid JWT in presence:join")
        return None
    return user_id


async def _handle_client_stream(
    websocket: WebSocket, repo_id: str, user_id: str, cursor: CursorThrottle
) -> None:
    hub = get_hub()
    while True:
        raw = await websocket.receive_text()
        try:
            event = decode(raw)
        except Exception:
            await _manager.send(websocket, EVENT_ERROR, {"message": "malformed message"})
            continue
        if not is_client_event_type(event.type):
            await _manager.send(
                websocket, EVENT_ERROR, {"message": f"unexpected event type: {event.type}"}
            )
            continue
        payload: Any = event.payload

        if event.type == EVENT_PRESENCE_CURSOR:
            if isinstance(payload, dict):
                x = payload.get("x")
                y = payload.get("y")
                if isinstance(x, (int, float)) and isinstance(y, (int, float)):
                    if cursor.submit(user_id, float(x), float(y)):
                        await hub.publish(
                            repo_id, EVENT_PRESENCE_CURSOR, {"user_id": user_id, "x": float(x), "y": float(y)}
                        )
            continue

        if event.type == EVENT_COMMENT_NEW:
            if not isinstance(payload, dict) or "comment" not in payload:
                await _manager.send(websocket, EVENT_ERROR, {"message": "comment:new needs a comment"})
                continue
            try:
                stored = await _comment_store.create(dict(payload["comment"]))
            except ValueError as exc:
                await _manager.send(websocket, EVENT_ERROR, {"message": str(exc)})
                continue
            await hub.publish(repo_id, EVENT_COMMENT_NEW, {"comment": stored})
            continue

        # presence:join already handled; any later duplicate is ignored.
        logger.debug("ignoring %s from %s (already joined)", event.type, user_id)