"""/health liveness endpoint: public, no DB touch, carries the build marker."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings


@pytest.mark.parametrize("path", ["/health", "/health/"])
def test_health_ok(client: TestClient, path: str) -> None:
    resp = client.get(path)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["version"] == settings.APP_VERSION


def test_health_needs_no_auth(client: TestClient) -> None:
    assert client.get("/health").status_code == 200
