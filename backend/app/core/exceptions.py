"""Custom exception classes and global exception handlers."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import structlog

logger = structlog.get_logger()


class DocuMindError(Exception):
    """Base exception for DocuMind AI."""

    def __init__(self, message: str, status_code: int = 500, detail: str | None = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(message)


class NotFoundError(DocuMindError):
    """Resource not found."""

    def __init__(self, resource: str, identifier: str):
        super().__init__(
            message=f"{resource} not found",
            status_code=404,
            detail=f"{resource} with id '{identifier}' does not exist",
        )


class ForbiddenError(DocuMindError):
    """Access denied."""

    def __init__(self, message: str = "Access denied"):
        super().__init__(message=message, status_code=403)


class RateLimitError(DocuMindError):
    """Rate limit exceeded."""

    def __init__(self, limit: int, period: str = "day"):
        super().__init__(
            message=f"Rate limit exceeded: {limit} requests per {period}",
            status_code=429,
        )


class DocumentProcessingError(DocuMindError):
    """Document processing failed."""

    def __init__(self, document_id: str, reason: str):
        super().__init__(
            message="Document processing failed",
            status_code=422,
            detail=f"Document '{document_id}': {reason}",
        )


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers."""

    @app.exception_handler(DocuMindError)
    async def documind_error_handler(request: Request, exc: DocuMindError) -> JSONResponse:
        logger.warning(
            "DocuMind error",
            error=exc.message,
            status=exc.status_code,
            path=str(request.url),
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.message, "detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "Unhandled error",
            error=str(exc),
            path=str(request.url),
            exc_info=True,
        )
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"},
        )
