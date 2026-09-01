from datetime import datetime
from typing import List, Optional, Union
from pydantic import BaseModel, Field
from apps.api.src.schemas.activity import EventActorInfo


class DirectTransferIntentRequest(BaseModel):
    recipient_id: str
    file_name: str = Field(..., min_length=1, max_length=255)
    mime_type: str = Field(..., min_length=3, max_length=100)
    size_bytes: int = Field(..., gt=0, le=262144000)  # Max 250 MB for direct transfer
    sha256_hash: Optional[str] = None
    client_mutation_id: Optional[str] = None


class DirectTransferResponse(BaseModel):
    id: str
    space_id: str
    sender_id: str
    recipient_id: str
    file_name: str
    mime_type: str
    size_bytes: int
    sha256_hash: Optional[str] = None
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    sender: EventActorInfo
    recipient: EventActorInfo


class TransferResponseAction(BaseModel):
    action: str = Field(..., pattern="^(accept|decline)$")


class TransferStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(transferring|completed|failed|cancelled)$")
    error_message: Optional[str] = None


class IceServerConfig(BaseModel):
    urls: Union[List[str], str]
    username: Optional[str] = None
    credential: Optional[str] = None


class IceServersResponse(BaseModel):
    ice_servers: List[IceServerConfig]
