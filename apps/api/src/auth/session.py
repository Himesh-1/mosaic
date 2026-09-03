import secrets
from datetime import datetime, timezone, timedelta
from typing import Literal, Optional, Tuple
import bcrypt
from fastapi import Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.src.config import get_settings
from apps.api.src.database import get_db
from apps.api.src.models.session import DeviceSession
from apps.api.src.models.user import User

settings = get_settings()


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def generate_session_token() -> str:
    return secrets.token_urlsafe(48)


SameSiteType = Literal["lax", "strict", "none"]


def set_session_cookie(response: Response, session_token: str) -> None:
    is_prod = settings.ENVIRONMENT.lower() == "production"
    samesite: SameSiteType = "none" if (is_prod and not settings.COOKIE_DOMAIN) else settings.COOKIE_SAME_SITE
    secure = True if (is_prod or samesite == "none") else settings.COOKIE_SECURE

    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session_token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
        domain=settings.COOKIE_DOMAIN,
    )


def clear_session_cookie(response: Response) -> None:
    is_prod = settings.ENVIRONMENT.lower() == "production"
    samesite: SameSiteType = "none" if (is_prod and not settings.COOKIE_DOMAIN) else settings.COOKIE_SAME_SITE
    secure = True if (is_prod or samesite == "none") else settings.COOKIE_SECURE

    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
        domain=settings.COOKIE_DOMAIN,
    )


async def get_session_and_user(
    request: Request,
    mosaic_session: Optional[str] = Cookie(None, alias=settings.SESSION_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
) -> Optional[Tuple[DeviceSession, User]]:
    token = mosaic_session
    # Fallback check from Authorization header for test clients / development
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        return None

    now = datetime.now(timezone.utc)
    stmt = (
        select(DeviceSession)
        .options(selectinload(DeviceSession.user))
        .where(
            DeviceSession.session_token == token,
            DeviceSession.revoked_at.is_(None),
            DeviceSession.expires_at > now,
        )
    )
    result = await db.execute(stmt)
    device_session = result.scalars().first()

    if not device_session or not device_session.user:
        return None

    # Update last_seen_at
    device_session.last_seen_at = now
    await db.commit()

    return device_session, device_session.user


async def get_current_user_and_session(
    session_user: Optional[Tuple[DeviceSession, User]] = Depends(get_session_and_user),
) -> Tuple[DeviceSession, User]:
    if not session_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return session_user


async def get_current_user(
    session_user: Tuple[DeviceSession, User] = Depends(get_current_user_and_session),
) -> User:
    _, user = session_user
    return user


async def get_current_session(
    session_user: Tuple[DeviceSession, User] = Depends(get_current_user_and_session),
) -> DeviceSession:
    device_session, _ = session_user
    return device_session
