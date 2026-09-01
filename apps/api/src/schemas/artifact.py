from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from apps.api.src.schemas.activity import EventActorInfo


class CreateMessageRequest(BaseModel):
  text: str = Field(..., min_length=1, max_length=5000)
  client_mutation_id: Optional[str] = None


class CreatePollRequest(BaseModel):
  question: str = Field(..., min_length=1, max_length=500)
  options: List[str] = Field(..., min_length=2, max_length=10)
  allow_multiple: bool = False
  client_mutation_id: Optional[str] = None


class VotePollRequest(BaseModel):
  option_ids: List[str] = Field(..., min_length=1)
  client_mutation_id: Optional[str] = None


class CreateChecklistRequest(BaseModel):
  title: str = Field(..., min_length=1, max_length=200)
  items: List[str] = Field(..., min_length=1, max_length=50)
  client_mutation_id: Optional[str] = None


class ToggleChecklistItemRequest(BaseModel):
  completed: bool
  client_mutation_id: Optional[str] = None


class ArtifactResponse(BaseModel):
  id: str
  space_id: str
  type: str  # message, poll, checklist, file
  created_by: str
  status: str
  content: Dict[str, Any]
  created_at: datetime
  updated_at: datetime
  creator: EventActorInfo


class ArtifactListResponse(BaseModel):
  space_id: str
  artifacts: List[ArtifactResponse]
  total_count: int = 0
