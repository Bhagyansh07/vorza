"""GitHub OAuth + /me."""

from fastapi.testclient import TestClient

from app.api.routes import auth as auth_routes
from app.core.config import settings
from app.services.github import GithubOAuthError
from tests.utils.user import authentication_token


def test_github_login_returns_authorize_url(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "GITHUB_CLIENT_ID", "github-client-abc")
    response = client.get("/auth/github/login")
    assert response.status_code == 200
    body = response.json()["message"]
    assert "github.com/login/oauth/authorize" in body
    assert "github-client-abc" in body


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

    response = client.post("/auth/github/callback", json={"code": "one-time-code"})
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
    response = client.post("/auth/github/callback", json={"code": "bad-code"})
    assert response.status_code == 400


def test_me_requires_auth(client: TestClient):
    response = client.get("/me")
    assert response.status_code == 401


def test_me_returns_current_user(client: TestClient, db_session, user):
    headers = {"Authorization": f"Bearer {authentication_token(user)}"}
    response = client.get("/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["github_username"] == user.github_username