from typing import Dict, Literal
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "down"]
    version: str = "0.1.0"
    environment: str


class ReadyResponse(BaseModel):
    status: Literal["ok", "degraded", "down"]
    version: str = "0.1.0"
    checks: Dict[str, bool] = Field(default_factory=dict)
