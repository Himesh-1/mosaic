import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.src.auth.permissions import get_active_membership, get_host_membership
from apps.api.src.auth.session import get_current_user_and_session
from apps.api.src.database import get_db
from apps.api.src.models.invite import Invite, generate_invite_token
from apps.api.src.models.membership import Membership
from apps.api.src.models.session import DeviceSession
from apps.api.src.models.space import Space
from apps.api.src.models.user import User
from apps.api.src.models.artifact import Artifact
from apps.api.src.models.asset import Asset
from apps.api.src.models.activity import ActivityEvent
from apps.api.src.schemas.invite import CreateInviteRequest, InviteResponse
from apps.api.src.schemas.membership import MemberListResponse, MemberProfile
from apps.api.src.schemas.space import (
    CreateSpaceRequest,
    SpaceResponse,
    SpaceSummary,
    SpaceSummaryDetailResponse,
    SpaceExportResponse,
    UpdateSpaceRequest,
)
from apps.api.src.services.activity import build_event_envelope, connection_manager, record_activity_event

router = APIRouter(prefix="/spaces", tags=["Spaces"])


def slugify(title: str) -> str:
    cleaned = re.sub(r"[^\w\s-]", "", title.lower()).strip()
    slug_base = re.sub(r"[-\s]+", "-", cleaned)
    random_suffix = secrets.token_hex(2)
    return f"{slug_base[:40]}-{random_suffix}" if slug_base else f"space-{random_suffix}"


async def get_space_member_count(db: AsyncSession, space_id: str) -> int:
    count_stmt = select(func.count(Membership.id)).where(
        Membership.space_id == space_id,
        Membership.removed_at.is_(None),
    )
    count_res = await db.execute(count_stmt)
    return count_res.scalar() or 0


def build_space_response(space: Space, role: str, member_count: int) -> SpaceResponse:
    return SpaceResponse(
        id=space.id,
        slug=space.slug,
        title=space.title,
        description=space.description,
        template=space.template,
        cover_asset_id=space.cover_asset_id,
        cover_color=space.cover_color,
        status=space.status,
        created_by=space.created_by,
        starts_at=space.starts_at,
        ends_at=space.ends_at,
        created_at=space.created_at,
        completed_at=space.completed_at,
        current_role=role,
        member_count=member_count,
    )


@router.post("", response_model=SpaceResponse, status_code=status.HTTP_201_CREATED)
async def create_space(
    payload: CreateSpaceRequest,
    current: Tuple[DeviceSession, User] = Depends(get_current_user_and_session),
    db: AsyncSession = Depends(get_db),
) -> SpaceResponse:
    _, user = current
    slug = slugify(payload.title)

    # 1. Create Space
    new_space = Space(
        slug=slug,
        title=payload.title,
        description=payload.description,
        template=payload.template,
        cover_color=payload.cover_color or "#246A5A",
        created_by=user.id,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        status="active",
    )
    db.add(new_space)
    await db.flush()

    # 2. Add Host Membership
    host_membership = Membership(
        space_id=new_space.id,
        user_id=user.id,
        role="host",
    )
    db.add(host_membership)

    # 3. Create Default Active Invite
    raw_token, token_hash = generate_invite_token()
    default_invite = Invite(
        space_id=new_space.id,
        token_hash=token_hash,
        mode="link",
        role_on_join="member",
    )
    db.add(default_invite)

    # 4. Record Initial Activity Event
    await record_activity_event(
        db,
        space_id=new_space.id,
        actor_id=user.id,
        event_type="space.created",
        payload={"title": new_space.title, "template": new_space.template},
    )

    await db.commit()
    await db.refresh(new_space)

    return SpaceResponse(
        id=new_space.id,
        slug=new_space.slug,
        title=new_space.title,
        description=new_space.description,
        template=new_space.template,
        cover_asset_id=new_space.cover_asset_id,
        cover_color=new_space.cover_color,
        status=new_space.status,
        created_by=new_space.created_by,
        starts_at=new_space.starts_at,
        ends_at=new_space.ends_at,
        created_at=new_space.created_at,
        completed_at=new_space.completed_at,
        current_role="host",
        member_count=1,
    )


