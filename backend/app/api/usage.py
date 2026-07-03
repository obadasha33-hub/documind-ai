"""Usage analytics API endpoints."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func as sa_func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.deps import get_current_user, get_tenant_id
from ..models.usage import UsageRecord, UsageEvent
from ..models.user import User

router = APIRouter()


@router.get("/summary")
async def get_usage_summary(
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get usage summary for the last 30 days."""
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    result = await db.execute(
        select(
            UsageRecord.event_type,
            sa_func.count(UsageRecord.id).label("count"),
            sa_func.sum(UsageRecord.quantity).label("total_quantity"),
        )
        .where(
            UsageRecord.tenant_id == tenant_id,
            UsageRecord.created_at >= thirty_days_ago,
        )
        .group_by(UsageRecord.event_type)
    )

    summary = {}
    for row in result:
        summary[row.event_type.value] = {
            "count": row.count,
            "total_quantity": row.total_quantity or 0,
        }

    return summary


@router.get("/daily")
async def get_daily_usage(
    days: int = 7,
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get daily usage breakdown for the past N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            cast(UsageRecord.created_at, Date).label("date"),
            UsageRecord.event_type,
            sa_func.count(UsageRecord.id).label("count"),
        )
        .where(
            UsageRecord.tenant_id == tenant_id,
            UsageRecord.created_at >= since,
        )
        .group_by(cast(UsageRecord.created_at, Date), UsageRecord.event_type)
        .order_by(cast(UsageRecord.created_at, Date))
    )

    return [
        {
            "date": str(row.date),
            "event_type": row.event_type.value,
            "count": row.count,
        }
        for row in result
    ]
