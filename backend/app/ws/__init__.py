"""Vorza real-time layer (Agent 5).

Public surface:

- ``gateway.ws_router`` — mount in the FastAPI app (Agent 1)::
      app.include_router(ws_router)
- ``configure_hub / close_hub / get_hub`` — pub/sub lifecycle (call from app lifespan).
- ``init_runtime`` — inject Agent 1's real comment store when it lands.
- publish helpers for Agent 1/2 hook points: ``publish_snapshot_updated``,
  ``publish_review_new``, ``publish_comment_new``.

See ``CONTRACTS.md`` → "WebSocket events" for the wire shapes.
"""

from app.ws.events import (
    EVENT_COMMENT_NEW,
    EVENT_ERROR,
    EVENT_PRESENCE_CURSOR,
    EVENT_PRESENCE_JOIN,
    EVENT_PRESENCE_LEAVE,
    EVENT_PRESENCE_ROSTER,
    EVENT_REVIEW_NEW,
    EVENT_SNAPSHOT_UPDATED,
    decode,
    encode,
    is_client_event_type,
)
from app.ws.gateway import init_runtime, ws_router
from app.ws.manager import ConnectionManager
from app.ws.pubsub import (
    close_hub,
    configure_hub,
    get_hub,
    publish_comment_new,
    publish_review_new,
    publish_snapshot_updated,
    reset_hub,
)

__all__ = [
    "ConnectionManager",
    "close_hub",
    "configure_hub",
    "decode",
    "encode",
    "get_hub",
    "init_runtime",
    "is_client_event_type",
    "publish_comment_new",
    "publish_review_new",
    "publish_snapshot_updated",
    "reset_hub",
    "ws_router",
    "EVENT_COMMENT_NEW",
    "EVENT_ERROR",
    "EVENT_PRESENCE_CURSOR",
    "EVENT_PRESENCE_JOIN",
    "EVENT_PRESENCE_LEAVE",
    "EVENT_PRESENCE_ROSTER",
    "EVENT_REVIEW_NEW",
    "EVENT_SNAPSHOT_UPDATED",
]
