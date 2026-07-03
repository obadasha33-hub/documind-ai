"""Usage tracking service."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.usage import UsageRecord, UsageEvent


async def record_usage(
    db: AsyncSession,
    tenant_id: str,
    event_type: UsageEvent,
    quantity: int = 1,
    metadata: dict | None = None,
) -> UsageRecord:
    """Record a usage event."""
    record = UsageRecord(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        event_type=event_type,
        quantity=quantity,
        metadata_json=metadata,
    )
    db.add(record)
    await db.flush()
    return record


async def get_today_usage(db: AsyncSession, tenant_id: str, event_type: UsageEvent) -> int:
    """Get today's usage count for a specific event type."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(sa_func.sum(UsageRecord.quantity)).where(
            UsageRecord.tenant_id == tenant_id,
            UsageRecord.event_type == event_type,
            UsageRecord.created_at >= today_start,
        )
    )
    return result.scalar() or 0
