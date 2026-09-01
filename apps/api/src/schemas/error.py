from typing import Any, Optional
from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error description")
    details: Optional[Any] = Field(None, description="Optional extra error details or validation context")
    request_id: Optional[str] = Field(None, description="Request correlation identifier")


class ErrorResponse(BaseModel):
    error: ErrorDetail
