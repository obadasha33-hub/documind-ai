"""Usage tracking model — records API usage per tenant for billing."""

import enum
from datetime import datetime, timezone

from sqlalchemy import String, Integer, DateTime, Enum, ForeignKey, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class UsageEvent(str, enum.Enum):
    QUERY = "query"
    DOCUMENT_UPLOAD = "document_upload"
    EMBEDDING = "embedding"
    LLM_TOKEN = "llm_token"


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[UsageEvent] = mapped_column(Enum(UsageEvent), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
    )
