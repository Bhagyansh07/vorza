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
    from app.ws.pubsub import configure_hub

    ensure_schema(engine)
    # Bind the persistent comment store. init_runtime() leaves the in-memory
    # DummyCommentStore bound when called with no argument, so comments posted
    # from the graph were broadcast to other viewers and then dropped.
    init_runtime(SqlCommentStore())
    # The pub/sub hub has to exist before anything publishes or a socket
    # connects, or get_hub() raises RuntimeError and the first analyze marks
    # itself failed at the broadcast step. No REDIS_URL -> in-process hub,
    # which is right for a single instance; set REDIS_URL to fan out.
    configure_hub(in_memory=not settings.REDIS_URL, redis_url=settings.REDIS_URL)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Vorza backend \u2014 GitHub OAuth, repo management, analysis "
        "snapshots, comment pins and PR webhooks."
    ),
    version=settings.APP_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
)

# CORS. FRONTEND_HOST plus the product's aliases and deployment hosts.
# GitHub OAuth starts with the login grant fetch from the browser, so an
# origin serving the app that is missing from this list gets CORS-blocked and
# "Continue with GitHub" never reaches GitHub. Keep CORS_ORIGINS in
# app/core/config.py in sync with the live domains.
_cors_origins = [
    settings.FRONTEND_HOST,
    *(origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()),
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    # Preview/deployment URLs (vorza-<hash>-bhagyansh.vercel.app) rotate per
    # deploy; a regex keeps previews working without editing the allowlist.
    allow_origin_regex=r"^https://vorza-[a-z0-9]+-bhagyansh\.vercel\.app$",
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
