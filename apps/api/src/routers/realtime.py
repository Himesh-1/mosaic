import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.src.config import get_settings
import apps.api.src.database as db_module
from apps.api.src.models.activity import ActivityEvent
from apps.api.src.models.membership import Membership
from apps.api.src.models.session import DeviceSession
from apps.api.src.models.user import User
from apps.api.src.services.activity import build_event_envelope, connection_manager
from apps.api.src.services.presence import presence_service

logger = logging.getLogger("mosaic.realtime")
settings = get_settings()

router = APIRouter(tags=["Realtime"])


async def authenticate_websocket(websocket: WebSocket) -> Optional[Tuple[DeviceSession, User]]:
    # 1. Try from cookie
    session_token = websocket.cookies.get(settings.SESSION_COOKIE_NAME)

    # 2. Try from query parameter ?token=
    if not session_token:
        session_token = websocket.query_params.get("token")

    # 3. Try from Authorization header
    if not session_token:
        auth_hdr = websocket.headers.get("authorization")
        if auth_hdr and auth_hdr.startswith("Bearer "):
            session_token = auth_hdr[7:]

    if not session_token:
        logger.warning(
            f"WebSocket authentication rejected: no token provided. "
            f"Cookies: {list(websocket.cookies.keys())}, Query params: {list(websocket.query_params.keys())}"
        )
        return None

    clean_token = session_token.strip().strip('"').strip("'")

    now = datetime.now(timezone.utc)
    async with db_module.AsyncSessionLocal() as db:
        stmt = (
            select(DeviceSession)
            .options(selectinload(DeviceSession.user))
            .where(
                (DeviceSession.session_token == clean_token) | (DeviceSession.id == clean_token),
                DeviceSession.revoked_at.is_(None),
            )
        )
        result = await db.execute(stmt)
        device_session = result.scalars().first()

        if not device_session or not device_session.user:
            logger.warning(f"WebSocket authentication rejected: no active session found for token prefix '{clean_token[:8]}...'")
            return None

        exp = device_session.expires_at if device_session.expires_at.tzinfo else device_session.expires_at.replace(tzinfo=timezone.utc)
        if exp <= now:
            logger.warning(f"WebSocket authentication rejected: session expired at {exp}")
            return None

        # Update last seen
        device_session.last_seen_at = now
        await db.commit()
        return device_session, device_session.user


@router.websocket("/realtime")
async def websocket_realtime_endpoint(
    websocket: WebSocket,
):
    await websocket.accept()

    session_user = await authenticate_websocket(websocket)
    if not session_user:
        await websocket.send_json({
            "type": "error",
            "code": "unauthorized",
            "message": "Authentication required. Provide valid session cookie or ?token= parameter.",
        })
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    device_session, user = session_user

    connection_manager.register(websocket, device_session.id, user.id)
    logger.info(f"WebSocket connected: user {user.id} ({user.display_name})")

    # Send Welcome
    await websocket.send_json({
        "type": "welcome",
        "session_id": device_session.id,
        "user_id": user.id,
        "server_time": datetime.now(timezone.utc).isoformat(),
    })

    subscribed_spaces = set()

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                msg = json.loads(raw_text)
            except Exception:
                continue

            msg_type = msg.get("type")

            # 1. Handle Subscribe
            if msg_type == "subscribe":
                space_id = msg.get("space_id")
                after_sequence = msg.get("after_sequence", 0)

                if not space_id:
                    continue

                # Verify active membership and fetch missed events in short-lived DB session
                missed_events = []
                membership_valid = False
                async with db_module.AsyncSessionLocal() as db:
                    mem_stmt = select(Membership).where(
                        Membership.space_id == space_id,
                        Membership.user_id == user.id,
                        Membership.removed_at.is_(None),
                    )
                    mem_res = await db.execute(mem_stmt)
                    membership = mem_res.scalars().first()

                    if membership:
                        membership_valid = True
                        if after_sequence is not None:
                            ev_stmt = (
                                select(ActivityEvent)
                                .options(selectinload(ActivityEvent.actor))
                                .where(
                                    ActivityEvent.space_id == space_id,
                                    ActivityEvent.sequence > after_sequence,
                                )
                                .order_by(ActivityEvent.sequence.asc())
                            )
                            ev_res = await db.execute(ev_stmt)
                            missed_events = ev_res.scalars().all()

                if not membership_valid:
                    await websocket.send_json({
                        "type": "error",
                        "code": "unauthorized_space",
                        "message": "You do not have access to this Space.",
                    })
                    continue

                # Register subscription
                connection_manager.subscribe(websocket, space_id, device_session.id, user.id)
                subscribed_spaces.add(space_id)

                # Mark presence
                await presence_service.heartbeat(
                    space_id=space_id,
                    session_id=device_session.id,
                    user_id=user.id,
                    display_name=user.display_name,
                )

                # Acknowledge subscription
                await websocket.send_json({
                    "type": "subscribed",
                    "space_id": space_id,
                })

                # Deliver missed events
                for ev in missed_events:
                    envelope = build_event_envelope(ev, ev.actor)
                    await websocket.send_json(envelope)

            # 2. Handle Presence Heartbeat
            elif msg_type == "presence.heartbeat":
                space_id = msg.get("space_id")
                if space_id in subscribed_spaces:
                    await presence_service.heartbeat(
                        space_id=space_id,
                        session_id=device_session.id,
                        user_id=user.id,
                        display_name=user.display_name,
                    )

            # 3. Handle WebRTC Direct Transfer Signaling (SDP offer/answer, ICE candidates)
            elif msg_type == "direct_transfer.signal":
                space_id = msg.get("space_id")
                target_user_id = msg.get("target_user_id")
                signal_data = msg.get("signal")
                transfer_id = msg.get("transfer_id")

                if space_id in subscribed_spaces and signal_data:
                    # Broadcast or relay signal to the Space
                    await connection_manager.broadcast_to_space(
                        space_id,
                        {
                            "type": "direct_transfer.signal",
                            "space_id": space_id,
                            "sender_user_id": user.id,
                            "target_user_id": target_user_id,
                            "transfer_id": transfer_id,
                            "signal": signal_data,
                        },
                    )

    except (WebSocketDisconnect, asyncio.CancelledError):
        logger.info(f"WebSocket closed/disconnected: user {user.id}")
    except Exception as exc:
        logger.warning(f"Unexpected WebSocket error for user {user.id}: {exc}")
    finally:
        try:
            connection_manager.disconnect(websocket)
        except Exception:
            pass

        for s_id in list(subscribed_spaces):
            try:
                await presence_service.remove_session(s_id, device_session.id)
            except (Exception, asyncio.CancelledError, BaseException):
                pass
