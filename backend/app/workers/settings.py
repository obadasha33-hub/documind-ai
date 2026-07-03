"""ARQ worker settings — registers background tasks."""

import structlog
from arq.connections import RedisSettings

from ..core.config import settings
from ..workers.tasks import process_document

logger = structlog.get_logger()


async def startup(ctx: dict) -> None:
    """Worker startup."""
    logger.info("ARQ worker starting up")


async def shutdown(ctx: dict) -> None:
    """Worker shutdown."""
    logger.info("ARQ worker shutting down")


class WorkerSettings:
    """ARQ worker configuration — discovered by `arq app.workers.settings.WorkerSettings`."""
    functions = [process_document]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs = 10
    job_timeout = 300  # 5 minutes max per job
    retry_jobs = True
    max_tries = 3
