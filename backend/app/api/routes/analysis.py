import hashlib
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response, status
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep, get_owned_repo
from app.core.sql import order_asc, order_desc
from app.models.snapshot import (
    AnalysisSnapshot,
    AnalysisSnapshotPublic,
    SnapshotsList,
    SnapshotSummary,
)
from app.services.orchestrator import analyze_repo

router = APIRouter(tags=["analysis"])


def _snapshot_etag(payload: AnalysisSnapshotPublic) -> str:
    """Strong ``ETag`` for a snapshot payload: quoted sha256 of the JSON.

    The full public payload is the cache key, so any change to the graph data,
    health scores or meta flips the tag and the next conditional GET re-sends.
    """
    digest = hashlib.sha256(payload.model_dump_json().encode("utf-8")).hexdigest()
    return f'"{digest}"'


@router.get("/repos/{repo_id}/snapshots/latest", response_model=AnalysisSnapshotPublic)
def get_latest_snapshot(
    repo_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    response: Response,
    request: Request,
) -> AnalysisSnapshotPublic | Response:
    """Latest analysis snapshot — the force-directed map's graph data.

    Supports conditional GET (docs/01-audit.md R10): every response carries a
    strong ``ETag`` for the full public payload, and an ``If-None-Match`` that
    equals it returns 304 so the bandwidth-heavy graph is not re-downloaded
    while nothing changed. The dashboard polls this endpoint with the tag.
    """
    get_owned_repo(session, repo_id, current_user)
    snapshot = session.exec(
        select(AnalysisSnapshot)
        .where(AnalysisSnapshot.repo_id == repo_id)
        .order_by(order_desc(AnalysisSnapshot.created_at))
        .limit(1)
    ).first()
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No snapshot yet for this repo — trigger POST /repos/{id}/analyze",
        )
    payload = AnalysisSnapshotPublic.model_validate(snapshot, from_attributes=True)
    etag = _snapshot_etag(payload)
    response.headers["ETag"] = etag
    if request.headers.get("If-None-Match") == etag:
        return Response(
            status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag}
        )
    return payload


@router.get("/repos/{repo_id}/snapshots/history", response_model=SnapshotsList)
def list_snapshots(
    repo_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> SnapshotsList:
    """Snapshot summaries for trend charts."""
    get_owned_repo(session, repo_id, current_user)
    snapshots = session.exec(
        select(AnalysisSnapshot)
        .where(AnalysisSnapshot.repo_id == repo_id)
        .order_by(order_asc(AnalysisSnapshot.created_at))
    ).all()
    summaries = [
        SnapshotSummary(
            id=s.id,
            repo_id=s.repo_id,
            created_at=s.created_at,
            overall_health_score=s.overall_health_score,
        )
        for s in snapshots
    ]
    return SnapshotsList(data=summaries, count=len(summaries))


@router.post(
    "/repos/{repo_id}/analyze",
    status_code=status.HTTP_202_ACCEPTED,
)
def trigger_analyze(
    repo_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, str]:
    """Queue a manual re-analysis of a repo.

    Agent 2 implements `services.analysis.analyze_repo`; for now the stub
    just logs. The repo is ownership-checked up front so Agent 2's body only
    needs to analyze, never to authorize.
    """
    repo = get_owned_repo(session, repo_id, current_user)
    background_tasks.add_task(analyze_repo, repo.id)
    return {"message": "Analysis queued", "repo_id": str(repo.id)}
