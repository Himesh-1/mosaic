from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.src.auth.session import (
    generate_session_token,
    get_session_and_user,
    set_session_cookie,
)
from apps.api.src.config import get_settings
from apps.api.src.database import get_db
from apps.api.src.models.invite import Invite, hash_invite_token
from apps.api.src.models.membership import Membership
from apps.api.src.models.session import DeviceSession
from apps.api.src.models.space import Space
from apps.api.src.models.user import User
from apps.api.src.schemas.invite import InvitePreviewResponse, JoinSpaceRequest
from apps.api.src.schemas.space import SpaceResponse
from apps.api.src.services.activity import build_event_envelope, connection_manager, record_activity_event

router = APIRouter(prefix="/invites", tags=["Invites"])
settings = get_settings()


@router.post("/{token}/preview", response_model=InvitePreviewResponse)
async def preview_invite(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> InvitePreviewResponse:
    token_hash = hash_invite_token(token)
    stmt = (
        select(Invite)
        .options(selectinload(Invite.space).selectinload(Space.creator))
        .where(Invite.token_hash == token_hash)
    )
    result = await db.execute(stmt)
    invite = result.scalars().first()

    if not invite or not invite.space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite link is invalid or does not exist.",
        )

    # Calculate validity and reason
    is_valid = True
    status_reason = "active"
    now = datetime.now(timezone.utc)

    if invite.revoked_at is not None:
        is_valid = False
        status_reason = "revoked"
    elif invite.expires_at is not None:
        exp = invite.expires_at if invite.expires_at.tzinfo else invite.expires_at.replace(tzinfo=timezone.utc)
        if exp <= now:
            is_valid = False
            status_reason = "expired"
    elif invite.max_uses is not None and invite.uses_count >= invite.max_uses:
        is_valid = False
        status_reason = "max_uses_reached"

    # Count active members
    count_stmt = select(func.count(Membership.id)).where(
        Membership.space_id == invite.space_id,
        Membership.removed_at.is_(None),
    )
    count_res = await db.execute(count_stmt)
    member_count = count_res.scalar_one()

    return InvitePreviewResponse(
        space_id=invite.space.id,
        space_title=invite.space.title,
        space_template=invite.space.template,
        cover_color=invite.space.cover_color,
        description=invite.space.description,
        host_display_name=invite.space.creator.display_name,
        starts_at=invite.space.starts_at,
        ends_at=invite.space.ends_at,
        member_count=member_count,
        is_valid=is_valid,
        status_reason=status_reason,
    )


@router.post("/{token}/join", response_model=SpaceResponse)
async def join_space(
    token: str,
    payload: JoinSpaceRequest,
    request: Request,
    response: Response,
    session_user: Optional[Tuple[DeviceSession, User]] = Depends(get_session_and_user),
    db: AsyncSession = Depends(get_db),
) -> SpaceResponse:
    token_hash = hash_invite_token(token)
    stmt = (
        select(Invite)
        .options(selectinload(Invite.space))
        .where(Invite.token_hash == token_hash)
    )
    result = await db.execute(stmt)
    invite = result.scalars().first()

    if not invite or not invite.space:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite link is invalid or does not exist.",
        )

    # Check invite validity
    now = datetime.now(timezone.utc)
    if invite.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invite is no longer active.")
    if invite.expires_at is not None:
        exp = invite.expires_at if invite.expires_at.tzinfo else invite.expires_at.replace(tzinfo=timezone.utc)
        if exp <= now:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invite has expired.")
    if invite.max_uses is not None and invite.uses_count >= invite.max_uses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This Space has reached its invite limit.")

    # Determine user context (existing session or new guest)
    user: User
    if session_user:
        _, user = session_user
    else:
        if not payload.display_name or not payload.display_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A display name is required to join.",
            )
        # Create Guest User & DeviceSession
        user = User(
            email=None,
            display_name=payload.display_name.strip(),
            hashed_password=None,
            is_guest=True,
            status="active",
        )
        db.add(user)
        await db.flush()

        session_token = generate_session_token()
        expires_at = now + timedelta(seconds=settings.SESSION_MAX_AGE_SECONDS)
        device_session = DeviceSession(
            user_id=user.id,
            session_token=session_token,
            device_label=payload.device_label or "Guest Device",
            user_agent=request.headers.get("user-agent"),
            last_seen_at=now,
            expires_at=expires_at,
        )
        db.add(device_session)
        set_session_cookie(response, session_token)

    # Check if already an active member
    mem_stmt = select(Membership).where(
        Membership.space_id == invite.space_id,
        Membership.user_id == user.id,
        Membership.removed_at.is_(None),
    )
    mem_res = await db.execute(mem_stmt)
    existing_membership = mem_res.scalars().first()

    role = invite.role_on_join
    if existing_membership:
        role = existing_membership.role
    else:
        # Create membership and increment uses
        new_membership = Membership(
            space_id=invite.space_id,
            user_id=user.id,
            role=invite.role_on_join,
        )
        db.add(new_membership)
        invite.uses_count += 1

        # Record Activity Event
        event = await record_activity_event(
            db,
            space_id=invite.space_id,
            actor_id=user.id,
            event_type="membership.joined",
            payload={
                "display_name": user.display_name,
                "role": invite.role_on_join,
                "is_guest": user.is_guest,
            },
        )

        await db.commit()

        # Post-commit broadcast
        await connection_manager.broadcast_to_space(
            invite.space_id,
            build_event_envelope(event, user),
        )

    # Get updated member count
    count_stmt = select(func.count(Membership.id)).where(
        Membership.space_id == invite.space_id,
        Membership.removed_at.is_(None),
    )
    count_res = await db.execute(count_stmt)
    count = count_res.scalar_one()

    return SpaceResponse(
        id=invite.space.id,
        slug=invite.space.slug,
        title=invite.space.title,
        description=invite.space.description,
        template=invite.space.template,
        cover_asset_id=invite.space.cover_asset_id,
        cover_color=invite.space.cover_color,
        status=invite.space.status,
        created_by=invite.space.created_by,
        starts_at=invite.space.starts_at,
        ends_at=invite.space.ends_at,
        created_at=invite.space.created_at,
        completed_at=invite.space.completed_at,
        current_role=role,
        member_count=count,
    )
