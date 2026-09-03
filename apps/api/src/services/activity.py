import json
import logging
from datetime import datetime, timezone
from typing import Dict, Set, Optional, Any, Tuple
from fastapi import WebSocket
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.models.activity import ActivityEvent
from apps.api.src.models.user import User

logger = logging.getLogger("mosaic.activity")


class ConnectionManager:
    """Manages active WebSockets and subscriptions per Space."""

    def __init__(self):
        # space_id -> set of (WebSocket, session_id, user_id)
        self._space_subscriptions: Dict[str, Set[Tuple[WebSocket, str, str]]] = {}
        # active websocket -> (session_id, user_id)
        self._active_sockets: Dict[WebSocket, Tuple[str, str]] = {}

    def register(self, websocket: WebSocket, session_id: str, user_id: str) -> None:
        self._active_sockets[websocket] = (session_id, user_id)

    def subscribe(self, websocket: WebSocket, space_id: str, session_id: str, user_id: str) -> None:
        if space_id not in self._space_subscriptions:
            self._space_subscriptions[space_id] = set()
        self._space_subscriptions[space_id].add((websocket, session_id, user_id))

    def unsubscribe(self, websocket: WebSocket, space_id: str) -> None:
        if space_id in self._space_subscriptions:
            self._space_subscriptions[space_id] = {
                sub for sub in self._space_subscriptions[space_id] if sub[0] != websocket
            }

    def disconnect(self, websocket: WebSocket) -> None:
        self._active_sockets.pop(websocket, None)
        for space_id in list(self._space_subscriptions.keys()):
            self._space_subscriptions[space_id] = {
                sub for sub in self._space_subscriptions[space_id] if sub[0] != websocket
            }

    def get_active_user_ids(self, space_id: str) -> Set[str]:
        """Returns the set of user IDs currently subscribed via WebSocket to space_id."""
        if space_id not in self._space_subscriptions:
            return set()
        return {user_id for _, _, user_id in self._space_subscriptions[space_id]}

    async def broadcast_to_space(self, space_id: str, message: dict) -> None:
        """Broadcast JSON message to all active WebSocket clients subscribed to space_id."""
        if space_id not in self._space_subscriptions:
            return

        dead_sockets = []
        for ws, session_id, user_id in list(self._space_subscriptions[space_id]):
            try:
                await ws.send_json(message)
            except Exception:
                dead_sockets.append(ws)

        for ws in dead_sockets:
            self.disconnect(ws)


connection_manager = ConnectionManager()


async def record_activity_event(
    db: AsyncSession,
    space_id: str,
    actor_id: str,
    event_type: str,
    payload: Dict[str, Any],
    artifact_id: Optional[str] = None,
) -> ActivityEvent:
    """
    Atomically allocates the next sequence number and creates an ActivityEvent.
    Must be called inside the active DB transaction.
    """
    # 1. Allocate next sequence in transaction
    seq_stmt = select(func.coalesce(func.max(ActivityEvent.sequence), 0) + 1).where(
        ActivityEvent.space_id == space_id
    )
    seq_res = await db.execute(seq_stmt)
    next_sequence = seq_res.scalar_one()

    # 2. Insert ActivityEvent
    now = datetime.now(timezone.utc)
    event = ActivityEvent(
        space_id=space_id,
        sequence=next_sequence,
        type=event_type,
        actor_id=actor_id,
        artifact_id=artifact_id,
        payload=payload,
        occurred_at=now,
    )
    db.add(event)
    await db.flush()

    return event


def build_event_envelope(event: ActivityEvent, actor: User) -> dict:
    """Format ActivityEvent into the standard SYSTEM_DESIGN.md JSON envelope."""
    occurred = event.occurred_at
    if occurred.tzinfo is None:
        occurred = occurred.replace(tzinfo=timezone.utc)

    return {
        "event_id": event.id,
        "space_id": event.space_id,
        "sequence": event.sequence,
        "type": event.type,
        "occurred_at": occurred.isoformat(),
        "actor": {
            "id": actor.id,
            "display_name": actor.display_name,
            "avatar_asset_id": actor.avatar_asset_id,
        },
        "data": event.payload,
    }
