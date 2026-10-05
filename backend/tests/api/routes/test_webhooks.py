"""Regression tests for the webhook receiver's fail-closed behaviour.

Audit finding C1: `GITHUB_WEBHOOK_SECRET` used to ship a real-looking default
that the settings guard did not reject, so anyone who read the repo could forge a
signed webhook. The secret is now `None` by default and the route must refuse
rather than accept an unverifiable payload.
"""

import hashlib
import hmac
import json
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.config import settings


def _sign(payload: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _pr_payload(repo_name: str = "octocat/hello") -> bytes:
    return json.dumps(
        {
            "action": "opened",
            "number": 7,
            "pull_request": {"number": 7},
            "repository": {"full_name": repo_name},
        }
    ).encode()


def test_returns_503_when_secret_unconfigured(client: TestClient) -> None:
    """No secret configured -> 503, never a signature 'check' against nothing."""
    with patch.object(settings, "GITHUB_WEBHOOK_SECRET", None):
        resp = client.post(
            "/webhooks/github",
            content=_pr_payload(),
            headers={"X-GitHub-Event": "pull_request"},
        )
    assert resp.status_code == 503
    assert "not configured" in resp.json()["detail"].lower()


def test_rejects_bad_signature(client: TestClient) -> None:
    with patch.object(settings, "GITHUB_WEBHOOK_SECRET", "real-secret"):
        resp = client.post(
            "/webhooks/github",
            content=_pr_payload(),
            headers={
                "X-GitHub-Event": "pull_request",
                "X-Hub-Signature-256": "sha256=deadbeef",
            },
        )
    assert resp.status_code == 400


def test_rejects_missing_signature(client: TestClient) -> None:
    with patch.object(settings, "GITHUB_WEBHOOK_SECRET", "real-secret"):
        resp = client.post(
            "/webhooks/github",
            content=_pr_payload(),
            headers={"X-GitHub-Event": "pull_request"},
        )
    assert resp.status_code == 400


def test_valid_signature_on_unconnected_repo_is_ignored(
    client: TestClient,
) -> None:
    """A correctly signed event for a repo nobody connected is a no-op."""
    with patch.object(settings, "GITHUB_WEBHOOK_SECRET", "real-secret"):
        payload = _pr_payload("someone/nothing-connected")
        resp = client.post(
            "/webhooks/github",
            content=payload,
            headers={
                "X-GitHub-Event": "pull_request",
                "X-Hub-Signature-256": _sign(payload, "real-secret"),
            },
        )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"


def test_valid_signature_non_pr_event_is_ignored(client: TestClient) -> None:
    with patch.object(settings, "GITHUB_WEBHOOK_SECRET", "real-secret"):
        payload = _pr_payload()
        resp = client.post(
            "/webhooks/github",
            content=payload,
            headers={
                "X-GitHub-Event": "push",
                "X-Hub-Signature-256": _sign(payload, "real-secret"),
            },
        )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"


def test_signature_covers_the_exact_body(client: TestClient) -> None:
    """A signature for one body must not validate a mutated body."""
    with patch.object(settings, "GITHUB_WEBHOOK_SECRET", "real-secret"):
        original = _pr_payload()
        signature = _sign(original, "real-secret")
        mutated = original.replace(b'"number": 7', b'"number": 9')
        resp = client.post(
            "/webhooks/github",
            content=mutated,
            headers={
                "X-GitHub-Event": "pull_request",
                "X-Hub-Signature-256": signature,
            },
        )
    assert resp.status_code == 400


def test_settings_module_carries_no_hardcoded_secret() -> None:
    """Belt-and-braces: the shipped source must not contain the old literal."""
    import inspect

    from app.core import config as config_module

    assert "vorza-wbhook" not in inspect.getsource(config_module)
