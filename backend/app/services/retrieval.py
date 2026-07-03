"""Hybrid retrieval service — vector similarity + full-text search with RRF."""

import structlog
from sqlalchemy import select, text, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.chunk import Chunk
from ..models.embedding import Embedding
from ..models.document import Document
from ..services.embeddings import embed_query
from ..core.config import settings

logger = structlog.get_logger()


async def hybrid_search(
    query: str,
    tenant_id: str,
    db: AsyncSession,
    top_k: int = 5,
    vector_weight: float = 0.7,
    text_weight: float = 0.3,
) -> list[dict]:
    """
    Perform hybrid search combining vector similarity and full-text search.

    Returns ranked results with source information.
    """
    # 1. Get query embedding
    query_embedding = await embed_query(query)

    # 2. Vector similarity search
    vector_results = await db.execute(
        select(
            Chunk.id,
            Chunk.content,
            Chunk.document_id,
            Chunk.chunk_index,
            Chunk.metadata_,
            Document.filename,
            (Embedding.embedding.cosine_distance(query_embedding)).label("vector_distance"),
        )
        .join(Embedding, Embedding.chunk_id == Chunk.id)
        .join(Document, Document.id == Chunk.document_id)
        .where(
            Chunk.tenant_id == tenant_id,
            Embedding.tenant_id == tenant_id,
        )
        .order_by("vector_distance")
        .limit(top_k * 2)
    )

    vector_rows = vector_results.all()

    # 3. Full-text search
    fts_query = " & ".join(query.split())
    text_results = await db.execute(
        select(
            Chunk.id,
            Chunk.content,
            Chunk.document_id,
            Chunk.chunk_index,
            Chunk.metadata_,
            Document.filename,
            sa_func.ts_rank(
                sa_func.to_tsvector("english", Chunk.content),
                sa_func.plainto_tsquery("english", query),
            ).label("text_rank"),
        )
        .join(Document, Document.id == Chunk.document_id)
        .where(
            Chunk.tenant_id == tenant_id,
            sa_func.to_tsvector("english", Chunk.content).op("@@")(
                sa_func.plainto_tsquery("english", query)
            ),
        )
        .order_by(sa_func.ts_rank(
            sa_func.to_tsvector("english", Chunk.content),
            sa_func.plainto_tsquery("english", query),
        ).desc())
        .limit(top_k * 2)
    )

    text_rows = text_results.all()

    # 4. Reciprocal Rank Fusion (RRF)
    chunk_scores: dict[str, dict] = {}

    for rank, row in enumerate(vector_rows):
        chunk_id = str(row.id)
        score = vector_weight / (rank + 60)  # RRF constant k=60
        if chunk_id not in chunk_scores:
            chunk_scores[chunk_id] = {
                "chunk_id": chunk_id,
                "content": row.content,
                "document_id": str(row.document_id),
                "document_name": row.filename,
                "page": (row.metadata_ or {}).get("page"),
                "chunk_index": row.chunk_index,
                "vector_score": 1.0 - float(row.vector_distance),
                "text_score": 0.0,
                "score": 0.0,
            }
        chunk_scores[chunk_id]["score"] += score
        chunk_scores[chunk_id]["vector_score"] = 1.0 - float(row.vector_distance)

    for rank, row in enumerate(text_rows):
        chunk_id = str(row.id)
        score = text_weight / (rank + 60)
        if chunk_id not in chunk_scores:
            chunk_scores[chunk_id] = {
                "chunk_id": chunk_id,
                "content": row.content,
                "document_id": str(row.document_id),
                "document_name": row.filename,
                "page": (row.metadata_ or {}).get("page"),
                "chunk_index": row.chunk_index,
                "vector_score": 0.0,
                "text_score": float(row.text_rank) if row.text_rank else 0.0,
                "score": 0.0,
            }
        chunk_scores[chunk_id]["score"] += score
        chunk_scores[chunk_id]["text_score"] = float(row.text_rank) if row.text_rank else 0.0

    # 5. Sort by combined score
    results = sorted(chunk_scores.values(), key=lambda x: x["score"], reverse=True)
    return results[:top_k]
