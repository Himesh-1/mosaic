from functools import lru_cache
from typing import Literal, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Application URLs & CORS
    APP_ORIGIN: str = "http://localhost:3000"
    API_ORIGIN: str = "http://localhost:8000"
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/mosaic"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/mosaic"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Object Storage (S3 / MinIO)
    OBJECT_STORAGE_ENDPOINT: str = "http://localhost:9000"
    OBJECT_STORAGE_BUCKET: str = "mosaic-assets"
    OBJECT_STORAGE_ACCESS_KEY: str = "minioadmin"
    OBJECT_STORAGE_SECRET_KEY: str = "minioadmin"
    OBJECT_STORAGE_REGION: str = "us-east-1"
    OBJECT_STORAGE_USE_SSL: bool = False

    # Session & Cookies
    SESSION_SECRET: str = "dev-session-secret-change-me-in-production-at-least-32-chars"
    SESSION_COOKIE_NAME: str = "mosaic_session"
    COOKIE_DOMAIN: Optional[str] = None
    COOKIE_SECURE: bool = False
    COOKIE_SAME_SITE: Literal["lax", "strict", "none"] = "lax"
    SESSION_MAX_AGE_SECONDS: int = 60 * 60 * 24 * 14  # 14 days

    # Limits
    UPLOAD_MAX_BYTES: int = 104857600  # 100 MB
    DIRECT_TRANSFER_MAX_BYTES: int = 262144000  # 250 MB

    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env", "../../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
