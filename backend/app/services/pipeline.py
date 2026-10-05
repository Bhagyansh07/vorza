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

import logging
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


def _git(args: list[str], cwd: Path, *, check: bool = True) -> str:
    """Run git, raise RepoCheckoutError on failure, return stdout."""
    result = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=600)
    merged = (result.stdout or "") + (result.stderr or "")
    if check and result.returncode != 0:
        raise RepoCheckoutError(merged.strip() or "git command failed")
    return result.stdout or ""


def _ensure_checkout(repo: Repo, access_token: str) -> Path:
    """Clone once, then a cheap ``git fetch`` on every later run."""
    target = _checkout_path(repo.id)
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
            _git(["git", "-C", str(target), "pull", "--quiet", "--ff-only"], target)
        except RepoCheckoutError as exc:
            logger.warning(
                "checkout refresh failed for %s: %s", repo.github_full_name, exc
            )
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    authed_url = (
        f"https://x-access-token:{access_token}@github.com/{repo.github_full_name}.git"
    )
    try:
        _git(
            ["git", "clone", "--quiet", "--depth=1", authed_url, str(target)],
            target.parent,
        )
        # Persist the token-less remote so refreshes don't re-embed secrets
        # in the worktree config.
        _git(
            [
                "git",
                "-C",
                str(target),
                "remote",
                "set-url",
                "origin",
                f"https://github.com/{repo.github_full_name}.git",
            ],
            target,
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
