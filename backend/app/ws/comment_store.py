"""Persistence hook for ``comment:new``.

Rule 1 in AGENTS.md: the gateway must not write to Agent 1's models directly.
So the gateway persists comments through a ``CommentStore`` it receives. A
pluggable default (``DummyCommentStore``) keeps the pipeline runnable before
Agent 1's API/model lands; Agent 1 swaps in the real store (see STATUS.md).
"""

from __future__ import annotations

import logging
import uuid
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

logger = logging.getLogger(__name__)

NEW_COMMENT_FIELDS = {"repo_id", "snapshot_id", "file_path", "author_id", "body", "x", "y"}


class CommentStore(Protocol):
    async def create(self, comment: dict[str, Any]) -> dict[str, Any]: ...


@dataclass
class DummyCommentStore:
    """Validates input, stamps id/created_at, keeps an in-memory copy for tests.

    This is the *fallback* until Agent 1 exposes a real comment-store endpoint
    or service. It still enforces the contract shape so the gateway never
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