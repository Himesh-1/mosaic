import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from apps.api.src.config import get_settings

settings = get_settings()

# Fallback to local SQLite async DB if PostgreSQL is not reachable in local dev
database_url = settings.DATABASE_URL
if os.environ.get("USE_SQLITE", "false").lower() == "true":
    database_url = "sqlite+aiosqlite:///./mosaic_dev.db"

engine_kwargs = {
    "echo": (settings.LOG_LEVEL.upper() == "DEBUG"),
    "future": True,
}

if "sqlite" not in database_url:
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 20,
        "pool_recycle": 1800,
        "pool_pre_ping": True,
    })

engine = create_async_engine(
    database_url,
    **engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)
async_session_factory = AsyncSessionLocal



class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
