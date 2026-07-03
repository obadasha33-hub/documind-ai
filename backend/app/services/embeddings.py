"""Embedding service — generate vector embeddings using Gemini API."""

import httpx
import structlog

from ..core.config import settings
from ._retry import with_retries

logger = structlog.get_logger()

GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent"


async def get_embedding(text: str) -> list[float]:
    """Generate an embedding vector for a single text using Gemini API.

    Retries with backoff on rate limits / transient upstream errors.
    """
    url = GEMINI_EMBED_URL.format(model=settings.GEMINI_EMBEDDING_MODEL)

    async def _call() -> list[float]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                params={"key": settings.GEMINI_API_KEY},
                json={
                    "content": {"parts": [{"text": text}]},
                    "outputDimensionality": settings.EMBEDDING_DIMENSIONS,
                },
            )
            response.raise_for_status()
            data = response.json()
        # Truncate to target dimensions if needed
        return data["embedding"]["values"][: settings.EMBEDDING_DIMENSIONS]

    return await with_retries(_call, op_name="gemini_embed")


async def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts.

    Fails loudly if any embedding cannot be produced (after retries) rather than
    silently inserting a zero vector, which would poison retrieval quality and
    make a document look "READY" while returning garbage matches.
    """
    embeddings: list[list[float]] = []
    for text in texts:
        embeddings.append(await get_embedding(text))
    return embeddings


async def embed_query(query: str) -> list[float]:
    """Embed a search query (same as get_embedding but semantically named)."""
    return await get_embedding(query)
