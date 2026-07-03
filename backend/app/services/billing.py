"""Billing service — demo billing logic (Stripe-ready architecture)."""

from ..core.config import settings
from ..models.tenant import Plan

PLAN_LIMITS = {
    Plan.FREE: {
        "max_documents": settings.FREE_DOCUMENTS_LIMIT,
        "max_queries_per_day": settings.FREE_QUERIES_PER_DAY,
    },
    Plan.PRO: {
        "max_documents": settings.PRO_DOCUMENTS_LIMIT,
        "max_queries_per_day": settings.PRO_QUERIES_PER_DAY,
    },
    Plan.ENTERPRISE: {
        "max_documents": 999999,
        "max_queries_per_day": 99999,
    },
}


def get_plan_limits(plan: Plan) -> dict:
    """Get the limits for a given plan."""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS[Plan.FREE])
