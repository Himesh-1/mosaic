import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from sqlalchemy import String, DateTime, Index, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column
from apps.api.src.database import Base


def generate_id() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def default_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=7)


class MutationReceipt(Base):
    __tablename__ = "mutation_receipts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    actor_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    space_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    client_mutation_id: Mapped[str] = mapped_column(String(64), nullable=False)
    operation: Mapped[str] = mapped_column(String(100), default="mutation", nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    outcome: Mapped[str] = mapped_column(String(50), default="applied", nullable=False)  # "applied", "replayed", "rejected"
    resource_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    response_payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=default_expiry, nullable=False)

    __table_args__ = (
        UniqueConstraint("actor_id", "client_mutation_id", name="uq_actor_client_mutation"),
        Index("ix_mutation_receipts_lookup", "actor_id", "client_mutation_id"),
    )
