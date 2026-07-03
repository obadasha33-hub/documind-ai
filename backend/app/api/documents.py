"""Document API endpoints — upload, list, get, delete documents."""

import uuid

import structlog
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    UploadFile,
    File,
    HTTPException,
    status,
)
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from ..workers.tasks import process_document
from ..core.config import settings
from ..core.database import get_db
from ..core.deps import get_current_user, get_tenant_id
from ..models.document import Document, DocumentStatus
from ..models.tenant import Tenant, Plan
from ..models.user import User
from ..schemas.document import DocumentResponse, DocumentListResponse, DocumentUploadResponse
from ..services.storage import upload_file, delete_file

logger = structlog.get_logger()

router = APIRouter()

# ARQ connection pool disabled for native setup – processing is now synchronous


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> DocumentUploadResponse:
    """Upload a document for processing (PDF, DOCX, or Markdown)."""
    # Check file type
    allowed_types = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "text/markdown": "md",
        "text/plain": "md",
    }
    content_type = file.content_type or ""
    file_ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""

    file_type = allowed_types.get(content_type) or (file_ext if file_ext in ("pdf", "docx", "md") else None)
    if not file_type:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type or file_ext}. Allowed: PDF, DOCX, Markdown",
        )

    # Check document limit
    doc_count_result = await db.execute(
        select(sa_func.count(Document.id)).where(Document.tenant_id == tenant_id)
    )
    doc_count = doc_count_result.scalar() or 0

    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one()

    limits = {
        Plan.FREE: settings.FREE_DOCUMENTS_LIMIT,
        Plan.PRO: settings.PRO_DOCUMENTS_LIMIT,
        Plan.ENTERPRISE: 999999,
    }
    if doc_count >= limits.get(tenant.plan, settings.FREE_DOCUMENTS_LIMIT):
        raise HTTPException(
            status_code=403,
            detail=f"Document limit reached ({limits[tenant.plan]}). Upgrade your plan.",
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Enforce upload size limit
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file_size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({file_size // (1024 * 1024)}MB). "
                   f"Maximum is {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )

    # Create document record
    doc_id = str(uuid.uuid4())
    r2_key = f"{tenant_id}/{doc_id}/{file.filename}"

    document = Document(
        id=doc_id,
        tenant_id=tenant_id,
        filename=file.filename or "untitled",
        file_type=file_type,
        file_size=file_size,
        r2_key=r2_key,
        status=DocumentStatus.PROCESSING,
    )
    db.add(document)
    await db.flush()

    # Upload file to R2
    try:
        await upload_file(content, r2_key, content_type or "application/octet-stream")
    except Exception as e:
        logger.error("R2 upload failed", document_id=doc_id, error=str(e))
        document.status = DocumentStatus.FAILED
        document.error_message = f"Storage upload failed: {str(e)[:200]}"
        await db.flush()
        return DocumentUploadResponse(
            id=document.id,
            filename=document.filename,
            file_type=document.file_type,
            file_size=document.file_size,
            status=document.status.value,
            created_at=document.created_at,
        )

    # Process document in the background so the upload request returns
    # immediately. The document stays in PROCESSING until the task finishes
    # (parse → chunk → embed → index) and flips it to READY or FAILED.
    # The task opens its own DB session, so it must run after this request's
    # session has committed — BackgroundTasks execute after the response.
    background_tasks.add_task(process_document, None, doc_id)

    return DocumentUploadResponse(
        id=document.id,
        filename=document.filename,
        file_type=document.file_type,
        file_size=document.file_size,
        status=document.status.value,
        created_at=document.created_at,
    )


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    page: int = 1,
    page_size: int = 20,
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> DocumentListResponse:
    """List all documents for the current tenant."""
    count_result = await db.execute(
        select(sa_func.count(Document.id)).where(Document.tenant_id == tenant_id)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Document)
        .where(Document.tenant_id == tenant_id)
        .order_by(Document.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    documents = result.scalars().all()

    return DocumentListResponse(
        documents=[
            DocumentResponse(
                id=doc.id,
                filename=doc.filename,
                file_type=doc.file_type,
                file_size=doc.file_size,
                status=doc.status.value,
                chunk_count=doc.chunk_count,
                created_at=doc.created_at,
                updated_at=doc.updated_at,
            )
            for doc in documents
        ],
        total=total,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> DocumentResponse:
    """Get a specific document by ID."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.tenant_id == tenant_id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentResponse(
        id=document.id,
        filename=document.filename,
        file_type=document.file_type,
        file_size=document.file_size,
        status=document.status.value,
        chunk_count=document.chunk_count,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a document and its associated chunks/embeddings from DB and R2."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.tenant_id == tenant_id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete from R2 storage (best effort)
    try:
        await delete_file(document.r2_key)
    except Exception as e:
        logger.warning("R2 delete failed (continuing with DB delete)", r2_key=document.r2_key, error=str(e))

    # Delete from DB (cascades to chunks and embeddings)
    await db.delete(document)
