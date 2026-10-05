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
from app.models.snapshot import AiReviewRow, AnalysisSnapshot as AnalysisSnapshotRow
from app.services.analysis import analyze_repo as _pure_analyze
from app.services.ai_review import AiReviewError, OpenAIReviewClient, review_pr
from app.services.github import fetch_pull_request_diff
from app.services.pipeline import (
    RepoCheckoutError,
    _ensure_checkout,
    _resolve_repo_and_token,
)

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Analyze (POST /repos/{repo_id}/analyze background task)
# ------------------------------------------------------------------


def analyze_repo(repo_id: uuid.UUID) -> None:
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
                files=[f.model_dump() for f in snapshot.files],
            )
            session.add(db_snapshot)
            session.commit()
            session.refresh(db_snapshot)

        logger.info(
            "orchestrator.analyze_repo(%s): done (health=%.1f, files=%d)",
            repo.github_full_name,
            snapshot.overall_health_score,
            len(snapshot.files),
        )
    except RepoCheckoutError as exc:
        logger.error("orchestrator.analyze_repo(%s): %s", repo_id, exc)
    except Exception:
        logger.exception("orchestrator.analyze_repo(%s): unexpected error", repo_id)


# ------------------------------------------------------------------
# PR Review (webhook background task)
# ------------------------------------------------------------------


def review_pull_request(repo_id: uuid.UUID, pr_number: int) -> None:
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
