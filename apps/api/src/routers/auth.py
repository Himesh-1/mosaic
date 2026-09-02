from datetime import datetime, timezone, timedelta
from typing import Tuple
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.auth.session import (
    clear_session_cookie,
    generate_session_token,
    get_current_user_and_session,
    hash_password,
    set_session_cookie,
    verify_password,
)
from apps.api.src.config import get_settings
from apps.api.src.database import get_db
from apps.api.src.models.session import DeviceSession
from apps.api.src.models.user import User
from apps.api.src.schemas.auth import (
    DeviceSessionInfo,
    GuestJoinRequest,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    UserProfile,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
settings = get_settings()


@router.post("/register", response_model=MeResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    # Check if email is already taken
    stmt = select(User).where(User.email == payload.email)
    result = await db.execute(stmt)
    existing_user = result.scalars().first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    # Create User
    new_user = User(
        email=payload.email,
        display_name=payload.display_name,
        hashed_password=hash_password(payload.password),
        is_guest=False,
        status="active",
    )
    db.add(new_user)
    await db.flush()

    # Create DeviceSession
    session_token = generate_session_token()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=settings.SESSION_MAX_AGE_SECONDS)

    device_session = DeviceSession(
        user_id=new_user.id,
        session_token=session_token,
        device_label=payload.device_label or "Browser Session",
        user_agent=request.headers.get("user-agent"),
        last_seen_at=now,
        expires_at=expires_at,
    )
    db.add(device_session)
    await db.commit()
    await db.refresh(new_user)
    await db.refresh(device_session)

    set_session_cookie(response, session_token)

    return MeResponse(
        user=UserProfile(
            id=new_user.id,
            email=new_user.email,
            display_name=new_user.display_name,
            avatar_asset_id=new_user.avatar_asset_id,
            is_guest=new_user.is_guest,
            status=new_user.status,
            created_at=new_user.created_at,
        ),
        session=DeviceSessionInfo(
            id=device_session.id,
            token=device_session.session_token,
            device_label=device_session.device_label,
            last_seen_at=device_session.last_seen_at,
            expires_at=device_session.expires_at,
        ),
    )


@router.post("/login", response_model=MeResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    stmt = select(User).where(User.email == payload.email)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Create new DeviceSession
    session_token = generate_session_token()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=settings.SESSION_MAX_AGE_SECONDS)

    device_session = DeviceSession(
        user_id=user.id,
        session_token=session_token,
        device_label=payload.device_label or "Browser Session",
        user_agent=request.headers.get("user-agent"),
        last_seen_at=now,
        expires_at=expires_at,
    )
    db.add(device_session)
    await db.commit()
    await db.refresh(device_session)

    set_session_cookie(response, session_token)

    return MeResponse(
        user=UserProfile(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            avatar_asset_id=user.avatar_asset_id,
            is_guest=user.is_guest,
            status=user.status,
            created_at=user.created_at,
        ),
        session=DeviceSessionInfo(
            id=device_session.id,
            token=device_session.session_token,
            device_label=device_session.device_label,
            last_seen_at=device_session.last_seen_at,
            expires_at=device_session.expires_at,
        ),
    )


@router.post("/guest", response_model=MeResponse, status_code=status.HTTP_201_CREATED)
async def guest_session(
    payload: GuestJoinRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    new_user = User(
        email=None,
        display_name=payload.display_name,
        hashed_password=None,
        avatar_asset_id=payload.avatar_asset_id,
        is_guest=True,
        status="active",
    )
    db.add(new_user)
    await db.flush()

    session_token = generate_session_token()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=settings.SESSION_MAX_AGE_SECONDS)

    device_session = DeviceSession(
        user_id=new_user.id,
        session_token=session_token,
        device_label=payload.device_label or "Guest Session",
        user_agent=request.headers.get("user-agent"),
        last_seen_at=now,
        expires_at=expires_at,
    )
    db.add(device_session)
    await db.commit()
    await db.refresh(new_user)
    await db.refresh(device_session)

    set_session_cookie(response, session_token)

    return MeResponse(
        user=UserProfile(
            id=new_user.id,
            email=new_user.email,
            display_name=new_user.display_name,
            avatar_asset_id=new_user.avatar_asset_id,
            is_guest=new_user.is_guest,
            status=new_user.status,
            created_at=new_user.created_at,
        ),
        session=DeviceSessionInfo(
            id=device_session.id,
            token=device_session.session_token,
            device_label=device_session.device_label,
            last_seen_at=device_session.last_seen_at,
            expires_at=device_session.expires_at,
        ),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: AsyncSession = Depends(get_db),
    current: Tuple[DeviceSession, User] = Depends(get_current_user_and_session),
) -> None:
    device_session, _ = current
    device_session.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    clear_session_cookie(response)


@router.get("/me", response_model=MeResponse)
async def get_me(
    current: Tuple[DeviceSession, User] = Depends(get_current_user_and_session),
) -> MeResponse:
    device_session, user = current
    return MeResponse(
        user=UserProfile(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            avatar_asset_id=user.avatar_asset_id,
            is_guest=user.is_guest,
            status=user.status,
            created_at=user.created_at,
        ),
        session=DeviceSessionInfo(
            id=device_session.id,
            token=device_session.session_token,
            device_label=device_session.device_label,
            last_seen_at=device_session.last_seen_at,
            expires_at=device_session.expires_at,
        ),
    )
