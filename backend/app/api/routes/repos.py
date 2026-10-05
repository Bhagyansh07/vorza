from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.core.sql import order_desc
from app.models.repo import Repo, RepoCreate, RepoPublic, ReposPublic
from app.services.github import (
    GithubOAuthError,
    GithubRepoNotFound,
    fetch_repo_metadata,
)

router = APIRouter(tags=["repos"])


@router.post("/repos", response_model=RepoPublic, status_code=status.HTTP_201_CREATED)
async def connect_repo(
    body: RepoCreate, session: SessionDep, current_user: CurrentUser
) -> RepoPublic:
    """Connect a new GitHub repo for the current user."""
    existing = session.exec(
        select(Repo).where(
            Repo.owner_id == current_user.id,
            Repo.github_full_name == body.github_full_name,
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This repo is already connected",
        )
    if not current_user.github_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Connect via GitHub login first",
        )
    try:
        metadata = await fetch_repo_metadata(
            current_user.github_access_token, body.github_full_name
        )
    except GithubRepoNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except GithubOAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    repo = Repo(
        owner_id=current_user.id,
        github_full_name=metadata.get("full_name", body.github_full_name),
        default_branch=metadata.get("default_branch", "main"),
    )
    session.add(repo)
    session.commit()
    session.refresh(repo)
    # Build the response explicitly rather than letting FastAPI coerce the ORM
    # row. `RepoPublic` is the contract in CONTRACTS.md; converting here means a
    # column added to `Repo` later cannot widen the API response by accident.
    return RepoPublic.model_validate(repo, from_attributes=True)


@router.get("/repos", response_model=ReposPublic)
def list_repos(session: SessionDep, current_user: CurrentUser) -> ReposPublic:
    """List the current user's connected repos."""
    repos = session.exec(
        select(Repo)
        .where(Repo.owner_id == current_user.id)
        .order_by(order_desc(Repo.connected_at))
    ).all()
    return ReposPublic(
        data=[RepoPublic.model_validate(r, from_attributes=True) for r in repos],
        count=len(repos),
    )
