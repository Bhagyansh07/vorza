"""Pub/sub hub + backend semantics (no Redis required — in-memory backend)."""

from __future__ import annotations

from typing import Any

import pytest

from app.ws import publish_comment_new, publish_review_new, publish_snapshot_updated
from app.ws.pubsub import (
    InMemoryPubSubBackend,
    PubSubHub,
    channel_for,
    get_hub,
    reset_hub,
)


def test_lifespan_configures_the_pubsub_hub() -> None:
    """Regression: the hub was never configured at startup.

    main's lifespan only called init_runtime(); nothing called
    configure_hub(), so get_hub() raised RuntimeError on the first real
    publish and the first analyze stored that RuntimeError as its error.
    """
    from fastapi.testclient import TestClient

    from app.main import app

    reset_hub()  # prove lifespan is what re-establishes the hub
    with TestClient(app):
        hub = get_hub()
    assert hub is not None
    assert hub.backend is not None


@pytest.mark.asyncio
async def test_events_reach_subscribers_on_the_repo_channel() -> None:
    hub = PubSubHub(backend=InMemoryPubSubBackend())
    received: list[dict[str, Any]] = []

    async def handler(channel: str, event: dict[str, Any]) -> None:
        received.append((channel, event))

    await hub.subscribe("repo-123", handler)
    await hub.publish(
        "repo-123", "snapshot:updated", {"repo_id": "repo-123", "snapshot": {"id": 1}}
    )

    assert len(received) == 1
    channel, event = received[0]
    assert channel == channel_for("repo-123")
    assert event["type"] == "snapshot:updated"
    await hub.close()


@pytest.mark.asyncio
async def test_publish_before_subscribe_is_lost_like_redis() -> None:
    hub = PubSubHub(backend=InMemoryPubSubBackend())
    received: list[dict[str, Any]] = []

    async def handler(channel: str, event: dict[str, Any]) -> None:
        received.append(event)

    await hub.publish("repo-123", "review:new", {"pr_number": 1})
    await hub.subscribe("repo-123", handler)
    assert received == []  # subscribe-then-publish semantics on purpose
    await hub.close()


@pytest.mark.asyncio
async def test_repos_are_isolated_channels() -> None:
    hub = PubSubHub(backend=InMemoryPubSubBackend())
    other: list[dict[str, Any]] = []

    async def handler(channel: str, event: dict[str, Any]) -> None:
        other.append(event)

    await hub.subscribe("repo-a", handler)
    await hub.publish(
        "repo-b", "snapshot:updated", {"repo_id": "repo-b", "snapshot": {}}
    )
    assert other == []
    await hub.close()


@pytest.mark.asyncio
async def test_unsubscribe_removes_handler() -> None:
    hub = PubSubHub(backend=InMemoryPubSubBackend())
    received: list[dict[str, Any]] = []

    async def handler(channel: str, event: dict[str, Any]) -> None:
        received.append(event["type"])

    await hub.subscribe("repo-1", handler)
    await hub.unsubscribe("repo-1", handler)
    await hub.publish("repo-1", "presence:cursor", {"user_id": "u", "x": 1, "y": 1})
    assert received == []
    await hub.close()


@pytest.mark.asyncio
async def test_configured_helpers_fire_module_hub_after_configure() -> None:
    from app.ws.pubsub import configure_hub

    hub = configure_hub(in_memory=True)
    received: list[dict[str, Any]] = []

    async def handler(channel: str, event: dict[str, Any]) -> None:
        received.append(event)

    await hub.subscribe("repo-9", handler)
    await publish_snapshot_updated("repo-9", {"id": 1})
    await publish_review_new("repo-9", {"pr_number": 7})
    await publish_comment_new("repo-9", {"id": "c1", "body": "hi"})

    types = [e["type"] for e in received]
    assert types == ["snapshot:updated", "review:new", "comment:new"]
    await close_hub_dev(hub)


async def close_hub_dev(hub: PubSubHub) -> None:
    await hub.close()
    reset_hub()
