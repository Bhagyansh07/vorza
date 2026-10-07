"""GitHub OAuth + API client.

The backend never sees GitHub credentials from the browser: the frontend
redirects the user to GitHub, receives a `code`, and POSTs it here. This
module exchanges that code for an access token (scoped to read the user's
repos) and, later, uses the stored token to fetch repo metadata.
"""

import hashlib
import hmac
import secrets
import time
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import httpx
from sqlalchemy import delete as sql_delete
from sqlalchemy.engine import CursorResult
from sqlmodel import Session, SQLModel

from app.core.config import settings
from app.models.oauth_state import OauthState

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


#: Scopes Vorza needs. `read:user` reads the signed-in user's profile (login
#: and avatar). `repo` is what lets the analysis pipeline clone a repository
#: over HTTPS.
#:
#: `repo` is *not* a read-only scope. GitHub documents it as "full access to
#: public and private repositories including read and write access to code,
#: commit statuses, repository invitations, collaborators, deployment statuses,
#: and repository webhooks" -- verified against
#: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
#:
#: Vorza only ever *uses* it to read (clone, `GET /user`, `GET /repos/{name}`,
#: `GET /repos/{name}/pulls/{n}`), but the grant is broader than the use. There
#: is no OAuth scope that clones a repo without write access to it; a GitHub App
#: with fine-grained read-only permissions is the way to narrow this, and is
#: filed as F14. Until then the consent copy must say what is actually granted
#: rather than the narrower thing that would read better.
REQUIRED_SCOPES = ("read:user", "repo")

#: Scopes that grant write access, used by the consent copy so the UI cannot
#: drift from the actual grant. Anything in here must be disclosed as write.
WRITE_SCOPES = frozenset({"repo"})


def requested_scopes() -> str:
    """The scope string sent to GitHub, space-separated.

    Reads ``settings.GITHUB_OAUTH_SCOPES`` rather than hardcoding it. The
    setting existed and was documented in three places (``.env.example``,
    ``compose.yml``, ``docker-compose.yml``) but no code ever read it, so
    changing it had no effect -- the value was hardcoded two functions away. An
    operator who set it to something narrower would have seen the old scopes
    anyway and had no way to tell.

    The configured value is used as-is rather than merged with
    ``REQUIRED_SCOPES``: an operator narrowing the scopes must not silently get
    them added back.
    """
    configured = (settings.GITHUB_OAUTH_SCOPES or "").strip()
    return configured or " ".join(REQUIRED_SCOPES)


def granted_write_access() -> bool:
    """Whether the configured scopes include write access to repositories.

    The frontend asks the backend rather than hardcoding an answer, so the
    consent copy on ``/login`` and the scope actually sent to GitHub cannot
    disagree.
    """
    return bool(WRITE_SCOPES & set(requested_scopes().split()))


def build_authorize_url(session: Session) -> tuple[str, str]:
    """Return ``(authorize_url, state)`` for GitHub login.

    The ``state`` value is ``<nonce>.<expiry_epoch>.<hmac>`` -- HMAC-signed with
    the backend ``SECRET_KEY`` and time-stamped, so the callback can verify it
    without server-side session storage, and reject a stale state before it ever
    touches the store. The frontend must echo it back in the callback request.

    The issued nonce is also recorded in ``oauthstate`` (with an expiry), so the
    callback can spend it exactly once. ``consume_oauth_state`` deletes the row
    and only a delete that removed a row counts as a successful redemption; a
    state never issued, or already spent, fails the callback.

    The ``scope`` parameter comes from :func:`requested_scopes`, which defaults
    to ``read:user repo``. Note that ``repo`` includes **write** access to
    repositories; see ``REQUIRED_SCOPES`` above. It is needed to clone, and
    Vorza does not use the write half -- but the grant is what the user accepts,
    so the UI must describe it accurately.

    What this gives us, and the request it answers (docs/01-audit.md R9):

    - **Single-use.** The nonce is spent when a login session is created; a
      twice-redeemed ``state`` fails verification. A failed token exchange rolls
      back with the session transaction, so the state stays usable for a retry
      -- a captured pair can still never mint two sessions.
    - **Time-boxed.** The expiry is part of the signed value, so a captured
      ``state`` is rejected once that window passes even if the store row were
      somehow still around.

    The store self-cleans: stale rows are purged on every issuance ("TTL
    cache"), which keeps the table small without a scheduled job.
    """
    if not settings.GITHUB_CLIENT_ID:
        raise GithubOAuthError("GITHUB_CLIENT_ID is not configured")
    purge_expired_oauth_states(session)
    state, nonce = _new_oauth_state()
    session.add(
        OauthState(
            nonce=nonce,
            expires_at=datetime.now(UTC)
            + timedelta(minutes=settings.OAUTH_STATE_TTL_MINUTES),
        )
    )
    session.commit()
    params = httpx.QueryParams(
        {
            "client_id": settings.GITHUB_CLIENT_ID,
            "redirect_uri": settings.GITHUB_OAUTH_CALLBACK_URL,
            "scope": requested_scopes(),
            "state": state,
        }
    )
    return f"{GITHUB_OAUTH_AUTHORIZE_URL}?{params}", state


