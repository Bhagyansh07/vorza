from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.core.security_headers import SecurityHeadersMiddleware
from app.ws.comment_store import SqlCommentStore
from app.ws.gateway import init_runtime, ws_router


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Bring the schema up to whatever is authoritative for this database.
    # `ensure_schema` hands control to Alembic when a revision is stamped and
    # only falls back to create_all for a database with no migrations at all --
    # see app/core/schema.py for why calling create_all unconditionally is what
    # let a wrong table name in 0001_initial go unnoticed for so long.
    from app.core.db import engine
    from app.core.schema import ensure_schema

    ensure_schema(engine)
    # Bind the persistent comment store. init_runtime() leaves the in-memory
    # DummyCommentStore bound when called with no argument, so comments posted
    # from the graph were broadcast to other viewers and then dropped.
    init_runtime(SqlCommentStore())
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Vorza backend \u2014 GitHub OAuth, repo management, analysis "
        "snapshots, comment pins and PR webhooks."
    ),
    version="0.1.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_HOST],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Added last so it wraps everything, including CORS preflight responses.
# Starlette applies middleware in reverse registration order, so the last one
# added is the outermost.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(ws_router)
