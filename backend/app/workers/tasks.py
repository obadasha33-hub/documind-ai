"""ARQ background tasks for document processing."""

import uuid
import structlog
from sqlalchemy import select

from ..core.database import async_session_factory
from ..models.document import Document, DocumentStatus
from ..models.chunk import Chunk
from ..models.embedding import Embedding
from ..models.usage import UsageRecord, UsageEvent
from ..services.parsers import parse_document
from ..services.chunking import chunk_pages
from ..services.embeddings import get_embeddings_batch
from ..services.storage import download_file

logger = structlog.get_logger()


async def process_document(ctx: dict, document_id: str) -> dict:
    """
    Background task: process an uploaded document.

    Pipeline: download -> parse -> chunk -> embed -> store
    """
    logger.info("Starting document processing", document_id=document_id)

    async with async_session_factory() as db:
        # 1. Load document
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()
        if not document:
            logger.error("Document not found", document_id=document_id)
            return {"status": "error", "message": "Document not found"}

        try:
            # Update status to processing
            document.status = DocumentStatus.PROCESSING
            await db.flush()

            # 2. Download file from R2
            file_content = await download_file(document.r2_key)

            # 3. Parse document
            pages = parse_document(file_content, document.file_type)
            if not pages:
                raise ValueError("No content extracted from document")

            # 4. Chunk text
            chunks = chunk_pages(pages)
            logger.info("Document chunked", document_id=document_id, num_chunks=len(chunks))

            # 5. Generate embeddings
            texts = [c["content"] for c in chunks]
            embeddings = await get_embeddings_batch(texts)

            # 6. Store chunks and embeddings
            for chunk_data, embedding in zip(chunks, embeddings):
                chunk = Chunk(
                    id=str(uuid.uuid4()),
                    document_id=document.id,
                    tenant_id=document.tenant_id,
                    content=chunk_data["content"],
                    chunk_index=chunk_data["chunk_index"],
                    metadata_=chunk_data.get("metadata"),
                )
                db.add(chunk)
                await db.flush()

                emb = Embedding(
                    id=str(uuid.uuid4()),
                    chunk_id=chunk.id,
                    tenant_id=document.tenant_id,
                    embedding=embedding,
                    model="gemini-embedding-001",
                )
                db.add(emb)

            # 7. Update document status
            document.status = DocumentStatus.READY
            document.chunk_count = len(chunks)

            # 8. Record usage
            usage = UsageRecord(
                id=str(uuid.uuid4()),
                tenant_id=document.tenant_id,
                event_type=UsageEvent.DOCUMENT_UPLOAD,
                quantity=1,
            )
            db.add(usage)

            embedding_usage = UsageRecord(
                id=str(uuid.uuid4()),
                tenant_id=document.tenant_id,
                event_type=UsageEvent.EMBEDDING,
                quantity=len(embeddings),
            )
            db.add(embedding_usage)

            await db.commit()

            logger.info(
                "Document processed successfully",
                document_id=document_id,
                chunks=len(chunks),
            )
            return {
                "status": "success",
                "document_id": document_id,
                "chunks": len(chunks),
            }

        except Exception as e:
            logger.error("Document processing failed", document_id=document_id, error=str(e))
            document.status = DocumentStatus.FAILED
            document.error_message = str(e)[:1000]
            await db.commit()
            return {"status": "error", "message": str(e)}
