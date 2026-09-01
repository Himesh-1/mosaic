from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class CreateSpaceRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    template: str = Field("gathering", description="Template/purpose: trip, event, team, gathering, custom")
    description: Optional[str] = None
    cover_color: Optional[str] = "#246A5A"
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class UpdateSpaceRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = None
    cover_color: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class SpaceResponse(BaseModel):
    id: str
    slug: str
    title: str
    description: Optional[str] = None
    template: str
    cover_asset_id: Optional[str] = None
    cover_color: Optional[str] = None
    status: str
    created_by: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    current_role: str
    member_count: int = 0


class SpaceSummary(BaseModel):
    id: str
    slug: str
    title: str
    template: str
    cover_color: Optional[str] = None
    status: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: datetime
    current_role: str
    member_count: int


class SpaceSummaryDetailResponse(BaseModel):
    space_id: str
    title: str
    template: str
    status: str
    cover_color: Optional[str] = None
    member_count: int
    message_count: int
    asset_count: int
    total_asset_bytes: int
    poll_count: int
    checklist_count: int
    completed_checklist_items: int
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None


class SpaceExportResponse(BaseModel):
    space: SpaceResponse
    members: List[Dict[str, Any]]
    activity_events: List[Dict[str, Any]]
    artifacts: List[Dict[str, Any]]
    assets: List[Dict[str, Any]]
    exported_at: datetime
