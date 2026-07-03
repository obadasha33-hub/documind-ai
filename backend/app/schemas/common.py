"""Common shared schemas."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list
