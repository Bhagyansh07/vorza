import uuid

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep, get_owned_repo
from app.models.comment import Comment, CommentCreate, CommentPublic, CommentsPublic
from app.models.snapshot import AnalysisSnapshot

router = APIRouter(tags=["comments"])


@router.get("/repos/{repo_id}/comments", response_model=CommentsPublic)
def list_comments(
    repo_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> CommentsPublic:
    """Comment pins attached to a repo (newest first)."""
    get_owned_repo(session, repo_id, current_user)
    comments = session.exec(
        select(Comment)
        .where(Comment.repo_id == repo_id)
        .order_by(Comment.created_at.desc())
    ).all()
    return CommentsPublic(data=comments, count=len(comments))


@router.post(
    "/repos/{repo_id}/comments",
    response_model=CommentPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    repo_id: uuid.UUID,
    body: CommentCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> CommentPublic:
    """Create a comment pin at (x, y) on the given file."""
    repo = get_owned_repo(session, repo_id, current_user)
    if body.snapshot_id is not None:
        snapshot = session.get(AnalysisSnapshot, body.snapshot_id)
        if not snapshot or snapshot.repo_id != repo.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="snapshot_id does not belong to this repo",
            )
    comment = Comment(
        repo_id=repo.id,
        snapshot_id=body.snapshot_id,
        author_id=current_user.id,
        file_path=body.file_path,
        body=body.body,
        x=body.x,
        y=body.y,
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return comment