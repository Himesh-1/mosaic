from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.src.auth.permissions import get_active_membership
from apps.api.src.database import get_db
from apps.api.src.models.activity import ActivityEvent
from apps.api.src.models.membership import Membership
from apps.api.src.schemas.activity import (
    ActivityEventResponse,
    ActivityFeedResponse,
    EventActorInfo,
)

router = APIRouter(prefix="/spaces", tags=["Activity"])


@router.get("/{space_id}/activity", response_model=ActivityFeedResponse)
async def get_space_activity(
    space_id: str,
    after_sequence: int = Query(0, ge=0, description="Fetch events occurred strictly after this sequence"),
    limit: int = Query(50, ge=1, le=100, description="Max events to return"),
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> ActivityFeedResponse:
    # 1. Fetch events ordered by sequence ASC
    stmt = (
        select(ActivityEvent)
        .options(selectinload(ActivityEvent.actor))
        .where(
            ActivityEvent.space_id == space_id,
            ActivityEvent.sequence > after_sequence,
        )
        .order_by(ActivityEvent.sequence.asc())
        .limit(limit + 1)
    )
    result = await db.execute(stmt)
    events = result.scalars().all()

    has_more = len(events) > limit
    events_to_return = events[:limit]

    # 2. Get latest allocated sequence for the Space
    max_stmt = select(func.coalesce(func.max(ActivityEvent.sequence), 0)).where(
        ActivityEvent.space_id == space_id
    )
    max_res = await db.execute(max_stmt)
    latest_sequence = max_res.scalar_one()

    event_responses = [
        ActivityEventResponse(
            event_id=ev.id,
            space_id=ev.space_id,
            sequence=ev.sequence,
            type=ev.type,
            occurred_at=ev.occurred_at,
            actor=EventActorInfo(
                id=ev.actor.id,
                display_name=ev.actor.display_name,
                avatar_asset_id=ev.actor.avatar_asset_id,
            ),
            data=ev.payload,
        )
        for ev in events_to_return
    ]

    return ActivityFeedResponse(
        space_id=space_id,
        events=event_responses,
        latest_sequence=latest_sequence,
        has_more=has_more,
    )
