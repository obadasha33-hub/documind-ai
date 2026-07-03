"""Central API router — aggregates all sub-routers."""

from fastapi import APIRouter

from .health import router as health_router
from .auth import router as auth_router
from .documents import router as documents_router
from .chat import router as chat_router
from .billing import router as billing_router
from .usage import router as usage_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(billing_router, prefix="/billing", tags=["billing"])
api_router.include_router(usage_router, prefix="/usage", tags=["usage"])
