import uuid
from datetime import timedelta

from sqlmodel import Session

from app.core import security
from app.models import Repo, User


def create_user(
    session: Session,
    *,
    email: str | None = None,
    github_username: str | None = None,
    github_access_token: str = "test-github-token",
) -> User:
    """Create a user directly in the DB (no GitHub round-trip)."""
    username = github_username or f"user-{uuid.uuid4().hex[:8]}"
    user = User(
        email=email or f"{username}@example.com",
        github_username=username,
        github_access_token=github_access_token,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def authentication_token(user: User) -> str:
    return security.create_access_token(
        user.id, expires_delta=timedelta(minutes=30)
    )


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {authentication_token(user)}"}


def create_repo(
    session: Session,
    owner: User,
    github_full_name: str = "octocat/Hello-World",
) -> Repo:
    repo = Repo(owner_id=owner.id, github_full_name=github_full_name)
    session.add(repo)
    session.commit()
    session.refresh(repo)
    return repo