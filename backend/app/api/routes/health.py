"""Liveness endpoint for Render probes and ops tooling."""

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Return process liveness plus the build marker.

    No auth and no DB touch on purpose: a probe should only answer "is this
    process alive", not whether the database is reachable (a DB outage already
    surfaces as 5xx on data routes). ``APP_VERSION`` is the live-build marker
    that deployment tooling and the docs use to confirm which build is running.
    """
    return {"status": "ok", "version": settings.APP_VERSION}
