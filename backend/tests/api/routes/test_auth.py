"""GitHub OAuth + /me."""

from fastapi.testclient import TestClient

from app.api.routes import auth as auth_routes
from app.core.config import settings
from app.services.github import GithubOAuthError, build_authorize_url
from tests.utils.user import authentication_token


def _signed_state(monkeypatch) -> str:
    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", "github-client-abc")
    _, state = build_authorize_url()
    return state


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
    from urllib.parse import parse_qs, urlparse

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

    from urllib.parse import parse_qs, urlparse

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
        json={"code": "one-time-code", "state": _signed_state(monkeypatch)},
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
        json={"code": "bad-code", "state": _signed_state(monkeypatch)},
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
