"""GitHub OAuth + /me."""

import hashlib
import hmac
import time
from datetime import UTC
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient
from sqlmodel import select

from app.api.routes import auth as auth_routes
from app.core.config import settings
from app.services.github import GithubOAuthError
from tests.utils.user import authentication_token


def _issued_state(client: TestClient, monkeypatch) -> str:
    """Walk the real login route and return the state it issued.

    States are minted with a DB row now (single-use store), so tests must not
    call ``build_authorize_url`` directly -- going through ``GET
    /auth/github/login`` is the path the browser actually uses and it persists
    the nonce.
    """
    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", "github-client-abc")
    resp = client.get("/auth/github/login")
    assert resp.status_code == 200
    query = parse_qs(urlparse(resp.json()["authorize_url"]).query)
    return query["state"][0]


def _sign_state(nonce: str, expiry_ts: int) -> str:
    """Craft a signature-valid state directly, for controlled scenarios.

    Only used to prove the store/expiry checks; a real state comes from the
    login route.
    """
    payload = f"{nonce}.{expiry_ts}"
    digest = hmac.new(
        settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()[:24]
    return f"{payload}.{digest}"


def test_github_login_returns_authorize_url(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", "github-client-abc")
    response = client.get("/auth/github/login")
    assert response.status_code == 200
    body = response.json()["authorize_url"]
    assert "github.com/login/oauth/authorize" in body
    assert "github-client-abc" in body


def test_github_login_reports_the_scopes_it_will_request(
    client: TestClient, monkeypatch
):
    """The grant must be reported, not asserted by the frontend.

    The login page used to say "read access and nothing else" in hardcoded JS.
    That was false -- `repo` is read and write -- and the frontend could not
    have detected it, because the value lived on the other side of the network.

    So the response carries it. This test is what stops the shape regressing
    back to a bare `Message`.
    """
    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", "github-client-abc")
    monkeypatch.setattr(settings, "GITHUB_OAUTH_SCOPES", "read:user repo")

    response = client.get("/auth/github/login")
    assert response.status_code == 200

    body = response.json()
    assert body["scopes"] == ["read:user", "repo"]
    # True, not silently omitted. GitHub documents `repo` as granting full
    # read *and write* access to repositories; see REQUIRED_SCOPES in
    # app/services/github.py.
    assert body["write_access"] is True

    # The reported scopes must be the ones actually in the URL, or the UI is
    # describing a different request than the one being made.
    query = parse_qs(urlparse(body["authorize_url"]).query)
    assert query["scope"] == ["read:user repo"]


def test_github_login_reports_no_write_for_a_read_only_scope(
    client: TestClient, monkeypatch
):
    """A narrower configured scope must actually narrow the request.

    This is the second half of the bug. `GITHUB_OAUTH_SCOPES` was declared in
    `.env.example`, `compose.yml` and `docker-compose.yml`, and read by no code
    at all -- the scope was hardcoded two functions away. An operator who set it
    to something read-only would have seen the old scopes anyway and had no way
    to notice.
    """
    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", "github-client-abc")
    monkeypatch.setattr(settings, "GITHUB_OAUTH_SCOPES", "read:user")

    response = client.get("/auth/github/login")
    assert response.status_code == 200
    body = response.json()

    assert body["scopes"] == ["read:user"]
    assert body["write_access"] is False

    query = parse_qs(urlparse(body["authorize_url"]).query)
    assert query["scope"] == ["read:user"]


def test_requested_scopes_falls_back_when_config_is_blank(monkeypatch):
    """An empty setting must not produce `scope=` with nothing after it.

    `scope=` is a malformed request rather than a safe one, so a blank value
    falls back to the documented defaults.
    """
    from app.services.github import requested_scopes

    monkeypatch.setattr(settings, "GITHUB_OAUTH_SCOPES", "")
    assert requested_scopes() == "read:user repo"

    monkeypatch.setattr(settings, "GITHUB_OAUTH_SCOPES", "   ")
    assert requested_scopes() == "read:user repo"


def test_configured_scopes_are_not_silently_widened(monkeypatch):
    """The operator's value is used verbatim, not merged with the defaults.

    Merging would make it impossible to request less than the defaults, which is
    the one thing someone editing this setting is plausibly trying to do.
    """
    from app.services.github import requested_scopes

    monkeypatch.setattr(settings, "GITHUB_OAUTH_SCOPES", "read:user gist")
    assert requested_scopes() == "read:user gist"


def test_github_login_not_configured(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", None)
    response = client.get("/auth/github/login")
    assert response.status_code == 503


def test_github_callback_creates_user(client: TestClient, monkeypatch):
    async def fake_exchange(code: str) -> str:
        return "github-access-token-1"

    async def fake_profile(token: str) -> dict:
        return {
            "id": 123456,
            "login": "bhagy",
            "email": "bhagy@example.com",
            "name": "Bhagy",
        }

    monkeypatch.setattr(auth_routes, "exchange_code_for_token", fake_exchange)
    monkeypatch.setattr(auth_routes, "fetch_github_user", fake_profile)

    response = client.post(
        "/auth/github/callback",
        json={"code": "one-time-code", "state": _issued_state(client, monkeypatch)},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]

    me = client.get("/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["github_username"] == "bhagy"
    assert me.json()["email"] == "bhagy@example.com"


def test_github_callback_invalid_code(client: TestClient, monkeypatch):
    async def fake_exchange(code: str) -> str:
        raise GithubOAuthError("bad_verification_code")

    monkeypatch.setattr(auth_routes, "exchange_code_for_token", fake_exchange)
    response = client.post(
        "/auth/github/callback",
        json={"code": "bad-code", "state": _issued_state(client, monkeypatch)},
    )
    assert response.status_code == 400


def test_me_requires_auth(client: TestClient):
    response = client.get("/me")
    assert response.status_code == 401


def test_me_returns_current_user(client: TestClient, db_session, user):
    headers = {"Authorization": f"Bearer {authentication_token(user)}"}
    response = client.get("/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["github_username"] == user.github_username


# ---------------------------------------------------------------------------
# OAuth state: single-use store (docs/01-audit.md R9)
# ---------------------------------------------------------------------------


def test_oauth_state_is_single_use(client: TestClient, monkeypatch):
    """A redeemed state cannot mint a second session."""

    async def fake_exchange(code: str) -> str:
        return "single-use-token"

    async def fake_profile(token: str) -> dict:
        return {"id": 424242, "login": "single", "email": "s@example.com", "name": "S"}

    monkeypatch.setattr(auth_routes, "exchange_code_for_token", fake_exchange)
    monkeypatch.setattr(auth_routes, "fetch_github_user", fake_profile)

    state = _issued_state(client, monkeypatch)

    first = client.post("/auth/github/callback", json={"code": "c", "state": state})
    assert first.status_code == 200

    # The same state, even with a fresh code, must now fail: its nonce was
    # atomically spent by the successful login above.
    second = client.post("/auth/github/callback", json={"code": "c", "state": state})
    assert second.status_code == 400


def test_callback_rejects_state_never_issued(client: TestClient, monkeypatch):
    """A signature-valid state that was never minted must be rejected.

    This is what makes the store load-bearing: HMAC alone would let a signed
    state through, and single-use is only real enforcement if the nonce has to
    have been issued in the first place.
    """
    state = _sign_state("never-issued", int(time.time()) + 600)
    response = client.post("/auth/github/callback", json={"code": "c", "state": state})
    assert response.status_code == 400


def test_callback_rejects_expired_state(client: TestClient, monkeypatch):
    """A time-boxed state is rejected once its signed expiry passes."""
    state = _sign_state("expired-nonce", int(time.time()) - 60)
    response = client.post("/auth/github/callback", json={"code": "c", "state": state})
    assert response.status_code == 400


def test_verify_oauth_state_expiry_bounds(monkeypatch):
    """The pure verifier checks signature, past expiry, and absurd futures."""
    from app.services.github import verify_oauth_state

    now = int(time.time())
    assert verify_oauth_state(_sign_state("n1", now - 60)) is False
    assert verify_oauth_state(_sign_state("n1", now + 600)) is True
    # A signed expiry two hours out is beyond anything this backend mints with
    # the default 10-minute TTL, so treat it as invalid rather than long-lived.
    assert verify_oauth_state(_sign_state("n1", now + 7200)) is False
    assert verify_oauth_state("not-a-state") is False


def test_state_survives_a_failed_exchange_for_retry(client: TestClient, monkeypatch):
    """A failed token exchange must not burn the state.

    The spend rides the callback's transaction, so when the exchange fails and
    the transaction rolls back, the user can retry with the same ``state``
    instead of being bounced back to GitHub for a brand-new one.
    """
    calls = {"n": 0}

    async def flaky_exchange(code: str) -> str:
        calls["n"] += 1
        if calls["n"] == 1:
            raise GithubOAuthError("bad_verification_code")
        return "retry-token"

    async def fake_profile(token: str) -> dict:
        return {"id": 777, "login": "retry", "email": "r@example.com", "name": "R"}

    monkeypatch.setattr(auth_routes, "exchange_code_for_token", flaky_exchange)
    monkeypatch.setattr(auth_routes, "fetch_github_user", fake_profile)

    state = _issued_state(client, monkeypatch)

    first = client.post("/auth/github/callback", json={"code": "c", "state": state})
    assert first.status_code == 400

    second = client.post("/auth/github/callback", json={"code": "c", "state": state})
    assert second.status_code == 200


def test_expired_states_are_purged_on_next_login(
    client: TestClient, monkeypatch, db_session
):
    """The store self-cleans (TTL cache): stale rows die on the next issuance."""
    from datetime import datetime, timedelta

    from app.models.oauth_state import OauthState
    from app.services.github import purge_expired_oauth_states

    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", "github-client-abc")
    db_session.add_all(
        [
            OauthState(
                nonce="stale-nonce",
                expires_at=datetime.now(UTC) - timedelta(minutes=5),
            ),
            OauthState(
                nonce="fresh-nonce",
                expires_at=datetime.now(UTC) + timedelta(minutes=5),
            ),
        ]
    )
    db_session.commit()

    assert purge_expired_oauth_states(db_session) == 1
    db_session.commit()

    remaining = db_session.exec(
        select(OauthState).where(OauthState.nonce == "stale-nonce")
    ).first()
    assert remaining is None
