from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from apps.api.src.schemas.activity import EventActorInfo


class SignUploadRequest(BaseModel):
    original_name: str = Field(..., min_length=1, max_length=255)
    mime_type: str = Field(..., min_length=3, max_length=100)
    size_bytes: int = Field(..., gt=0, le=52428800)  # Max 50 MB
    client_mutation_id: Optional[str] = None


class SignUploadResponse(BaseModel):
    asset_id: str
    upload_url: str
    method: str = "PUT"
    headers: Dict[str, str] = Field(default_factory=dict)
    expires_in_seconds: int = 900


class CompleteUploadRequest(BaseModel):
    sha256_hash: Optional[str] = None
    client_mutation_id: Optional[str] = None


class AssetResponse(BaseModel):
    id: str
    space_id: str
    uploader_id: str
    original_name: str
    mime_type: str
    size_bytes: int
    sha256_hash: Optional[str] = None
    storage_key: str
    thumbnail_key: Optional[str] = None
    download_url: Optional[str] = None
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    uploader: EventActorInfo


class AssetUrlResponse(BaseModel):
    asset_id: str
    download_url: str
    expires_in_seconds: int = 900


class AssetListResponse(BaseModel):
    space_id: str
    assets: List[AssetResponse]
    total_count: int = 0