@router.get("", response_model=List[SpaceSummary])
async def list_my_spaces(
    current: Tuple[DeviceSession, User] = Depends(get_current_user_and_session),
    db: AsyncSession = Depends(get_db),
) -> List[SpaceSummary]:
    _, user = current

    # Query active memberships for the user
    stmt = (
        select(Space, Membership.role)
        .join(Membership, Membership.space_id == Space.id)
        .where(
            Membership.user_id == user.id,
            Membership.removed_at.is_(None),
        )
        .order_by(Space.created_at.desc())
    )
    results = await db.execute(stmt)
    rows = results.all()

    summaries = []
    for space, role in rows:
        # Count members in space
        count_stmt = select(func.count(Membership.id)).where(
            Membership.space_id == space.id,
            Membership.removed_at.is_(None),
        )
        count_result = await db.execute(count_stmt)
        count = count_result.scalar_one()

        summaries.append(
            SpaceSummary(
                id=space.id,
                slug=space.slug,
                title=space.title,
                template=space.template,
                cover_color=space.cover_color,
                status=space.status,
                starts_at=space.starts_at,
                ends_at=space.ends_at,
                created_at=space.created_at,
                current_role=role,
                member_count=count,
            )
        )
    return summaries


@router.get("/{space_id}", response_model=SpaceResponse)
async def get_space(
    space_id: str,
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> SpaceResponse:
    stmt = select(Space).where(Space.id == space_id)
    result = await db.execute(stmt)
    space = result.scalars().first()

    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found.")

    # Get active member count
    count_stmt = select(func.count(Membership.id)).where(
        Membership.space_id == space.id,
        Membership.removed_at.is_(None),
    )
    count_res = await db.execute(count_stmt)
    count = count_res.scalar_one()

    return SpaceResponse(
        id=space.id,
        slug=space.slug,
        title=space.title,
        description=space.description,
        template=space.template,
        cover_asset_id=space.cover_asset_id,
        cover_color=space.cover_color,
        status=space.status,
        created_by=space.created_by,
        starts_at=space.starts_at,
        ends_at=space.ends_at,
        created_at=space.created_at,
        completed_at=space.completed_at,
        current_role=membership.role,
        member_count=count,
    )


@router.patch("/{space_id}", response_model=SpaceResponse)
async def update_space(
    space_id: str,
    payload: UpdateSpaceRequest,
    membership: Membership = Depends(get_host_membership),
    db: AsyncSession = Depends(get_db),
) -> SpaceResponse:
    stmt = select(Space).where(Space.id == space_id)
    result = await db.execute(stmt)
    space = result.scalars().first()

    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found.")

    if payload.title is not None:
        space.title = payload.title
    if payload.description is not None:
        space.description = payload.description
    if payload.cover_color is not None:
        space.cover_color = payload.cover_color
    if payload.starts_at is not None:
        space.starts_at = payload.starts_at
    if payload.ends_at is not None:
        space.ends_at = payload.ends_at

    # Record Activity Event
    event = await record_activity_event(
        db,
        space_id=space.id,
        actor_id=membership.user_id,
        event_type="space.updated",
        payload={"title": space.title, "description": space.description},
    )

    await db.commit()
    await db.refresh(space)

    # Post-commit realtime broadcast
    actor_user = await db.get(User, membership.user_id)
    if actor_user:
        await connection_manager.broadcast_to_space(space.id, build_event_envelope(event, actor_user))

    count_stmt = select(func.count(Membership.id)).where(
        Membership.space_id == space.id,
        Membership.removed_at.is_(None),
    )
    count_res = await db.execute(count_stmt)
    count = count_res.scalar_one()

    return SpaceResponse(
        id=space.id,
        slug=space.slug,
        title=space.title,
        description=space.description,
        template=space.template,
        cover_asset_id=space.cover_asset_id,
        cover_color=space.cover_color,
        status=space.status,
        created_by=space.created_by,
        starts_at=space.starts_at,
        ends_at=space.ends_at,
        created_at=space.created_at,
        completed_at=space.completed_at,
        current_role=membership.role,
        member_count=count,
    )


@router.get("/{space_id}/members", response_model=MemberListResponse)
async def list_members(
    space_id: str,
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> MemberListResponse:
    stmt = (
        select(Membership)
        .options(selectinload(Membership.user))
        .where(
            Membership.space_id == space_id,
            Membership.removed_at.is_(None),
        )
        .order_by(Membership.joined_at.asc())
    )
    result = await db.execute(stmt)
    memberships = result.scalars().all()

    profiles = [
        MemberProfile(
            user_id=m.user.id,
            display_name=m.user.display_name,
            avatar_asset_id=m.user.avatar_asset_id,
            role=m.role,
            joined_at=m.joined_at,
            is_guest=m.user.is_guest,
            presence_status="online" if m.user.id == membership.user_id else "offline",
        )
        for m in memberships
    ]

    return MemberListResponse(
        space_id=space_id,
        members=profiles,
        total_count=len(profiles),
    )


@router.delete("/{space_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    space_id: str,
    user_id: str,
    membership: Membership = Depends(get_host_membership),
    db: AsyncSession = Depends(get_db),
) -> None:
    if user_id == membership.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Host cannot remove themselves from the Space.",
        )

    stmt = select(Membership).options(selectinload(Membership.user)).where(
        Membership.space_id == space_id,
        Membership.user_id == user_id,
        Membership.removed_at.is_(None),
    )
    result = await db.execute(stmt)
    target_membership = result.scalars().first()

    if not target_membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in this Space.")

    target_membership.removed_at = datetime.now(timezone.utc)

    # Record Activity Event
    event = await record_activity_event(
        db,
        space_id=space_id,
        actor_id=membership.user_id,
        event_type="membership.removed",
        payload={
            "removed_user_id": user_id,
            "removed_display_name": target_membership.user.display_name if target_membership.user else "",
        },
    )

    await db.commit()

    # Broadcast event
    actor_user = await db.get(User, membership.user_id)
    if actor_user:
        await connection_manager.broadcast_to_space(space_id, build_event_envelope(event, actor_user))


@router.post("/{space_id}/invites", response_model=InviteResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    space_id: str,
    payload: CreateInviteRequest = CreateInviteRequest(),
    membership: Membership = Depends(get_host_membership),
    db: AsyncSession = Depends(get_db),
) -> InviteResponse:
    space = await db.get(Space, space_id)
    if space and space.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="space_completed_read_only: This Space is completed and read-only.",
        )

    raw_token, token_hash = generate_invite_token()
    now = datetime.now(timezone.utc)

    expires_at = None
    if payload.expires_in_hours:
        expires_at = now + timedelta(hours=payload.expires_in_hours)

    invite = Invite(
        space_id=space_id,
        token_hash=token_hash,
        mode=payload.mode or "link",
        role_on_join=payload.role_on_join or "member",
        expires_at=expires_at,
        max_uses=payload.max_uses,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    return InviteResponse(
        id=invite.id,
        space_id=invite.space_id,
        token=raw_token,
        mode=invite.mode,
        role_on_join=invite.role_on_join,
        expires_at=invite.expires_at,
        max_uses=invite.max_uses,
        uses_count=invite.uses_count,
        revoked_at=invite.revoked_at,
        created_at=invite.created_at,
        is_valid=True,
    )


@router.post("/{space_id}/complete", response_model=SpaceResponse)
async def complete_space(
    space_id: str,
    membership: Membership = Depends(get_host_membership),
    db: AsyncSession = Depends(get_db),
) -> SpaceResponse:
    space = await db.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found.")

    if space.status == "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Space is already completed.")

    now = datetime.now(timezone.utc)
    space.status = "completed"
    space.completed_at = now

    event = await record_activity_event(
        db,
        space_id=space_id,
        actor_id=membership.user_id,
        event_type="space.completed",
        payload={"completed_at": now.isoformat()},
    )

    await db.commit()
    await db.refresh(space)

    actor_user = await db.get(User, membership.user_id)
    if actor_user:
        await connection_manager.broadcast_to_space(space_id, build_event_envelope(event, actor_user))

    mem_count = await get_space_member_count(db, space_id)
    return build_space_response(space, membership.role, mem_count)


