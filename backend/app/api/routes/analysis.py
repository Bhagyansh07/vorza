import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep, get_owned_repo
from app.models.snapshot import (
    AnalysisSnapshot,
    AnalysisSnapshotPublic,
    SnapshotsList,
    SnapshotSummary,
)
from app.services.orchestrator import analyze_repo

router = APIRouter(tags=["analysis"])


@router.get("/repos/{repo_id}/snapshots/latest", response_model=AnalysisSnapshotPublic)
def get_latest_snapshot(
    repo_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> AnalysisSnapshot:
    """Latest analysis snapshot — the force-directed map's graph data."""
    get_owned_repo(session, repo_id, current_user)
    snapshot = session.exec(
        select(AnalysisSnapshot)
        .where(AnalysisSnapshot.repo_id == repo_id)
        .order_by(AnalysisSnapshot.created_at.desc())
        .limit(1)
    ).first()
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No snapshot yet for this repo — trigger POST /repos/{id}/analyze",
        )
    return snapshot


@router.get("/repos/{repo_id}/snapshots/history", response_model=SnapshotsList)
def list_snapshots(
    repo_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> SnapshotsList:
    """Snapshot summaries for trend charts."""
    get_owned_repo(session, repo_id, current_user)
    snapshots = session.exec(
        select(AnalysisSnapshot)
        .where(AnalysisSnapshot.repo_id == repo_id)
        .order_by(AnalysisSnapshot.created_at.asc())
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
) -> dict:
    """Queue a manual re-analysis of a repo.

    Agent 2 implements `services.analysis.analyze_repo`; for now the stub
    just logs. The repo is ownership-checked up front so Agent 2's body only
    needs to analyze, never to authorize.
    """
    repo = get_owned_repo(session, repo_id, current_user)
    background_tasks.add_task(analyze_repo, repo.id)
    return {"message": "Analysis queued", "repo_id": str(repo.id)}