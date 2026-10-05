from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status
from sqlmodel import select

from app.api.deps import SessionDep
from app.core.config import settings
from app.models.repo import Repo
from app.services.orchestrator import review_pull_request
from app.services.github import verify_webhook_signature

router = APIRouter(tags=["webhooks"])

# pull_request actions that warrant review
REVIEWABLE_ACTIONS = {"opened", "synchronize", "reopened"}


@router.post("/webhooks/github")
async def github_webhook(
    request: Request,
    session: SessionDep,
    background_tasks: BackgroundTasks,
    x_github_event: str | None = Header(default=None),
    x_hub_signature_256: str | None = Header(default=None),
) -> dict:
    """GitHub PR webhook receiver (see CONTRACTS.md).

    Verifies the HMAC signature, then hands PR events to Agent 2's review
    pipeline entrypoint for every connected copy of that repo.
    """
    # Fail closed. Without a configured secret we cannot verify anything, and a
    # signature check against an empty/guessed secret is worse than no endpoint
    # at all -- it looks like it works.
    if not settings.GITHUB_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook receiver is not configured on this deployment",
        )

    payload = await request.body()
    if not verify_webhook_signature(
        payload, x_hub_signature_256, settings.GITHUB_WEBHOOK_SECRET
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature",
        )

    if x_github_event != "pull_request":
        return {"status": "ignored", "message": f"event {x_github_event!r} not handled"}

    try:
        event = await request.json()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    action = event.get("action")
    pr_number = (event.get("pull_request") or {}).get("number")
    repo_name = (event.get("repository") or {}).get("full_name")

    if action not in REVIEWABLE_ACTIONS or not repo_name or not pr_number:
        return {"status": "ignored", "message": "action not reviewable"}

    repos = session.exec(
        select(Repo).where(Repo.github_full_name == repo_name)
    ).all()
    if not repos:
        return {"status": "ignored", "message": "repo not connected"}

    for repo in repos:
        background_tasks.add_task(review_pull_request, repo.id, pr_number)
    return {
        "status": "ok",
        "repo": repo_name,
        "pr": pr_number,
        "reviews_queued": len(repos),
    }