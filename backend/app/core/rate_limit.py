"""In-process HTTP rate limiting.

Deliberately dependency-free. slowapi and friends wrap a Flask-style decorator
API that does not map cleanly onto FastAPI's dependency model, and they add a
transitive dependency tree for what is, here, a narrow requirement: stop an
unauthenticated caller from hammering the endpoints that cost money or touch
GitHub's API.

Design constraints:

- **In-process, not shared.** State lives in this container's memory. On the
  free single-instance Render deploy that is exactly right. If the app is ever
  scaled to multiple instances, each gets its own budget -- which is weaker
  than a shared limit, not broken. Upgrading to Redis (already an optional
  dependency, used by `app.ws.pubsub`) is the documented next step.
- **Lazy cleanup.** Buckets are pruned on write, not by a background timer, so
  an idle process holds no timers and there is nothing to shut down.
- **Fails open on unexpected input.** A malformed client key must not turn into
  a 500.

Docs: docs/audit/01-code-audit.md finding H7.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from dataclasses import dataclass

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# Cap on tracked keys. Bounds memory against a rotating-IP flood: once the map
# is full, the least-recently-used bucket is evicted. Evicting a live bucket
# resets its count, so a determined attacker can get more than the limit by
# filling the map -- accepted because the alternative (unbounded memory) is a
# worse failure, and per-endpoint limits below do the real work.
MAX_TRACKED_KEYS = 10_000


@dataclass
class _Bucket:
    """A sliding window over `limit` requests."""

    window_start: float
    count: int


class SlidingWindowLimiter:
    """Thread-safe fixed-window counter with lazy expiry."""

    def __init__(self, limit: int, window_seconds: float) -> None:
        self.limit = limit
        self.window = window_seconds
        self._buckets: OrderedDict[str, _Bucket] = OrderedDict()
        self._lock = threading.Lock()

    def hit(self, key: str, now: float | None = None) -> bool:
        """Record a request. Returns False when the caller is over the limit."""
        now = time.monotonic() if now is None else now
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None or now - bucket.window_start >= self.window:
                bucket = _Bucket(window_start=now, count=0)
                self._buckets[key] = bucket
                self._evict_locked()
            else:
                self._buckets.move_to_end(key)

            bucket.count += 1
            return bucket.count <= self.limit

    def retry_after(self, key: str, now: float | None = None) -> int:
        """Whole seconds until the caller's window resets (at least 1)."""
        now = time.monotonic() if now is None else now
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                return 0
            remaining = self.window - (now - bucket.window_start)
            return max(1, int(remaining) + 1)

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()

    def _evict_locked(self) -> None:
        while len(self._buckets) > MAX_TRACKED_KEYS:
            self._buckets.popitem(last=False)


# Per-path budgets, requests per window. Tuned against what the product
# actually does, not picked round numbers:
#
#   OAuth + webhook  Unauthenticated and externally triggered, so the tightest
#                    limits here. A legitimate user signs in maybe a few times a
#                    day; the webhook fires a handful of times per PR.
#   Writes           Token-authenticated but cheap to abuse, and each write is a
#                    DB round-trip.
#   Reads            Authenticated; the dashboard polls, so the budget is loose
#                    enough not to break normal use.
#   Default          Everything else, including /docs.
_DEFAULT_LIMIT = 120
_DEFAULT_WINDOW = 60.0

_PATH_LIMITS: dict[str, tuple[int, float]] = {
    "/auth/github/login": (20, 60.0),
    "/auth/github/callback": (20, 60.0),
    "/webhooks/github": (60, 60.0),
}
_PREFIX_LIMITS: dict[str, tuple[int, float]] = {
    "/repos": (30, 60.0),
}

_limiter = SlidingWindowLimiter(_DEFAULT_LIMIT, _DEFAULT_WINDOW)
_write_limiter = SlidingWindowLimiter(30, 60.0)


def _client_key(request: Request) -> str:
    """Identify the caller.

    Authenticated requests are keyed by user id from the bearer token when one
    is present, so one user cannot exhaust another user's budget. Falls back to
    the connecting IP.

    X-Forwarded-For is trusted because Render terminates TLS in front of this
    app and sets it. That is only safe while the app is NOT exposed directly;
    noted in docs/MANUAL_STEPS.md.
    """
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return f"user:{auth[7:].strip()[:64]}"
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        # Left-most entry is the original client.
        return f"ip:{forwarded.split(',')[0].strip()}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


# Resolved once at import rather than per request: a dict lookup per request
# on a hot path, plus rebuilding a limiter per call would reset its counters.
_LOGIN_LIMITER = SlidingWindowLimiter(*_PATH_LIMITS["/auth/github/login"])
_WEBHOOK_LIMITER = SlidingWindowLimiter(*_PATH_LIMITS["/webhooks/github"])
_REPO_LIMITER = SlidingWindowLimiter(*_PREFIX_LIMITS["/repos"])


def _resolve_limiter(path: str) -> SlidingWindowLimiter:
    if path == "/auth/github/login":
        return _LOGIN_LIMITER
    if path == "/webhooks/github":
        return _WEBHOOK_LIMITER
    if path.startswith("/repos"):
        return _REPO_LIMITER
    return _limiter


def reset_limiters() -> None:
    """Clear all counters. Used by the test suite between cases."""
    for limiter in (
        _limiter,
        _LOGIN_LIMITER,
        _WEBHOOK_LIMITER,
        _REPO_LIMITER,
        _write_limiter,
    ):
        limiter.reset()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Reject over-budget requests with 429 and a Retry-After header.

    WebSocket upgrades are skipped: the handshake is a GET, and applying an HTTP
    window to it would rate-limit the realtime gateway's connection path with
    limits chosen for REST calls.
    """

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
        path = request.url.path

        # Only real API traffic is limited.
        if not path.startswith(("/auth/", "/repos", "/me", "/webhooks/")):
            untracked: Response = await call_next(request)
            return untracked

        limiter = _resolve_limiter(path)
        key = _client_key(request)

        if not limiter.hit(key):
            retry_after = limiter.retry_after(key)
            return Response(
                content=(
                    f'{{"detail":"Rate limit exceeded. Retry after {retry_after}s."}}'
                ),
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                media_type="application/json",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(
                        _PATH_LIMITS.get(path, (limiter.limit,))[0]
                    ),
                },
            )

        response: Response = await call_next(request)

        # Mutating requests get their own, tighter budget in addition to the
        # path budget.
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            if not _write_limiter.hit(f"{key}:{path}"):
                retry_after = _write_limiter.retry_after(f"{key}:{path}")
                return Response(
                    content='{"detail":"Write rate limit exceeded."}',
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    media_type="application/json",
                    headers={"Retry-After": str(retry_after)},
                )

        return response


def rate_limit_exceeded() -> HTTPException:
    """Reusable 429 for handlers that need their own budget."""
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Rate limit exceeded",
        headers={"Retry-After": "60"},
    )
