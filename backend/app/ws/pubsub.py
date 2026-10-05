"""Redis pub/sub wiring for per-repo event channels.

Architecture
------------
- One channel per repo: ``repo:{repo_id}:events``. Publishing an event to that
  channel is how Agent 1 (snapshots / comments) and Agent 2 (AI reviews) get a
  live update to every connected client, including across multiple backend
  instances.
- ``PubSubHub`` is the facade everything else uses. It lazily spins up the
  backend subscription on first use and reference-counts subscribers.
- ``RedisPubSubBackend`` is the production backend (uses ``redis.asyncio``).
  ``InMemoryPubSubBackend`` is a drop-in that lets the gateway run and be
  tested with zero infra (no Redis server) — useful in dev and CI.

Agents 1/2 should **not** import this module directly. Use the publish helpers
exported from ``app.ws`` (``publish_snapshot_updated``, ``publish_review_new``,
``publish_comment_new``).
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Awaitable, Callable
from typing import Any, Protocol, TypeAlias

try:
    import redis.asyncio as aioredis
except ImportError:  # pragma: no cover - Render free tier has no managed Redis
    # `redis` is an optional extra (see pyproject.toml [project.optional-dependencies]
    # -> pubsub). When it is absent this module still imports and the gateway
    # falls back to the in-process hub. `Any` rather than a stub class: the
    # `aioredis.Redis` annotations below need a real module to resolve, and a
    # stand-in class only existed to satisfy a checker.
    aioredis = None


from app.ws.events import encode

logger = logging.getLogger(__name__)

EventHandler: TypeAlias = Callable[[str, dict[str, Any]], Awaitable[None]]
"""Backend subscriber callback: ``(channel, event_dict) -> None``."""

CHANNEL_PREFIX = "repo:"
CHANNEL_SUFFIX = ":events"
SUBSCRIBE_PATTERN = CHANNEL_PREFIX + "*" + CHANNEL_SUFFIX


def channel_for(repo_id: str) -> str:
    return f"{CHANNEL_PREFIX}{repo_id}{CHANNEL_SUFFIX}"


class PubSubBackend(Protocol):
    """Low-level pub/sub contract. Implementations must be async."""

    async def subscribe(self, channel: str, callback: EventHandler) -> None: ...
    async def publish(self, channel: str, message: str) -> None: ...
    async def close(self) -> None: ...


class RedisPubSubBackend:
    """Production backend.

    Uses a single Redis connection with a pattern subscription to
    ``repo:*:events``: subscribing is just registering an in-memory handler, so
    N connections on one repo never spawn N Redis subscriptions.
    """

    def __init__(self, redis_url: str = "redis://localhost:6379/0") -> None:
        self._redis_url = redis_url
        self._client: aioredis.Redis | None = None
        self._pubsub: aioredis.client.PubSub | None = None
        self._handlers: dict[str, list[EventHandler]] = {}
        self._listener_task: asyncio.Task[None] | None = None
        self._closed = False

    async def _connect(self) -> aioredis.Redis:
        if self._client is None:
            self._client = await aioredis.from_url(self._redis_url)
        return self._client

    async def _ensure_listener(self) -> None:
        if self._listener_task is not None and not self._listener_task.done():
            return
        client = await self._connect()
        pubsub = client.pubsub()
        await pubsub.psubscribe(SUBSCRIBE_PATTERN)
        self._pubsub = pubsub
        self._listener_task = asyncio.create_task(
            self._listen_loop(), name="ws-pubsub-listener"
        )

    async def subscribe(self, channel: str, callback: EventHandler) -> None:
        self._handlers.setdefault(channel, []).append(callback)
        if not self._closed:
            await self._ensure_listener()

    async def publish(self, channel: str, message: str) -> None:
        client = await self._connect()
        await client.publish(channel, message)

    async def _listen_loop(self) -> None:
        pubsub = self._pubsub
        assert pubsub is not None
        try:
            while not self._closed:
                await asyncio.sleep(0)  # yield; get_message below needs it in the loop
                try:
                    message = await pubsub.get_message(
                        ignore_subscribe_messages=True, timeout=0.05
                    )
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception("redis pubsub get_message failed; retrying")
                    await asyncio.sleep(0.5)
                    continue
                if message is None:
                    continue
                raw_channel = message.get("channel")
                raw_data = message.get("data")
                if not isinstance(raw_channel, bytes) or not isinstance(
                    raw_data, bytes
                ):
                    continue
                channel = raw_channel.decode()
                event = self._parse(raw_data.decode())
                if event is None:
                    continue
                await self._dispatch(channel, event)
        except asyncio.CancelledError:
            pass
        finally:
            if self._pubsub is not None:
                await self._pubsub.aclose()

    @staticmethod
    def _parse(raw: str) -> dict[str, Any] | None:
        import json

        try:
            parsed = json.loads(raw)
        except Exception:
            logger.warning("dropping malformed pubsub message: %.80s", raw)
            return None
        # A well-formed JSON scalar (a bare string, number, list) is still not
        # an event envelope. Discard it rather than letting the subscriber
        # raise on `.get`.
        if not isinstance(parsed, dict):
            logger.warning("dropping non-object pubsub message: %.80s", raw)
            return None
        return parsed

    async def _dispatch(self, channel: str, event: dict[str, Any]) -> None:
        for callback in list(self._handlers.get(channel, [])):
            try:
                await callback(channel, event)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("pubsub handler failed for channel %s", channel)

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        if self._listener_task is not None:
            self._listener_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._listener_task
        if self._pubsub is not None:
            with contextlib.suppress(Exception):
                await self._pubsub.aclose()
        if self._client is not None:
            with contextlib.suppress(Exception):
                await self._client.aclose()
        self._listener_task = None


class InMemoryPubSubBackend:
    """Zero-infra backend for dev and tests.

    Standard pub/sub semantics: a message published to a channel is delivered
    only to handlers that subscribed before the publish — same behaviour as
    Redis, just process-local.
    """

    def __init__(self) -> None:
        self._handlers: dict[str, list[EventHandler]] = {}

    async def subscribe(self, channel: str, callback: EventHandler) -> None:
        self._handlers.setdefault(channel, []).append(callback)

    async def publish(self, channel: str, message: str) -> None:
        import json

        event = json.loads(message)
        for callback in list(self._handlers.get(channel, [])):
            await callback(channel, event)

    async def close(self) -> None:
        self._handlers.clear()


class PubSubHub:
    """Facade: one shared hub per app; manages subscribers + a backend.

    Publishers (Agent 1/2 hook points) call ``publish``. The gateway calls
    ``subscribe``/``unsubscribe`` per connected repo.
    """

    def __init__(self, backend: PubSubBackend | None = None) -> None:
        self._backend = backend or InMemoryPubSubBackend()
        self._handlers: dict[str, list[EventHandler]] = {}
        self._counts: dict[tuple[str, EventHandler], int] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, repo_id: str, callback: EventHandler) -> None:
        channel = channel_for(repo_id)
        async with self._lock:
            key = (channel, callback)
            self._counts[key] = self._counts.get(key, 0) + 1
            if channel not in self._handlers:
                self._handlers[channel] = []
                await self._backend.subscribe(channel, self._route)
            if callback not in self._handlers[channel]:
                self._handlers[channel].append(callback)

    async def unsubscribe(self, repo_id: str, callback: EventHandler) -> None:
        channel = channel_for(repo_id)
        async with self._lock:
            key = (channel, callback)
            count = self._counts.get(key, 0)
            if count > 1:
                self._counts[key] = count - 1
                return
            self._counts.pop(key, None)
            handlers = self._handlers.get(channel)
            if handlers and callback in handlers:
                handlers.remove(callback)
            if not handlers:
                self._handlers.pop(channel, None)

    async def publish(
        self, repo_id: str, event_type: str, payload: dict[str, Any]
    ) -> None:
        channel = channel_for(repo_id)
        await self._backend.publish(channel, encode(event_type, payload))

    async def _route(self, channel: str, event: dict[str, Any]) -> None:
        for callback in list(self._handlers.get(channel, [])):
            try:
                await callback(channel, event)
            except Exception:
                logger.exception("hub handler failed for channel %s", channel)

    async def close(self) -> None:
        await self._backend.close()
        self._handlers.clear()

    @property
    def backend(self) -> PubSubBackend:
        return self._backend


# --- app-wide hub + convenience publishers ----------------------------------
# Agents 1/2 import these helpers from ``app.ws`` after the app calls
# ``configure_hub`` in its startup hook.

_hub: PubSubHub | None = None


def get_hub() -> PubSubHub:
    if _hub is None:
        raise RuntimeError(
            "ws pub/sub hub is not configured — call app.ws.configure_hub() at app startup"
        )
    return _hub


def configure_hub(
    *,
    redis_url: str = "redis://localhost:6379/0",
    in_memory: bool = False,
) -> PubSubHub:
    """Build the shared hub. ``in_memory=True`` short-circuits Redis (dev/tests)."""
    global _hub
    _hub = PubSubHub(
        backend=InMemoryPubSubBackend() if in_memory else RedisPubSubBackend(redis_url)
    )
    return _hub


def reset_hub() -> None:
    """Forget the configured hub (mainly for tests)."""
    global _hub
    _hub = None


async def close_hub() -> None:
    if _hub is not None:
        await _hub.close()


async def publish_snapshot_updated(repo_id: str, snapshot: dict[str, Any]) -> None:
    await get_hub().publish(
        repo_id, "snapshot:updated", {"repo_id": repo_id, "snapshot": snapshot}
    )


async def publish_review_new(repo_id: str, review: dict[str, Any]) -> None:
    await get_hub().publish(repo_id, "review:new", review)


async def publish_comment_new(repo_id: str, comment: dict[str, Any]) -> None:
    await get_hub().publish(repo_id, "comment:new", comment)
