import uuid
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy import String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from apps.api.src.database import Base


def generate_id() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def hash_invite_token(token: str) -> str:
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()


def generate_invite_token() -> Tuple[str, str]:
    """Returns (raw_token, token_hash). Raw token is only returned to the creator."""
    raw_token = secrets.token_urlsafe(24)
    token_hash = hash_invite_token(raw_token)
    return raw_token, token_hash


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_id)
    space_id: Mapped[str] = mapped_column(String(36), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    mode: Mapped[str] = mapped_column(String(50), default="link", nullable=False)  # link, qr, code
    role_on_join: Mapped[str] = mapped_column(String(50), default="member", nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    max_uses: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    uses_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    space = relationship("Space", back_populates="invites")

    @property
    def is_valid(self) -> bool:
        if self.revoked_at is not None:
            return False
        now = datetime.now(timezone.utc)
        if self.expires_at is not None:
            exp = self.expires_at if self.expires_at.tzinfo else self.expires_at.replace(tzinfo=timezone.utc)
            if exp <= now:
                return False
        if self.max_uses is not None and self.uses_count >= self.max_uses:
            return False
        return True
