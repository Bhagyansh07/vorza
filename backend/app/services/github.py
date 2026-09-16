"""GitHub OAuth + API client.

The backend never sees GitHub credentials from the browser: the frontend
redirects the user to GitHub, receives a `code`, and POSTs it here. This
module exchanges that code for an access token (scoped to read the user's
repos) and, later, uses the stored token to fetch repo metadata.
"""

import hashlib
import hmac
import secrets
from pathlib import Path

import httpx

from app.core.config import settings

GITHUB_OAUTH_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_BASE = "https://api.github.com"


class GithubOAuthError(Exception):
    """Raised when GitHub rejects an OAuth exchange or API call."""


class GithubRepoNotFound(Exception):
    """Raised when a requested repo does not exist or is not accessible."""


class GithubOAuthStateError(Exception):
    """Raised when the browser's `state` doesn't match the stored one."""


class GitHubCheckoutError(Exception):
    """Raised when a repo checkout cannot be cloned/refreshed on disk."""


def build_authorize_url() -> tuple[str, str]:
    """Return ``(authorize_url, state)`` for GitHub login.

    The ``state`` value is opaque, single-use, and HMAC-signed with the
    backend ``SECRET_KEY`` so the callback can verify it without server-side
    session storage. The frontend must echo it back in the callback request.
    """
    if not settings.GITHUB_CLIENT_ID:
        raise GithubOAuthError("GITHUB_CLIENT_ID is not configured")
    state = _new_oauth_state()
    params = httpx.QueryParams(
        {
            "client_id": settings.GITHUB_CLIENT_ID,
            "redirect_uri": settings.GITHUB_OAUTH_CALLBACK_URL,
            "scope": "read:user repo",
            "state": state,
        }
    )
    return f"{GITHUB_OAUTH_AUTHORIZE_URL}?{params}", state


def _new_oauth_state() -> str:
    nonce = secrets.token_urlsafe(24)
    digest = hmac.new(
        settings.SECRET_KEY.encode(), nonce.encode(), hashlib.sha256
    ).hexdigest()[:24]
    return f"{nonce}.{digest}"


def verify_oauth_state(state: str) -> bool:
    """``True`` only for a state we signed via ``_new_oauth_state``."""
    try:
        nonce, digest = state.rsplit(".", 1)
    except ValueError:
        return False
    expected = hmac.new(
        settings.SECRET_KEY.encode(), nonce.encode(), hashlib.sha256
    ).hexdigest()[:24]
    return hmac.compare_digest(digest, expected)


# ---------------------------------------------------------------------------
# OAuth token exchange + profile fetch
# ---------------------------------------------------------------------------


async def exchange_code_for_token(code: str) -> str:
    """Exchange a GitHub OAuth ``code`` for an access token.

    Raises ``GithubOAuthError`` if the exchange fails.
    """
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise GithubOAuthError("GitHub OAuth is not configured")
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GITHUB_OAUTH_TOKEN_URL,
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
            timeout=15,
        )
    if resp.status_code != 200:
        raise GithubOAuthError(f"Token exchange failed ({resp.status_code})")
    data = resp.json()
    if "error" in data:
        raise GithubOAuthError(data["error_description"] or data["error"])
    token = data.get("access_token")
    if not token:
        raise GithubOAuthError("No access_token in GitHub response")
    return token


async def fetch_github_user(access_token: str) -> dict:
    """Fetch the authenticated user's GitHub profile.

    Raises ``GithubOAuthError`` on failure.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API_BASE}/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            timeout=15,
        )
    if resp.status_code != 200:
        raise GithubOAuthError(f"GitHub profile fetch failed ({resp.status_code})")
    return resp.json()


# ---------------------------------------------------------------------------
# Repo metadata fetch
# ---------------------------------------------------------------------------


async def fetch_repo_metadata(access_token: str, github_full_name: str) -> dict:
    """Fetch repo metadata from GitHub to validate it exists and is accessible.

    Raises ``GithubRepoNotFound`` if the repo is not found, ``GithubOAuthError``
    on other failures.
    """
    url = f"{GITHUB_API_BASE}/repos/{github_full_name}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            timeout=15,
        )
    if resp.status_code == 404:
        raise GithubRepoNotFound(f"Repo {github_full_name} not found or not accessible")
    if resp.status_code >= 400:
        raise GithubOAuthError(
            f"GitHub returned {resp.status_code}: {resp.text[:200]}"
        )
    return resp.json()


# ---------------------------------------------------------------------------
# Webhook helpers
# ---------------------------------------------------------------------------


def verify_webhook_signature(
    payload: bytes, signature_header: str | None, secret: str
) -> bool:
    """Verify a GitHub webhook HMAC-SHA256 ``X-Hub-Signature-256`` header.

    Returns ``False`` instead of raising so the route can return 400 cleanly.
    """
    if not signature_header:
        return False
    expected = "sha256=" + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


# ---------------------------------------------------------------------------
# PR diff fetch
# ---------------------------------------------------------------------------

_GITHUB_DIFF_ACCEPT = "application/vnd.github.v3.diff"


def fetch_pull_request_diff(
    access_token: str, github_full_name: str, pr_number: int
) -> str:
    """Return the unified diff of a pull request from the GitHub API.

    Raises ``GithubOAuthError`` on network / auth failures.
    """
    url = f"{GITHUB_API_BASE}/repos/{github_full_name}/pulls/{pr_number}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": _GITHUB_DIFF_ACCEPT,
    }
    try:
        resp = httpx.get(url, headers=headers, timeout=30)
    except httpx.HTTPError as exc:
        raise GithubOAuthError(f"GitHub diff fetch failed: {exc}") from exc
    if resp.status_code == 404:
        raise GithubRepoNotFound(
            f"PR #{pr_number} not found in {github_full_name}"
        )
    if resp.status_code >= 400:
        raise GithubOAuthError(
            f"GitHub returned {resp.status_code}: {resp.text[:200]}"
        )
    return resp.text
