from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings
from app.core.rate_limit import RateLimitMiddleware
from app.core.security_headers import SecurityHeadersMiddleware
from app.ws.gateway import init_runtime, ws_router


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Ensure tables exist even when Alembic migrations never ran (Render free
    # tier falls back to SQLite and has no prestart hook). Idempotent — leaves a
    # Postgres schema untouched.
    from sqlmodel import SQLModel

    from app.core.db import engine

    SQLModel.metadata.create_all(engine)
    init_runtime()
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
