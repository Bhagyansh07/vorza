"""WebSocket event envelope shared by the gateway, the Redis publish helpers,
and (by contract) the frontend.

Every message on the wire — Redis channel, server->client, client->server — is
a JSON object of the shape ``{"type": ..., "payload": ...}``. Event names and
payload shapes are owned by this module and mirrored in ``CONTRACTS.md``.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel

# --- event names -----------------------------------------------------------
EVENT_PRESENCE_JOIN = "presence:join"
EVENT_PRESENCE_LEAVE = "presence:leave"
EVENT_PRESENCE_ROSTER = "presence:roster"
EVENT_PRESENCE_CURSOR = "presence:cursor"
EVENT_COMMENT_NEW = "comment:new"
EVENT_SNAPSHOT_UPDATED = "snapshot:updated"
EVENT_REVIEW_NEW = "review:new"
EVENT_ERROR = "error"

# --- client -> server events -----------------------------------------------
CLIENT_EVENTS = frozenset(
    {EVENT_PRESENCE_JOIN, EVENT_PRESENCE_CURSOR, EVENT_COMMENT_NEW}
)

# --- wire envelope ----------------------------------------------------------


class WsEvent(BaseModel):
    """A single WebSocket / Redis pub/sub message."""

    type: str
    payload: dict[str, Any]


def encode(event_type: str, payload: dict[str, Any] | BaseModel) -> str:
    """Serialize one event to its JSON wire form."""
    if isinstance(payload, BaseModel):
        payload = payload.model_dump(mode="json")
    return json.dumps({"type": event_type, "payload": payload})


def decode(raw: str) -> WsEvent:
    """Parse one event from its JSON wire form."""
    data = json.loads(raw)
    return WsEvent.model_validate(data)


def is_client_event_type(event_type: str) -> bool:
    return event_type in CLIENT_EVENTS
