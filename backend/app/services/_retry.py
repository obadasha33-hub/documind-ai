"""Async retry helper with exponential backoff for rate-limited HTTP APIs.

Gemini (15 RPM) and Groq (30 RPM) free tiers return 429 under load. Retrying
with backoff turns a transient rate-limit into a short wait instead of a hard
failure that marks a document FAILED or breaks a chat turn.
"""

import asyncio
import random
from typing import Awaitable, Callable, TypeVar

import httpx
import structlog

logger = structlog.get_logger()

T = TypeVar("T")

# HTTP statuses worth retrying: rate limit + transient upstream errors.
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


async def with_retries(
    func: Callable[[], Awaitable[T]],
    *,
    max_attempts: int = 4,
    base_delay: float = 1.0,
    max_delay: float = 20.0,
    op_name: str = "http_call",
) -> T:
    """Call ``func`` (a zero-arg coroutine factory) retrying on transient errors.

    Backoff is exponential with full jitter. If the upstream sends a
    ``Retry-After`` header on a 429, that value is honored when longer.
    """
    attempt = 0
    while True:
        attempt += 1
        try:
            return await func()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code not in _RETRYABLE_STATUS or attempt >= max_attempts:
                raise
            delay = _compute_delay(attempt, base_delay, max_delay)
            retry_after = _parse_retry_after(exc.response)
            if retry_after is not None:
                delay = max(delay, retry_after)
            logger.warning(
                "Retrying after retryable HTTP status",
                op=op_name, status=status_code, attempt=attempt, delay=round(delay, 2),
            )
            await asyncio.sleep(delay)
        except (httpx.TransportError, httpx.TimeoutException) as exc:
            if attempt >= max_attempts:
                raise
            delay = _compute_delay(attempt, base_delay, max_delay)
            logger.warning(
                "Retrying after transport error",
                op=op_name, error=str(exc), attempt=attempt, delay=round(delay, 2),
            )
            await asyncio.sleep(delay)


def _compute_delay(attempt: int, base_delay: float, max_delay: float) -> float:
    """Exponential backoff with full jitter."""
    capped = min(max_delay, base_delay * (2 ** (attempt - 1)))
    return random.uniform(0, capped)


def _parse_retry_after(response: httpx.Response) -> float | None:
    """Parse an integer-seconds Retry-After header, if present and valid."""
    raw = response.headers.get("Retry-After")
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None
