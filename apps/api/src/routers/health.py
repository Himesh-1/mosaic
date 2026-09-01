import os
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from apps.api.src.config import get_settings
from apps.api.src.database import get_db
from apps.api.src.schemas.health import HealthResponse, ReadyResponse

router = APIRouter(tags=["Health"])
settings = get_settings()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version="0.1.0",
        environment=settings.ENVIRONMENT,
    )


@router.get("/ready", response_model=ReadyResponse)
async def readiness_check(db: AsyncSession = Depends(get_db)) -> ReadyResponse:
    checks = {
        "database": False,
        "redis": False,
    }

    # 1. Check Database
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        checks["database"] = False

    # 2. Check Redis
    try:
        redis_client = aioredis.from_url(settings.REDIS_URL, socket_timeout=1.0)
        await redis_client.ping()
        await redis_client.aclose()
        checks["redis"] = True
    except Exception:
        # In SQLite/dev without Redis, mark degraded instead of crashing
        checks["redis"] = False

    all_ok = all(checks.values())
    status = "ok" if all_ok else ("degraded" if checks["database"] else "down")

    return ReadyResponse(
        status=status,
        version="0.1.0",
        checks=checks,
    )