def _new_oauth_state() -> tuple[str, str]:
    """Mint ``(state, nonce)`` where state is ``<nonce>.<expiry>.<digest>``.

    ``expiry`` is the sign-out time as a Unix epoch, signed together with the
    nonce so it cannot be tampered with without the ``SECRET_KEY``.
    """
    nonce = secrets.token_urlsafe(24)
    expiry = int(time.time()) + settings.OAUTH_STATE_TTL_MINUTES * 60
    payload = f"{nonce}.{expiry}"
    digest = hmac.new(
        settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()[:24]
    return f"{payload}.{digest}", nonce


def verify_oauth_state(state: str) -> bool:
    """``True`` only for an unsigned-tamper-proof, not-yet-expired state.

    Pure and stateless: checks the signature and the signed expiry only. Whether
    the nonce was actually issued and is still unspent is decided by
    :func:`consume_oauth_state`, which the callback calls after this passes.
    """
    try:
        nonce, expiry, digest = state.rsplit(".", 2)
    except ValueError:
        return False
    expected = hmac.new(
        settings.SECRET_KEY.encode(), f"{nonce}.{expiry}".encode(), hashlib.sha256
    ).hexdigest()[:24]
    if not hmac.compare_digest(digest, expected):
        return False
    try:
        expiry_ts = int(expiry)
    except ValueError:
        return False
    now = int(time.time())
    if expiry_ts < now:
        return False
    # A signed expiry can only be ours, and we never mint one more than TTL
    # minutes ahead. Rejecting absurd-looking futures is free hygiene against a
    # mis-signed value surviving a unit test's clock assumptions.
    if expiry_ts > now + settings.OAUTH_STATE_TTL_MINUTES * 60 + 60:
        return False
    return True


def consume_oauth_state(session: Session, state: str) -> bool:
    """Atomically spend ``state``'s nonce; ``True`` only if it was unspent.

    One ``DELETE`` that returns how many rows it removed. Two concurrent
    callbacks for the same ``state`` serialise at the database: exactly one sees
    ``rowcount == 1`` and proceeds, the other sees ``0`` and is rejected. The
    spend rides the callback's transaction, so a failed token exchange rolls it
    back -- the user can retry with the same ``state``, and two successful
    redemptions can never both happen.
    """
    try:
        nonce, _expiry, _digest = state.rsplit(".", 2)
    except ValueError:
        return False
    # sqlmodel's stubs do not expose `__table__` on model classes, so reach the
    # columns through the shared metadata (the table name derives from the
    # class: OauthState -> "oauthstate").
    oauth_table = SQLModel.metadata.tables["oauthstate"]
    result = cast(
        CursorResult[Any],
        session.execute(sql_delete(oauth_table).where(oauth_table.c.nonce == nonce)),
    )
    return (result.rowcount or 0) > 0


def purge_expired_oauth_states(session: Session) -> int:
    """Delete spent/expired nonce rows; returns how many were removed.

    Called on every issuance so the store stays bounded. Safe on Postgres and
    SQLite alike: the comparison is against a timezone-aware UTC timestamp and
    the columns are stored with ``DateTime(timezone=True)``.
    """
    oauth_table = SQLModel.metadata.tables["oauthstate"]
    result = cast(
        CursorResult[Any],
        session.execute(
            sql_delete(oauth_table).where(oauth_table.c.expires_at < datetime.now(UTC))
        ),
    )
    return result.rowcount or 0


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
    data: dict[str, Any] = resp.json()
    if "error" in data:
        # GitHub omits error_description on some failures, so fall back
        # rather than raising KeyError from inside an error path.
        raise GithubOAuthError(
            str(data.get("error_description") or data.get("error") or data["error"])
        )
    token = data.get("access_token")
    if not isinstance(token, str) or not token:
        raise GithubOAuthError("No access_token in GitHub response")
    return token


async def fetch_github_user(access_token: str) -> dict[str, Any]:
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
    return cast("dict[str, Any]", resp.json())


# ---------------------------------------------------------------------------
# Repo metadata fetch
# ---------------------------------------------------------------------------


async def fetch_repo_metadata(
    access_token: str, github_full_name: str
) -> dict[str, Any]:
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
        raise GithubOAuthError(f"GitHub returned {resp.status_code}: {resp.text[:200]}")
    return cast("dict[str, Any]", resp.json())


async def fetch_user_repos(access_token: str) -> list[dict[str, Any]]:
    """List GitHub repos the authenticated user can access, newest first.

    Used by the connect picker (`GET /github/repos`). Returns a small
    projection of each repo: enough to search and display, nothing that Vorza
    does not need. Raises ``GithubOAuthError`` on failure.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GITHUB_API_BASE}/user/repos",
            params={
                "affiliation": "owner,collaborator",
                "sort": "updated",
                "per_page": 100,
            },
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/json",
            },
            timeout=15,
        )
    if resp.status_code >= 400:
        raise GithubOAuthError(f"GitHub repo listing failed ({resp.status_code})")
    data: Any = resp.json()
    if not isinstance(data, list):
        raise GithubOAuthError("Unexpected GitHub response for repo listing")
    repos: list[dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict) or not item.get("full_name"):
            continue
        repos.append(
            {
                "full_name": item["full_name"],
                "private": bool(item.get("private")),
                "default_branch": str(item.get("default_branch") or "main"),
                "description": (item.get("description") or "")[:200],
                "language": item.get("language"),
                "updated_at": item.get("updated_at"),
            }
        )
    return repos


def verify_webhook_signature(
    payload: bytes, signature_header: str | None, secret: str
) -> bool:
    """Verify a GitHub webhook HMAC-SHA256 ``X-Hub-Signature-256`` header.

    Returns ``False`` instead of raising so the route can return 400 cleanly.
    """
    if not signature_header:
        return False
    expected = (
        "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    )
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
        raise GithubRepoNotFound(f"PR #{pr_number} not found in {github_full_name}")
    if resp.status_code >= 400:
        raise GithubOAuthError(f"GitHub returned {resp.status_code}: {resp.text[:200]}")
    return resp.text
