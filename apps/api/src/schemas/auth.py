from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=1, max_length=100)
    device_label: Optional[str] = Field(None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    device_label: Optional[str] = Field(None, max_length=255)


class GuestJoinRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)
    device_label: Optional[str] = Field(None, max_length=255)
    avatar_asset_id: Optional[str] = None


class UserProfile(BaseModel):
    id: str
    email: Optional[str] = None
    display_name: str
    avatar_asset_id: Optional[str] = None
    is_guest: bool
    status: str
    created_at: datetime


class DeviceSessionInfo(BaseModel):
    id: str
    token: Optional[str] = None
    device_label: Optional[str] = None
    last_seen_at: datetime
    expires_at: datetime


class MeResponse(BaseModel):
    user: UserProfile
    session: DeviceSessionInfo
