from datetime import timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Body, HTTPException, status
from sqlmodel import SQLModel, select

from app.api.deps import CurrentUser, SessionDep
from app.core import security
from app.core.config import settings
from app.models.user import Token, User, UserPublic
from app.services.github import (
    GithubOAuthError,
    build_authorize_url,
    exchange_code_for_token,
    fetch_github_user,
    granted_write_access,
    requested_scopes,
    verify_oauth_state,
)

router = APIRouter(tags=["auth"])


class GithubCallbackRequest(SQLModel):
    code: str
    state: str


class GithubAuthorize(SQLModel):
    """What ``GET /auth/github/login`` returns.

    ``authorize_url`` is what the browser is sent to. ``scopes`` and
    ``write_access`` are here so the consent copy on the login screen describes
    the grant this backend will actually ask GitHub for, instead of the
    frontend asserting a claim it cannot verify.

    Before this, the login page said "read access ... and nothing else" in
    hardcoded JS while the backend requested the ``repo`` scope -- which GitHub
    defines as read *and write*. The UI was making a security claim about a
    value that lived on the other side of the network.
    """

    authorize_url: str
    scopes: list[str]
    write_access: bool


@router.get("/auth/github/login")
def github_login() -> GithubAuthorize:
    """Return the GitHub authorize URL the frontend should redirect to.

    The URL includes an ``state`` parameter; the frontend must echo it back
    unchanged in ``POST /auth/github/callback``.

    **Shape change in v0.3.** This used to return ``Message``, i.e.
    ``{"message": "<url>"}``. It now returns ``GithubAuthorize`` with
    ``authorize_url``, ``scopes`` and ``write_access``.

    The reason is not tidiness. The login page told users they were granting
    "read access and nothing else" while the backend requested GitHub's ``repo``
    scope, which GitHub defines as full read **and write** access. The claim was
    hardcoded in the frontend and had no connection to the value the backend
    actually sent, so it was wrong and nothing could catch it. See
    ``CONTRACTS.md``.

    A frontend that has not migrated reads ``authorize_url`` as ``undefined``
    and fails visibly, which is the intended failure mode for a contract change.
    """
    try:
        authorize_url, _state = build_authorize_url()
    except GithubOAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth is not configured on the backend",
        ) from exc
    scopes = requested_scopes().split()
    return GithubAuthorize(
        authorize_url=authorize_url,
        scopes=scopes,
        write_access=granted_write_access(),
    )


@router.post("/auth/github/callback", response_model=Token)
async def github_callback(
    body: Annotated[GithubCallbackRequest, Body()],
    session: SessionDep,
) -> Token:
    """Exchange a GitHub OAuth code for a JWT; create the user if needed."""
    if not verify_oauth_state(body.state):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )
    try:
        github_token = await exchange_code_for_token(body.code)
        profile = await fetch_github_user(github_token)
    except GithubOAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub login failed: {exc}",
        ) from exc

    email = profile.get("email") or (
        f"{profile['id']}+{profile['login']}@users.noreply.github.com"
    )

    user = session.exec(
        select(User).where(User.github_username == profile["login"])
    ).first()
    if user is None:
        user = User(
            email=email,
            github_username=profile["login"],
            full_name=profile.get("name"),
            github_id=profile.get("id"),
            github_access_token=github_token,
        )
        session.add(user)
    else:
        user.email = email
        user.full_name = profile.get("name")
        user.github_id = profile.get("id")
        user.github_access_token = github_token
        session.add(user)
    session.commit()
    session.refresh(user)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return Token(
        access_token=security.create_access_token(
            user.id, expires_delta=access_token_expires
        )
    )


@router.get("/me", response_model=UserPublic)
def read_me(current_user: CurrentUser) -> Any:
    """Current user. See CONTRACTS.md: GET /me."""
    return current_user