@router.post("/{space_id}/reopen", response_model=SpaceResponse)
async def reopen_space(
    space_id: str,
    membership: Membership = Depends(get_host_membership),
    db: AsyncSession = Depends(get_db),
) -> SpaceResponse:
    space = await db.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found.")

    if space.status == "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Space is already active.")

    space.status = "active"
    space.completed_at = None

    event = await record_activity_event(
        db,
        space_id=space_id,
        actor_id=membership.user_id,
        event_type="space.reopened",
        payload={},
    )

    await db.commit()
    await db.refresh(space)

    actor_user = await db.get(User, membership.user_id)
    if actor_user:
        await connection_manager.broadcast_to_space(space_id, build_event_envelope(event, actor_user))

    mem_count = await get_space_member_count(db, space_id)
    return build_space_response(space, membership.role, mem_count)


@router.get("/{space_id}/summary", response_model=SpaceSummaryDetailResponse)
async def get_space_summary(
    space_id: str,
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> SpaceSummaryDetailResponse:
    space = await db.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found.")

    # 1. Members count
    mem_count = await get_space_member_count(db, space_id)

    # 2. Artifacts count by type
    art_stmt = select(Artifact).where(Artifact.space_id == space_id)
    art_res = await db.execute(art_stmt)
    artifacts = art_res.scalars().all()

    msg_count = sum(1 for a in artifacts if a.type == "message")
    poll_count = sum(1 for a in artifacts if a.type == "poll")
    checklists = [a for a in artifacts if a.type == "checklist"]
    chk_count = len(checklists)

    completed_items = 0
    for chk in checklists:
        items = chk.content.get("items", [])
        completed_items += sum(1 for it in items if it.get("completed"))

    # 3. Assets count and size
    asset_stmt = select(Asset).where(Asset.space_id == space_id, Asset.status == "ready")
    asset_res = await db.execute(asset_stmt)
    assets = asset_res.scalars().all()
    asset_count = len(assets)
    total_asset_bytes = sum(a.size_bytes for a in assets)

    duration_seconds = None
    if space.completed_at and space.created_at:
        duration_seconds = int((space.completed_at - space.created_at).total_seconds())

    return SpaceSummaryDetailResponse(
        space_id=space.id,
        title=space.title,
        template=space.template,
        status=space.status,
        cover_color=space.cover_color,
        member_count=mem_count,
        message_count=msg_count,
        asset_count=asset_count,
        total_asset_bytes=total_asset_bytes,
        poll_count=poll_count,
        checklist_count=chk_count,
        completed_checklist_items=completed_items,
        starts_at=space.starts_at,
        ends_at=space.ends_at,
        created_at=space.created_at,
        completed_at=space.completed_at,
        duration_seconds=duration_seconds,
    )


@router.get("/{space_id}/export", response_model=SpaceExportResponse)
async def export_space(
    space_id: str,
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> SpaceExportResponse:
    space = await db.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found.")

    mem_count = await get_space_member_count(db, space_id)
    space_resp = build_space_response(space, membership.role, mem_count)

    # Fetch Members
    mem_stmt = select(Membership).options(selectinload(Membership.user)).where(
        Membership.space_id == space_id,
        Membership.removed_at.is_(None),
    )
    mem_res = await db.execute(mem_stmt)
    members_data = [
        {
            "user_id": m.user_id,
            "display_name": m.user.display_name if m.user else "",
            "role": m.role,
            "joined_at": m.joined_at.isoformat(),
        }
        for m in mem_res.scalars().all()
    ]

    # Fetch Ordered Activity Events
    ev_stmt = (
        select(ActivityEvent)
        .options(selectinload(ActivityEvent.actor))
        .where(ActivityEvent.space_id == space_id)
        .order_by(ActivityEvent.sequence.asc())
    )
    ev_res = await db.execute(ev_stmt)
    events_data = [
        {
            "sequence": e.sequence,
            "event_id": e.id,
            "type": e.type,
            "occurred_at": e.occurred_at.isoformat(),
            "actor": {"id": e.actor.id, "display_name": e.actor.display_name} if e.actor else None,
            "payload": e.payload,
        }
        for e in ev_res.scalars().all()
    ]

    # Fetch Artifacts
    art_stmt = select(Artifact).where(Artifact.space_id == space_id).order_by(Artifact.created_at.asc())
    art_res = await db.execute(art_stmt)
    artifacts_data = [
        {
            "id": a.id,
            "type": a.type,
            "content": a.content,
            "created_by": a.created_by,
            "created_at": a.created_at.isoformat(),
        }
        for a in art_res.scalars().all()
    ]

    # Fetch Assets
    asset_stmt = select(Asset).where(Asset.space_id == space_id, Asset.status == "ready").order_by(Asset.created_at.asc())
    asset_res = await db.execute(asset_stmt)
    assets_data = [
        {
            "id": a.id,
            "original_name": a.original_name,
            "mime_type": a.mime_type,
            "size_bytes": a.size_bytes,
            "created_at": a.created_at.isoformat(),
        }
        for a in asset_res.scalars().all()
    ]

    return SpaceExportResponse(
        space=space_resp,
        members=members_data,
        activity_events=events_data,
        artifacts=artifacts_data,
        assets=assets_data,
        exported_at=datetime.now(timezone.utc),
    )

