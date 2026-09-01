from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class MemberProfile(BaseModel):
    user_id: str
    display_name: str
    avatar_asset_id: Optional[str] = None
    role: str
    joined_at: datetime
    is_guest: bool
    presence_status: str = "offline"  # online, away, offline


class MemberListResponse(BaseModel):
    space_id: str
    members: List[MemberProfile]
    total_count: int


class UpdateMemberRoleRequest(BaseModel):
    role: str = Field(..., description="Role: host, curator, member")
