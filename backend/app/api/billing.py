"""Billing API endpoints — demo mode (Stripe-ready architecture)."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import get_db
from ..core.deps import get_current_user, get_tenant_id
from ..models.tenant import Tenant, Plan
from ..models.document import Document
from ..models.usage import UsageRecord, UsageEvent
from ..models.user import User
from ..schemas.billing import BillingStatusResponse, UpgradeRequest, UpgradeResponse, PlanInfo
from ..core.config import settings

router = APIRouter()

PLANS = {
    "free": PlanInfo(
        name="Free",
        price_monthly=0,
        max_documents=settings.FREE_DOCUMENTS_LIMIT,
        max_queries_per_day=settings.FREE_QUERIES_PER_DAY,
        features=["5 documents", "20 queries/day", "Basic chat"],
    ),
    "pro": PlanInfo(
        name="Pro",
        price_monthly=19,
        max_documents=settings.PRO_DOCUMENTS_LIMIT,
        max_queries_per_day=settings.PRO_QUERIES_PER_DAY,
        features=["50 documents", "500 queries/day", "Priority support", "Advanced analytics"],
    ),
    "enterprise": PlanInfo(
        name="Enterprise",
        price_monthly=49,
        max_documents=999999,
        max_queries_per_day=99999,
        features=["Unlimited documents", "Unlimited queries", "Dedicated support", "Custom integrations"],
    ),
}


@router.get("/status", response_model=BillingStatusResponse)
async def get_billing_status(
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> BillingStatusResponse:
    """Get current billing status for the tenant."""
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one()

    # Count documents
    doc_count_result = await db.execute(
        select(sa_func.count(Document.id)).where(Document.tenant_id == tenant_id)
    )
    doc_count = doc_count_result.scalar() or 0

    # Count today's queries
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    query_count_result = await db.execute(
        select(sa_func.count(UsageRecord.id)).where(
            UsageRecord.tenant_id == tenant_id,
            UsageRecord.event_type == UsageEvent.QUERY,
            UsageRecord.created_at >= today_start,
        )
    )
    query_count = query_count_result.scalar() or 0

    plan_info = PLANS.get(tenant.plan.value, PLANS["free"])

    return BillingStatusResponse(
        current_plan=tenant.plan.value,
        documents_used=doc_count,
        documents_limit=plan_info.max_documents,
        queries_today=query_count,
        queries_limit=plan_info.max_queries_per_day,
        stripe_customer_id=tenant.stripe_customer_id,
    )


@router.get("/plans", response_model=list[PlanInfo])
async def list_plans() -> list[PlanInfo]:
    """List all available plans."""
    return list(PLANS.values())


@router.post("/upgrade", response_model=UpgradeResponse)
async def upgrade_plan(
    request: UpgradeRequest,
    user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> UpgradeResponse:
    """Upgrade plan (demo mode — instantly upgrades without payment)."""
    if request.plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {request.plan}")

    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one()

    # Demo mode: directly update the plan
    # In production, this would create a Stripe checkout session
    tenant.plan = Plan(request.plan)
    await db.flush()

    return UpgradeResponse(
        checkout_url=None,
        message=f"Successfully upgraded to {PLANS[request.plan].name} plan (demo mode). "
                "Add Stripe keys for production billing.",
    )
