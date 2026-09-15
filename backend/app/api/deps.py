import uuid
from collections.abc import Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlmodel import Session

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.models.repo import Repo
from app.models.user import TokenPayload, User

reusable_oauth2 = OAuth2PasswordBearer(tokenUrl="")


def get_db() -> Generator[Session]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


def get_current_user(session: SessionDep, token: TokenDep) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = session.get(User, uuid.UUID(token_data.sub))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_owned_repo(session: SessionDep, repo_id: uuid.UUID, user: User) -> Repo:
    """Fetch a repo that belongs to the current user, or 404.

    A repo that exists but belongs to someone else is indistinguishable from
    a missing one, so we never leak other users' repo ids.
    """
    repo = session.get(Repo, repo_id)
    if not repo or repo.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Repo not found")
    return repo