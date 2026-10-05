"""Tests for the authentication dependency's failure modes.

The bug these pin: `uuid.UUID(token_data.sub)` sat outside the try/except.
`sub` is a plain string on `TokenPayload`, so a token that verified correctly
but carried `sub: "not-a-uuid"` passed JWT validation and then raised
`ValueError` while looking the user up. That reached the client as a 500 --
an unhandled server error on a request that is simply unauthenticated.

Audit: docs/audit/01-code-audit.md finding M8.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core import security
from app.core.config import settings
from tests.utils.user import auth_headers, create_user


def signed_token(payload: dict[str, object]) -> str:
    """A token the server itself signed, so JWT validation passes."""
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=security.ALGORITHM)


class TestMalformedSubject:
    def test_non_uuid_subject_is_403_not_500(self, client: TestClient) -> None:
        token = signed_token(
            {"sub": "not-a-uuid", "exp": datetime.now(UTC) + timedelta(hours=1)}
        )
        response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403, response.text

    @pytest.mark.parametrize(
        "subject",
        ["", "12345", "null", "../../etc/passwd", "550e8400-e29b-41d4-a716", " "],
    )
    def test_every_malformed_subject_shape_is_403(
        self, client: TestClient, subject: str
    ) -> None:
        token = signed_token(
            {"sub": subject, "exp": datetime.now(UTC) + timedelta(hours=1)}
        )
        response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403, response.text

    def test_missing_sub_is_403(self, client: TestClient) -> None:
        token = signed_token({"exp": datetime.now(UTC) + timedelta(hours=1)})
        response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403, response.text

    def test_subject_with_surrounding_whitespace_is_403(
        self, client: TestClient
    ) -> None:
        token = signed_token(
            {
                "sub": f"  {uuid.uuid4()}  ",
                "exp": datetime.now(UTC) + timedelta(hours=1),
            }
        )
        response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
        # uuid.UUID does not strip whitespace, so this must not 500.
        assert response.status_code == 403, response.text


class TestWellFormedSubject:
    def test_valid_user_still_resolves(
        self, client: TestClient, db_session: Session
    ) -> None:
        user = create_user(db_session)
        response = client.get("/me", headers=auth_headers(user))
        assert response.status_code == 200
        assert response.json()["github_username"] == user.github_username

    def test_valid_but_unknown_user_is_404_not_500(self, client: TestClient) -> None:
        """A well-formed sub for a user that does not exist is a 404."""
        token = signed_token(
            {"sub": str(uuid.uuid4()), "exp": datetime.now(UTC) + timedelta(hours=1)}
        )
        response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 404, response.text

    def test_expired_token_is_403(self, client: TestClient) -> None:
        token = signed_token(
            {"sub": str(uuid.uuid4()), "exp": datetime.now(UTC) - timedelta(hours=1)}
        )
        response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403, response.text

    def test_token_signed_with_the_wrong_key_is_403(self, client: TestClient) -> None:
        token = jwt.encode(
            {"sub": str(uuid.uuid4()), "exp": datetime.now(UTC) + timedelta(hours=1)},
            "a-different-secret-that-is-long-enough-to-satisfy-hs256",
            algorithm=security.ALGORITHM,
        )
        response = client.get("/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403, response.text


class TestNoCredentialAtAll:
    def test_missing_header_is_401(self, client: TestClient) -> None:
        # OAuth2PasswordBearer answers before the dependency body runs, so this
        # stays a 401 rather than becoming a 403 when the try block grew.
        response = client.get("/me")
        assert response.status_code == 401, response.text
