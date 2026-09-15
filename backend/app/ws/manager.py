"""In-process WebSocket connection registry + broadcast helpers.

``ConnectionManager`` tracks who is connected to which repo on *this* instance
(so "3 people viewing" works without a Redis round-trip) and provides the
broadcast primitives the gateway uses. Redis pub/sub (``PubSubHub``) is what
moves events across instances and from Agent 1/2's publish hook points;
presence itself is intentionally process-local for v1 (multi-node presence is a
documented stretch goal in CONTRACTS.md).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import WebSocket

from app.ws.throttler import CursorThrottle

logger = logging.getLogger(__name__)

DEFAULT_CURSOR_MAX_PER_SEC = 10.0

RepoId = str
UserId = str


class ConnectionManager:
    def __init__(self, cursor_max_per_sec: float = DEFAULT_CURSOR_MAX_PER_SEC) -> None:
        self._connections: dict[WebSocket, tuple[RepoId, UserId]] = {}
        self._members: dict[RepoId, dict[UserId, set[WebSocket]]] = {}
        self._throttles: dict[RepoId, CursorThrottle] = {}
        self._cursor_max_per_sec = cursor_max_per_sec

    # --- registry -------------------------------------------------------------

    def register(self, websocket: WebSocket, repo_id: RepoId, user_id: UserId) -> None:
        self._connections[websocket] = (repo_id, user_id)
        self._members.setdefault(repo_id, {}).setdefault(user_id, set()).add(websocket)

    def unregister(self, websocket: WebSocket) -> tuple[RepoId, UserId] | None:
        conn = self._connections.pop(websocket, None)
        if conn is None:
            return None
        repo_id, user_id = conn
        user_sockets = self._members.get(repo_id, {}).get(user_id)
        if user_sockets is not None:
            user_sockets.discard(websocket)
            if not user_sockets:
                del self._members[repo_id][user_id]
                self.throttle_for(repo_id).reset(user_id)
            if not self._members[repo_id]:
                del self._members[repo_id]
                self._throttles.pop(repo_id, None)
        return repo_id, user_id

    def roster(self, repo_id: RepoId) -> list[UserId]:
        return sorted(k for k in self._members.get(repo_id, {}) if k)

    def repo_for(self, websocket: WebSocket) -> tuple[RepoId, UserId] | None:
        return self._connections.get(websocket)

    def repo_member_count(self, repo_id: RepoId) -> int:
        return sum(len(sockets) for sockets in self._members.get(repo_id, {}).values())

    # --- broadcast ------------------------------------------------------------

    async def broadcast(
        self,
        repo_id: RepoId,
        event_type: str,
        payload: dict[str, Any],
        *,
        exclude: WebSocket | None = None,
    ) -> None:
        """Send one event to every socket watching ``repo_id``."""
        participants = self._members.get(repo_id, {})
        for sockets in participants.values():
            for ws in sockets:
                if ws is exclude:
                    continue
                await self._send(ws, event_type, payload)

    async def send(self, websocket: WebSocket, event_type: str, payload: dict[str, Any]) -> None:
        await self._send(websocket, event_type, payload)

    @staticmethod
    async def _send(websocket: WebSocket, event_type: str, payload: dict[str, Any]) -> None:
        try:
            await websocket.send_json({"type": event_type, "payload": payload})
        except Exception:
            logger.debug("dropped send to disconnected socket (%s)", event_type)

    # --- cursor throttling ----------------------------------------------------

    def throttle_for(self, repo_id: RepoId) -> CursorThrottle:
        throttle = self._throttles.get(repo_id)
        if throttle is None:
            throttle = CursorThrottle(max_per_sec=self._cursor_max_per_sec)
            self._throttles[repo_id] = throttle
        return throttle

    def throttle_submit(self, repo_id: RepoId, user_id: UserId, x: float, y: float) -> bool:
        """True when a cursor update for this user may be broadcast immediately."""
        return self._throttle_for(repo_id).submit(user_id, x, y)

    def throttle_due(self, repo_id: RepoId) -> dict[str, tuple[float, float]]:
        return self._throttle_for(repo_id).due()