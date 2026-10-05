"""Typed helpers for SQLModel query construction.

SQLModel generates model classes whose fields are annotated with the *Python*
type of the value (``datetime | None``, ``str``, ...). A type checker therefore
sees ``Repo.connected_at`` as a plain optional ``datetime`` and rejects the
``.desc()`` call that ``order_by`` needs, even though at runtime the attribute
is a SQLAlchemy ``InstrumentedAttribute``.

Every other option is worse: renaming the field, disabling ``strict_optional``
for the whole package, or scattering ``# type: ignore[union-attr]`` at each
call site. These helpers state the workaround once, at a single boundary, so
it stays visible and greppable.

Usage::

    select(Repo).order_by(order_desc(Repo.connected_at))
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import asc, desc
from sqlalchemy.sql.elements import UnaryExpression

__all__ = ["order_asc", "order_desc"]


def order_desc(column: Any) -> UnaryExpression[Any]:
    """ORDER BY column DESC.

    The parameter is ``Any`` rather than ``InstrumentedAttribute`` because
    SQLModel annotates model fields with the *value* type, so a checker sees
    ``datetime | None`` at every call site and rejects the narrower parameter.
    That rejection is the exact mismatch this module exists to absorb; typing
    it ``Any`` documents the seam instead of scattering ignores across routes.
    """
    return desc(column)


def order_asc(column: Any) -> UnaryExpression[Any]:
    """ORDER BY column ASC. See :func:`order_desc` for the ``Any`` rationale."""
    return asc(column)
