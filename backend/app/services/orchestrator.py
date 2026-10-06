"""Orchestrator: the glue between thin routes, the DB, and the pure pipeline.

Incoming HTTP routes deliberately stay thin (ownership checks + queueing only)
and the *pure* analysis/AI services deliberately keep zero DB/network side
effects so they stay unit-testable in isolation (Agent 2's DoD). This module
owns the I/O that neither layer should touch:

- resolving a ``Repo`` row + its owner's stored GitHub token from the DB,
- cloning/refreshing a durable local checkout so cheap re-runs never need a
  fresh network round-trip or a fresh DB insert,
- feeding the checkout path into the pure pipeline, and
- persisting the resulting ``AnalysisSnapshot`` / ``AiReviewRow`` rows.

Because routes only hand us ids, every function here opens its own short-lived
session instead of borrowing the request-scoped one -- which is exactly what
makes them safe to run inside FastAPI ``BackgroundTasks``.
"""

from __future__ import annotations

import logging
import uuid

from sqlmodel import Session

from app.core.db import engine
from app.models.repo import Repo
from app.models.snapshot import AiReviewRow
from app.models.snapshot import AnalysisSnapshot as AnalysisSnapshotRow
from app.models.snapshot import FileNode as FileNodeRow
from app.services.ai_review import AiReviewError, OpenAIReviewClient, review_pr
from app.services.analysis import analyze_repo as _pure_analyze
from app.services.github import fetch_pull_request_diff
from app.services.pipeline import (
    RepoCheckoutError,
    _ensure_checkout,
    _resolve_repo_and_token,
)
from app.ws.pubsub import publish_review_new, publish_snapshot_updated

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Analyze (POST /repos/{repo_id}/analyze background task)
# ------------------------------------------------------------------


def _record_analyze_error(repo_id: uuid.UUID, message: str) -> None:
    """Persist why the latest analyze attempt failed for the UI to surface."""
    try:
        with Session(engine) as session:
            repo = session.get(Repo, repo_id)
            if repo is not None:
                repo.last_analyze_error = message[:1000]
                session.add(repo)
                session.commit()
    except Exception:
        logger.exception("orchestrator: could not record analyze error for %s", repo_id)


def _clear_analyze_error(repo_id: uuid.UUID) -> None:
    try:
        with Session(engine) as session:
            repo = session.get(Repo, repo_id)
            if repo is not None and repo.last_analyze_error:
                repo.last_analyze_error = None
                session.add(repo)
                session.commit()
    except Exception:
        logger.exception("orchestrator: could not clear analyze error for %s", repo_id)


async def analyze_repo(repo_id: uuid.UUID) -> None:
    """Resolve repo, ensure checkout, run pure analysis, persist snapshot.

    Opens its own short-lived session -- safe for BackgroundTasks.
    """
    logger.info("orchestrator.analyze_repo(%s): starting", repo_id)
    try:
        with Session(engine) as session:
            repo, token = _resolve_repo_and_token(repo_id, session)

        checkout_path = _ensure_checkout(repo, token)

        # Pure compute -- no DB, no network
        snapshot = _pure_analyze(checkout_path)

        with Session(engine) as session:
            db_snapshot = AnalysisSnapshotRow(
                repo_id=repo_id,
                overall_health_score=snapshot.overall_health_score,
                # Two FileNode types exist on purpose: services.schemas is the
                # DB-free domain shape, models.snapshot is the JSON column type.
                # Validate at this boundary so a field added to one and not the
                # other fails here -- then store the *dumped dicts*, not the
                # FileNode objects. The JSON column serializes with json.dumps
                # and pydantic models are not JSON serializable; storing the
                # models made every non-empty analyze fail on Postgres with
                # "TypeError: Object of type FileNode is not JSON serializable".
                files=[
                    FileNodeRow.model_validate(f).model_dump(mode="json")
                    for f in snapshot.files
                ],
            )
            session.add(db_snapshot)
            session.commit()
            session.refresh(db_snapshot)

        _clear_analyze_error(repo_id)

        # Tell every open graph about the new snapshot. The broadcast is a
        # nicety, not the success signal: the snapshot is already committed, so
        # a failed publish must not fall into the error handler and overwrite
        # the cleared last_analyze_error with a red banner over a good map.
        try:
            await publish_snapshot_updated(
                str(repo_id), db_snapshot.model_dump(mode="json")
            )
        except Exception:
            logger.exception(
                "orchestrator.analyze_repo(%s): snapshot:updated broadcast failed",
                repo_id,
            )

        logger.info(
            "orchestrator.analyze_repo(%s): done (health=%.1f, files=%d)",
            repo.github_full_name,
            snapshot.overall_health_score,
            len(snapshot.files),
        )
    except RepoCheckoutError as exc:
        logger.error("orchestrator.analyze_repo(%s): %s", repo_id, exc)
        _record_analyze_error(repo_id, f"Checkout failed: {exc}")
    except Exception as exc:
        logger.exception("orchestrator.analyze_repo(%s): unexpected error", repo_id)
        detail = (
            f"{type(exc).__name__}: {exc}" if str(exc) else "Unexpected analysis error"
        )
        _record_analyze_error(repo_id, detail)


