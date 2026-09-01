import logging
from datetime import datetime, timezone
from sqlalchemy import delete, select
from apps.api.src.database import async_session_factory
from apps.api.src.models.session import DeviceSession
from apps.api.src.models.invite import Invite

logger = logging.getLogger("mosaic.worker.cleanup")


async def cleanup_expired_sessions() -> int:
    """Clean up expired device sessions from database."""
    now = datetime.now(timezone.utc)
    try:
        async with async_session_factory() as session:
            stmt = delete(DeviceSession).where(DeviceSession.expires_at < now)
            result = await session.execute(stmt)
            await session.commit()
            deleted_count = result.rowcount or 0
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} expired device sessions.")
            return deleted_count
    except Exception as exc:
        logger.error(f"Failed to clean up expired sessions: {exc}")
        return 0


async def cleanup_expired_invites() -> int:
    """Clean up or revoke expired invites."""
    now = datetime.now(timezone.utc)
    try:
        async with async_session_factory() as session:
            stmt = select(Invite).where(
                Invite.expires_at < now,
                Invite.revoked_at.is_(None),
            )
            result = await session.execute(stmt)
            expired_invites = result.scalars().all()
            for inv in expired_invites:
                inv.revoked_at = now

            await session.commit()
            count = len(expired_invites)
            if count > 0:
                logger.info(f"Revoked {count} expired invites.")
            return count
    except Exception as exc:
        logger.error(f"Failed to clean up expired invites: {exc}")
        return 0
