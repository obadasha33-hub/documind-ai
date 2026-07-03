"""Billing-related schemas."""

from pydantic import BaseModel


class PlanInfo(BaseModel):
    name: str
    price_monthly: float
    max_documents: int
    max_queries_per_day: int
    features: list[str]


class BillingStatusResponse(BaseModel):
    current_plan: str
    documents_used: int
    documents_limit: int
    queries_today: int
    queries_limit: int
    stripe_customer_id: str | None = None


class UpgradeRequest(BaseModel):
    plan: str  # "pro" or "enterprise"


class UpgradeResponse(BaseModel):
    checkout_url: str | None = None
    message: str
