"""Coalescing cursor throttle.

The single most important performance lever in the real-time layer: if every
cursor move were rebroadcast to every other client, the whole feed would feel
laggy and saturate Redis. Instead we sample at a fixed rate per user (default
10 msg/sec, the CONTRACTS.md limit) and always coalesce to the *latest* value,
so a cursor can never fall more than one tick behind and never drops its final
position.
"""

from __future__ import annotations

import math
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import TypeAlias

CursorPoint: TypeAlias = tuple[float, float]


@dataclass
class CursorThrottle:
    """Samples per-user cursor positions at ``max_per_sec``.

    ``submit`` returns True when the value should be broadcast immediately;
    otherwise the value is stashed and delivered later (coalesced) by draining
    ``due()`` from a background tick loop.
    """

    max_per_sec: float = 10.0
    _timer: Callable[[], float] = time.monotonic
    _last_sent: dict[str, float] = field(default_factory=dict)
    _pending: dict[str, CursorPoint] = field(default_factory=dict)

    @property
    def interval(self) -> float:
        return 1.0 / self.max_per_sec

    def submit(self, user_id: str, x: float, y: float) -> bool:
        """Record a cursor position; True if it should be sent right now."""
        now = self._timer()
        if now - self._last_sent.get(user_id, -math.inf) >= self.interval:
            self._last_sent[user_id] = now
            self._pending.pop(user_id, None)
            return True
        self._pending[user_id] = (x, y)
        return False

    def due(self) -> dict[str, CursorPoint]:
        """Return every pending cursor now allowed through (newest value only),
        clearing it from the queue."""
        now = self._timer()
        out: dict[str, CursorPoint] = {}
        for user_id, point in list(self._pending.items()):
            if now - self._last_sent.get(user_id, -math.inf) >= self.interval:
                self._last_sent[user_id] = now
                out[user_id] = point
                del self._pending[user_id]
        return out

    def has_pending(self, user_id: str | None = None) -> bool:
        if user_id is None:
            return bool(self._pending)
        return user_id in self._pending

    def reset(self, user_id: str) -> None:
        """Forget history for a user (e.g. on disconnect)."""
        self._pending.pop(user_id, None)
        self._last_sent.pop(user_id, None)
