from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CreateInviteRequest(BaseModel):
    mode: str = Field("link", description="Mode: link, qr, code")
    role_on_join: str = Field("member", description="Role on join: member, curator")
    expires_in_hours: Optional[int] = Field(None, ge=1, le=8760, description="Hours until invite expiration")
    max_uses: Optional[int] = Field(None, ge=1, description="Maximum number of joins allowed")


class InviteResponse(BaseModel):
    id: str
    space_id: str
    token: Optional[str] = Field(None, description="Raw token, only provided immediately upon creation/rotation")
    mode: str
    role_on_join: str
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None
    uses_count: int
    revoked_at: Optional[datetime] = None
    created_at: datetime
    is_valid: bool


class InvitePreviewResponse(BaseModel):
    space_id: str
    space_title: str
    space_template: str
    cover_color: Optional[str] = None
    description: Optional[str] = None
    host_display_name: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    member_count: int
    is_valid: bool
    status_reason: Optional[str] = None  # "active", "expired", "revoked", "max_uses_reached"


class JoinSpaceRequest(BaseModel):
    display_name: Optional[str] = Field(None, description="Display name required if joining as a guest/unauthenticated")
    device_label: Optional[str] = None
