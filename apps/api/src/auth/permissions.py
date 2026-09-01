from typing import Tuple
from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.auth.session import get_current_user_and_session
from apps.api.src.database import get_db
from apps.api.src.models.membership import Membership
from apps.api.src.models.session import DeviceSession
from apps.api.src.models.user import User


async def get_active_membership(
    space_id: str,
    current: Tuple[DeviceSession, User] = Depends(get_current_user_and_session),
    db: AsyncSession = Depends(get_db),
) -> Membership:
    _, user = current
    stmt = select(Membership).where(
        Membership.space_id == space_id,
        Membership.user_id == user.id,
        Membership.removed_at.is_(None),
    )
    result = await db.execute(stmt)
    membership = result.scalars().first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this Space.",
        )
    return membership


async def get_host_membership(
    space_id: str,
    current: Tuple[DeviceSession, User] = Depends(get_current_user_and_session),
    db: AsyncSession = Depends(get_db),
) -> Membership:
    membership = await get_active_membership(space_id, current, db)
    if membership.role != "host":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Host permissions required for this action.",
        )
    return membership