# ------------------------------------------------------------------
# PR Review (webhook background task)
# ------------------------------------------------------------------


async def review_pull_request(repo_id: uuid.UUID, pr_number: int) -> None:
    """Resolve repo, fetch diff, run AI review, persist result.

    Opens its own short-lived session -- safe for BackgroundTasks.
    """
    logger.info(
        "orchestrator.review_pull_request(%s, #%s): starting", repo_id, pr_number
    )
    try:
        with Session(engine) as session:
            repo, token = _resolve_repo_and_token(repo_id, session)

        diff = fetch_pull_request_diff(token, repo.github_full_name, pr_number)

        client = OpenAIReviewClient()
        if not client.configured:
            # Degrade loudly rather than failing opaquely further down. GitHub
            # has already accepted the webhook by this point, so the log is the
            # only place left to be honest about why nothing was reviewed.
            logger.warning(
                "orchestrator.review_pull_request(%s, #%s): skipped - no "
                "OPENAI_API_KEY configured, so this PR was not reviewed.",
                repo_id,
                pr_number,
            )
            return
        review = review_pr(diff, pr_number, client)

        with Session(engine) as session:
            review_row = AiReviewRow(
                repo_id=repo_id,
                pr_number=review.pr_number,
                risk_score=review.risk_score,
                summary=review.summary,
                flags=[f.model_dump() for f in review.flags],
                updated_files=review.updated_files,
                dropped_flags=review.dropped_flags,
            )
            session.add(review_row)
            session.commit()
            session.refresh(review_row)

        logger.info(
            "orchestrator.review_pull_request(%s, #%s): done (risk=%.1f)",
            repo.github_full_name,
            pr_number,
            review.risk_score,
        )

        # Broadcast the review. Same rule as the snapshot broadcast: the review
        # row is already committed, so a publish failure is logged, not raised
        # into the exception handlers that would blame the AI provider.
        try:
            await publish_review_new(str(repo_id), review.model_dump(mode="json"))
        except Exception:
            logger.exception(
                "orchestrator.review_pull_request(%s, #%s): review:new broadcast failed",
                repo_id,
                pr_number,
            )
    except RepoCheckoutError as exc:
        logger.error(
            "orchestrator.review_pull_request(%s, #%s): %s", repo_id, pr_number, exc
        )
    except AiReviewError as exc:
        # Previously collapsed into the generic handler, which made a missing
        # API key indistinguishable from a real provider fault: the webhook
        # answered 200 and nothing was ever reviewed. Name the cause.
        logger.error(
            "orchestrator.review_pull_request(%s, #%s): AI review failed (%s). "
            "Check OPENAI_API_KEY / OPENAI_MODEL if this says 'not set'.",
            repo_id,
            pr_number,
            exc,
        )
    except Exception:
        logger.exception(
            "orchestrator.review_pull_request(%s, #%s): unexpected error",
            repo_id,
            pr_number,
        )
