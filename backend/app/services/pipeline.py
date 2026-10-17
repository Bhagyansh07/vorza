"""Pipeline orchestration for connected repos.

Thin FastAPI routes (Agent 1) only resolve *who owns the repo*; the *pure*
services (Agent 2 — ``analysis.py``, ``ai_review.py``) stay DB/network-free so
they can be unit-tested in isolation. Something has to join the two halves
with real I/O — resolving the owner's stored GitHub token, cloning/refreshing
a durable on-disk checkout, running the pure pipeline, and persisting the
results. That job lives here and everywhere in this module.

Why an orchestrator at all instead of stuffing it into the routes?
- The routes already hand us a ``repo_id`` + optional ``pr_number``. The DB
  lookup, clone, and persistence span 15+ lines of I/O that would otherwise
  litter every endpoint.
- ``AnalysisSnapshot`` rows should never be written from a request-scoped
  session (FastAPI backgrounds die with the request). Opening our own session
  here makes this safe both in webhooks (``BackgroundTasks``) and the manual
  ``POST /repos/{id}/analyze`` trigger.

Every function in this module is safe as a ``BackgroundTasks``/``asyncio``
task and never leaks the request-scoped session or the GitHub token.
"""

from __future__ import annotations

import base64
import logging
import os
import re
import subprocess
import uuid
from pathlib import Path

from sqlmodel import Session, select

from app.core.config import settings
from app.models.repo import Repo
from app.models.user import User

logger = logging.getLogger(__name__)

# Persistent local checkouts, keyed by repo id, so re-analysis never needs a
# fresh clone (git churn windows survive across runs). Developer-visible and
# gitignored; see CONTRACTS.md "Analysis" storage section.
CHECKOUTS_DIR = Path(settings.REPO_CHECKOUTS_DIR).resolve()


class RepoCheckoutError(Exception):
    """Raised when a repo cannot be cloned or refreshed on disk."""


def _checkout_path(repo_id: uuid.UUID) -> Path:
    return CHECKOUTS_DIR / str(repo_id)


# Git repeats the failing remote URL in its error text, and vorza used to embed
# the access token in that URL. The message travels through
# ``Repo.last_analyze_error`` and is served by GET /repos, so a failed clone
# could publish a live credential. Both the URL shape and the subprocess
# timeout are handled here.
_CREDENTIAL_RE = re.compile(r"x-access-token:[^@\s]+@")


def _redact(text: str) -> str:
    """Replace an embedded git credential with a placeholder."""
    return _CREDENTIAL_RE.sub("x-access-token:***@", text)


def _checkout_env(access_token: str) -> dict[str, str]:
    """Environment that authenticates git without the token appearing in argv.

    A token on the command line shows up in process listings and in git's own
    error output. GitHub accepts ``x-access-token:<token>`` as basic auth, so
    the credential is passed as an http extraheader through the environment.
    """
    basic = base64.b64encode(f"x-access-token:{access_token}".encode()).decode()
    return {
        **os.environ,
        "GIT_CONFIG_COUNT": "1",
        "GIT_CONFIG_KEY_0": "http.extraheader",
        "GIT_CONFIG_VALUE_0": f"AUTHORIZATION: basic {basic}",
    }


def _git(
    args: list[str],
    cwd: Path,
    *,
    check: bool = True,
    env: dict[str, str] | None = None,
) -> str:
    """Run git, raise RepoCheckoutError on failure, return stdout."""
    try:
        result = subprocess.run(
            args, cwd=cwd, capture_output=True, text=True, timeout=600, env=env
        )
    except subprocess.TimeoutExpired as exc:
        # str(TimeoutExpired) repeats the argv, so it must not escape raw.
        raise RepoCheckoutError(_redact(f"git timed out: {exc}")) from None
    merged = _redact((result.stdout or "") + (result.stderr or ""))
    if check and result.returncode != 0:
        raise RepoCheckoutError(merged.strip() or "git command failed")
    return result.stdout or ""


def _ensure_checkout(repo: Repo, access_token: str) -> Path:
    """Clone once, then a cheap ``git fetch`` on every later run.

    The token is handed to git through the environment (see ``_checkout_env``)
    rather than the clone URL, because ``str()`` of a subprocess failure -- or
    of a ``TimeoutExpired`` -- includes the argv.
    """
    target = _checkout_path(repo.id)
    env = _checkout_env(access_token)
    if (target / ".git").exists():
        try:
            # cwd must be passed explicitly: _git() has no default, and a
            # missing argument raises TypeError, which `except
            # RepoCheckoutError` below does NOT catch. That made every refresh
            # after the initial clone fail hard instead of degrading.
            _git(
                ["git", "-C", str(target), "reset", "--quiet", "--hard", "HEAD"],
                target,
            )
            # The worktree remote carries no credentials, so a refresh has to
            # authenticate itself. Without this a private repo was never
            # actually re-fetched and got analysed on a stale checkout.
            _git(
                ["git", "-C", str(target), "pull", "--quiet", "--ff-only"],
                target,
                env=env,
            )
        except RepoCheckoutError as exc:
            logger.warning(
                "checkout refresh failed for %s: %s", repo.github_full_name, exc
            )
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        _git(
            [
                "git",
                "clone",
                "--quiet",
                "--depth=1",
                f"https://github.com/{repo.github_full_name}.git",
                str(target),
            ],
            target.parent,
            env=env,
        )
    except RepoCheckoutError as exc:
        raise RepoCheckoutError(
            f"could not clone {repo.github_full_name}: {exc}"
        ) from exc
    return target


def _resolve_repo_and_token(repo_id: uuid.UUID, session: Session) -> tuple[Repo, str]:
    """Look up a Repo row and its owner's stored GitHub token.

    Raises ``RepoCheckoutError`` when the repo is missing or the owner has
    no GitHub token -- safe to raise from a BackgroundTasks callback.
    """
    repo = session.exec(select(Repo).where(Repo.id == repo_id)).first()
    if not repo:
        raise RepoCheckoutError(f"Repo {repo_id} not found")
    owner = session.get(User, repo.owner_id)
    token = getattr(owner, "github_access_token", None)
    if not token:
        raise RepoCheckoutError(
            f"Owner of {repo.github_full_name} has no GitHub token — reconnect GitHub"
        )
    return repo, token
