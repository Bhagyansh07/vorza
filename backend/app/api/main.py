from fastapi import APIRouter

from app.api.routes import analysis, auth, comments, repos, webhooks

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(repos.router)
api_router.include_router(analysis.router)
api_router.include_router(comments.router)
api_router.include_router(webhooks.router)
