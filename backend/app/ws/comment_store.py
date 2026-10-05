"""Persistence hook for ``comment:new``.

Rule 1 in AGENTS.md: the gateway must not write to Agent 1's models directly.
So the gateway persists comments through a ``CommentStore`` it receives. A
pluggable default (``DummyCommentStore``) keeps the pipeline runnable before
Agent 1's API/model lands; Agent 1 swaps in the real store (see STATUS.md).
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Protocol

from sqlmodel import Session

logger = logging.getLogger(__name__)

NEW_COMMENT_FIELDS = {
    "repo_id",
    "snapshot_id",
    "file_path",
    "author_id",
    "body",
    "x",
    "y",
}


class CommentStore(Protocol):
    async def create(self, comment: dict[str, Any]) -> dict[str, Any]: ...


@dataclass
class DummyCommentStore:
    """Validates input, stamps id/created_at, keeps an in-memory copy for tests.

    This is the *fallback*. ``SqlCommentStore`` below is what ``app.main``
    actually binds. It still enforces the contract shape so the gateway never
    broadcasts malformed data.
    """

    comments: list[dict[str, Any]] = field(default_factory=list)

    async def create(self, comment: dict[str, Any]) -> dict[str, Any]:
        if not NEW_COMMENT_FIELDS.issubset(comment.keys()):
            missing = NEW_COMMENT_FIELDS - comment.keys()
            raise ValueError(f"comment is missing required fields: {sorted(missing)}")
        stored = {
            "id": str(uuid.uuid4()),
            "created_at": time.time(),
            **{field_name: comment[field_name] for field_name in NEW_COMMENT_FIELDS},
        }
        self.comments.append(stored)
        return stored


class SqlCommentStore:
    """The real store: comments posted from the graph land in the database.

    ``main.init_runtime`` binds this. Before that, ``DummyCommentStore`` stayed
    bound and every comment posted over the socket was broadcast to other
    viewers and then discarded -- it survived only in process memory, so it was
    invisible to the REST endpoints and gone on restart.

    Mirrors ``POST /repos/{id}/comments``: same validation, same 422 on a
    snapshot that belongs to another repo, so a comment created from either
    surface behaves identically.
    """

    async def create(self, comment: dict[str, Any]) -> dict[str, Any]:
        missing = NEW_COMMENT_FIELDS - comment.keys()
        if missing:
            raise ValueError(f"comment is missing required fields: {sorted(missing)}")

        # Imported here: app.ws must stay importable without pulling in the
        # models, per rule 1 of AGENTS.md.
        import uuid as _uuid

        from app.core.db import engine
        from app.models.comment import Comment, CommentPublic
        from app.models.snapshot import AnalysisSnapshot

        def _as_uuid(value: Any, label: str) -> _uuid.UUID:
            try:
                return _uuid.UUID(str(value))
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{label} is not a valid UUID: {value!r}") from exc

        repo_id = _as_uuid(comment["repo_id"], "repo_id")
        author_id = _as_uuid(comment["author_id"], "author_id")
        snapshot_id = _as_uuid(comment["snapshot_id"], "snapshot_id")

        body = comment["body"]
        if not isinstance(body, str) or not body.strip():
            raise ValueError("comment body must be a non-empty string")

        row = Comment(
            repo_id=repo_id,
            snapshot_id=snapshot_id,
            author_id=author_id,
            file_path=str(comment["file_path"]),
            body=body.strip(),
            x=float(comment["x"]),
            y=float(comment["y"]),
        )

        # Own session, like services/orchestrator.py: this runs off a websocket
        # handler, and a request-scoped session would not outlive the frame.
        with Session(engine) as session:
            snapshot = session.get(AnalysisSnapshot, snapshot_id)
            if snapshot is None or snapshot.repo_id != repo_id:
                # Same cross-repo guard as the REST route.
                raise ValueError("snapshot_id does not belong to this repo")
            session.add(row)
            session.commit()
            session.refresh(row)
            stored = CommentPublic.model_validate(row, from_attributes=True)

        return stored.model_dump(mode="json")
