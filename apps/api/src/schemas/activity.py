from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class EventActorInfo(BaseModel):
    id: str
    display_name: str
    avatar_asset_id: Optional[str] = None


class ActivityEventResponse(BaseModel):
    event_id: str
    space_id: str
    sequence: int
    type: str
    occurred_at: datetime
    actor: EventActorInfo
    data: Dict[str, Any] = Field(default_factory=dict)


class ActivityFeedResponse(BaseModel):
    space_id: str
    events: List[ActivityEventResponse]
    latest_sequence: int
    has_more: bool
