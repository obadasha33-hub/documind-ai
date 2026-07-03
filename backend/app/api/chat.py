"""Chat API endpoints — RAG-powered conversational interface."""

import json
import uuid
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from ..core.database import get_db, async_session_factory
from ..core.deps import get_current_user, get_tenant_id
from ..models.user import User
from ..models.conversation import Conversation
from ..models.message import Message, MessageRole
from ..models.tenant import Tenant, Plan
from ..models.usage import UsageRecord, UsageEvent
from ..schemas.chat import (
    ChatRequest,
    ChatMessageResponse,
    ConversationResponse,
    ConversationListResponse,
)
from ..services.generation import rag_query, rag_query_stream
from ..core.config import settings

import structlog

logger = structlog.get_logger()

router = APIRouter()


async def _check_rate_limit(tenant_id: str, db: AsyncSession) -> None:
    """Raise 429 if the tenant has exhausted its daily query quota."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    query_count_result = await db.execute(
        select(sa_func.count(UsageRecord.id)).where(
            UsageRecord.tenant_id == tenant_id,
            UsageRecord.event_type == UsageEvent.QUERY,
            UsageRecord.created_at >= today_start,
        )
    )
    query_count = query_count_result.scalar() or 0

    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one()

    limits = {
        Plan.FREE: settings.FREE_QUERIES_PER_DAY,
        Plan.PRO: settings.PRO_QUERIES_PER_DAY,
        Plan.ENTERPRISE: 999999,
    }
    limit = limits.get(tenant.plan, settings.FREE_QUERIES_PER_DAY)
    if query_count >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily query limit reached ({limit}). Upgrade your plan for more.",
        )


async def _get_or_create_conversation(
    request: ChatRequest, user: User, tenant_id: str, db: AsyncSession
) -> Conversation:
    """Fetch the requested conversation, or create a new one from the message."""
    if request.conversation_id:
        conv_result = await db.execute(
            select(Conversation).where(
                Conversation.id == request.conversation_id,
                Conversation.tenant_id == tenant_id,
            )
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conversation

    conversation = Conversation(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        user_id=user.id,
        title=request.message[:100],
    )
    db.add(conversation)
    await db.flush()
    return conversation


@router.post("/query", response_model=ChatMessageResponse)
async def chat_query(
    request: ChatRequest,
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageResponse:
    """Send a message and get an AI response with source citations (non-streaming)."""
    start_time = time.time()

    await _check_rate_limit(tenant_id, db)
    conversation = await _get_or_create_conversation(request, user, tenant_id, db)

    # Save user message
    user_message = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role=MessageRole.USER,
        content=request.message,
    )
    db.add(user_message)

    # ── RAG pipeline: retrieve → build prompt → generate → verify citations ──
    try:
        rag_result = await rag_query(request.message, tenant_id, db)
    except Exception as e:
        logger.error("RAG query failed", tenant_id=tenant_id, error=str(e))
        raise HTTPException(
            status_code=502,
            detail="The assistant is temporarily unavailable. Please try again.",
        )

    latency_ms = int((time.time() - start_time) * 1000)

    assistant_message = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role=MessageRole.ASSISTANT,
        content=rag_result["answer"],
        sources=rag_result["sources"],
        confidence_score=rag_result["confidence_score"],
        model_used=rag_result["model_used"],
        latency_ms=latency_ms,
    )
    db.add(assistant_message)

    # Record usage
    usage = UsageRecord(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        event_type=UsageEvent.QUERY,
        quantity=1,
    )
    db.add(usage)

    await db.flush()

    return ChatMessageResponse(
        id=assistant_message.id,
        conversation_id=conversation.id,
        role=assistant_message.role.value,
        content=assistant_message.content,
        sources=rag_result["sources"],
        confidence_score=assistant_message.confidence_score,
        model_used=assistant_message.model_used,
        created_at=assistant_message.created_at,
    )


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> EventSourceResponse:
    """
    Send a message and stream the AI response token-by-token over SSE.

    Emits `delta` events with partial text, then one final `done` event with
    the persisted message id, sources, confidence, and model used. Emits an
    `error` event if generation fails.

    The pre-flight steps (rate limit, conversation, user message) run on the
    normal request-scoped session and are committed before streaming starts.
    The final assistant message is written from a fresh session inside the
    generator, since FastAPI tears down request-scoped dependencies as soon
    as the endpoint returns the response object — before a streaming body has
    finished sending — so the original `db` session can't be trusted for
    writes that happen after that point.
    """
    await _check_rate_limit(tenant_id, db)
    conversation = await _get_or_create_conversation(request, user, tenant_id, db)

    user_message = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation.id,
        role=MessageRole.USER,
        content=request.message,
    )
    db.add(user_message)
    await db.commit()

    conversation_id = conversation.id
    message_text = request.message

    async def event_generator():
        start_time = time.time()
        try:
            final: dict | None = None
            # Use a fresh session for the whole streaming lifecycle, not the
            # request-scoped `db` above — FastAPI tears down request-scoped
            # dependencies as soon as the endpoint returns the Response
            # object, which happens before this generator starts running.
            async with async_session_factory() as stream_session:
                async for event in rag_query_stream(message_text, tenant_id, stream_session):
                    if event["type"] == "delta":
                        yield {"event": "delta", "data": json.dumps({"text": event["text"]})}
                    else:
                        final = event

            if final is None:
                raise RuntimeError("Stream ended without a final result")

            latency_ms = int((time.time() - start_time) * 1000)

            async with async_session_factory() as write_session:
                assistant_message = Message(
                    id=str(uuid.uuid4()),
                    conversation_id=conversation_id,
                    role=MessageRole.ASSISTANT,
                    content=final["answer"],
                    sources=final["sources"],
                    confidence_score=final["confidence_score"],
                    model_used=final["model_used"],
                    latency_ms=latency_ms,
                )
                write_session.add(assistant_message)
                write_session.add(UsageRecord(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    event_type=UsageEvent.QUERY,
                    quantity=1,
                ))
                await write_session.commit()
                await write_session.refresh(assistant_message)

            yield {
                "event": "done",
                "data": json.dumps({
                    "id": assistant_message.id,
                    "conversation_id": conversation_id,
                    "sources": final["sources"],
                    "confidence_score": final["confidence_score"],
                    "model_used": final["model_used"],
                    "created_at": assistant_message.created_at.isoformat(),
                }),
            }
        except Exception as e:
            logger.error("Streaming RAG query failed", tenant_id=tenant_id, error=str(e))
            yield {
                "event": "error",
                "data": json.dumps({"detail": "The assistant is temporarily unavailable."}),
            }

    return EventSourceResponse(event_generator())


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    page: int = 1,
    page_size: int = 20,
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> ConversationListResponse:
    """List all conversations for the current user."""
    count_result = await db.execute(
        select(sa_func.count(Conversation.id)).where(
            Conversation.user_id == user.id,
            Conversation.tenant_id == tenant_id,
        )
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user.id, Conversation.tenant_id == tenant_id)
        .order_by(Conversation.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    conversations = result.scalars().all()

    return ConversationListResponse(
        conversations=[
            ConversationResponse(
                id=c.id,
                title=c.title,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in conversations
        ],
        total=total,
    )


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> list[ChatMessageResponse]:
    """Get all messages in a conversation."""
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.tenant_id == tenant_id,
            Conversation.user_id == user.id,
        )
    )
    if not conv_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()

    return [
        ChatMessageResponse(
            id=m.id,
            conversation_id=m.conversation_id,
            role=m.role.value,
            content=m.content,
            sources=m.sources,
            confidence_score=m.confidence_score,
            model_used=m.model_used,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a conversation and all its messages."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.tenant_id == tenant_id,
            Conversation.user_id == user.id,
        )
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conversation)
