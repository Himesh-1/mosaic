import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.src.auth.permissions import get_active_membership
from apps.api.src.database import get_db
from apps.api.src.models.membership import Membership
from apps.api.src.models.transfer import DirectTransfer
from apps.api.src.models.user import User
from apps.api.src.schemas.activity import EventActorInfo
from apps.api.src.schemas.transfer import (
    DirectTransferIntentRequest,
    DirectTransferResponse,
    IceServerConfig,
    IceServersResponse,
    TransferResponseAction,
    TransferStatusUpdateRequest,
)
from apps.api.src.services.activity import connection_manager
from apps.api.src.services.idempotency import (
    check_idempotency,
    compute_request_fingerprint,
    save_idempotency_receipt,
)

router = APIRouter(prefix="/spaces", tags=["WebRTC Direct Transfers"])


def build_transfer_response(transfer: DirectTransfer, sender: User, recipient: User) -> DirectTransferResponse:
    return DirectTransferResponse(
        id=transfer.id,
        space_id=transfer.space_id,
        sender_id=transfer.sender_id,
        recipient_id=transfer.recipient_id,
        file_name=transfer.file_name,
        mime_type=transfer.mime_type,
        size_bytes=transfer.size_bytes,
        sha256_hash=transfer.sha256_hash,
        status=transfer.status,
        created_at=transfer.created_at,
        completed_at=transfer.completed_at,
        sender=EventActorInfo(
            id=sender.id,
            display_name=sender.display_name,
            avatar_asset_id=sender.avatar_asset_id,
        ),
        recipient=EventActorInfo(
            id=recipient.id,
            display_name=recipient.display_name,
            avatar_asset_id=recipient.avatar_asset_id,
        ),
    )


# 1. Create Direct Transfer Intent (Sender initiates)
@router.post("/{space_id}/transfers/direct/intent", response_model=DirectTransferResponse)
async def create_transfer_intent(
    space_id: str,
    payload: DirectTransferIntentRequest,
    x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id"),
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> DirectTransferResponse:
    mutation_id = payload.client_mutation_id or x_client_mutation_id
    fingerprint = compute_request_fingerprint(
        f"/spaces/{space_id}/transfers/direct/intent", payload.model_dump()
    )

    is_applied, prev_response = await check_idempotency(
        db, membership.user_id, space_id, mutation_id, fingerprint
    )
    if is_applied and prev_response:
        return DirectTransferResponse(**prev_response)

    if payload.recipient_id == membership.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start direct transfer to yourself.",
        )

    # Verify recipient is in the same Space
    recip_stmt = select(Membership).where(
        Membership.space_id == space_id,
        Membership.user_id == payload.recipient_id,
        Membership.removed_at.is_(None),
    )
    recip_res = await db.execute(recip_stmt)
    if not recip_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient is not an active member of this Space.",
        )

    # Fetch user records
    users_stmt = select(User).where(User.id.in_([membership.user_id, payload.recipient_id]))
    users_res = await db.execute(users_stmt)
    users_map = {u.id: u for u in users_res.scalars().all()}
    sender = users_map[membership.user_id]
    recipient = users_map[payload.recipient_id]

    transfer = DirectTransfer(
        space_id=space_id,
        sender_id=membership.user_id,
        recipient_id=payload.recipient_id,
        file_name=payload.file_name,
        mime_type=payload.mime_type,
        size_bytes=payload.size_bytes,
        sha256_hash=payload.sha256_hash,
        status="pending_approval",
    )
    db.add(transfer)
    await db.flush()

    response_obj = build_transfer_response(transfer, sender, recipient)

    await save_idempotency_receipt(
        db, membership.user_id, space_id, mutation_id, fingerprint, response_obj.model_dump(mode="json")
    )

    await db.commit()

    # Notify Space / Recipient over WebSocket
    await connection_manager.broadcast_to_space(
        space_id,
        {
            "type": "direct_transfer.requested",
            "transfer": response_obj.model_dump(mode="json"),
        },
    )

    return response_obj


# 2. Respond to Direct Transfer (Recipient accepts or declines)
@router.post("/{space_id}/transfers/direct/{transfer_id}/respond", response_model=DirectTransferResponse)
async def respond_to_transfer(
    space_id: str,
    transfer_id: str,
    payload: TransferResponseAction,
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> DirectTransferResponse:
    stmt = (
        select(DirectTransfer)
        .options(selectinload(DirectTransfer.sender), selectinload(DirectTransfer.recipient))
        .where(
            DirectTransfer.id == transfer_id,
            DirectTransfer.space_id == space_id,
        )
    )
    res = await db.execute(stmt)
    transfer = res.scalars().first()

    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found.")

    if transfer.recipient_id != membership.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the designated recipient can respond to this transfer.",
        )

    if transfer.status != "pending_approval":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transfer is already in '{transfer.status}' status.",
        )

    transfer.status = "accepted" if payload.action == "accept" else "declined"
    await db.commit()

    response_obj = build_transfer_response(transfer, transfer.sender, transfer.recipient)

    # Notify Space
    await connection_manager.broadcast_to_space(
        space_id,
        {
            "type": "direct_transfer.responded",
            "transfer": response_obj.model_dump(mode="json"),
            "action": payload.action,
        },
    )

    return response_obj


# 3. Update Transfer Status (e.g. transferring, completed, failed, cancelled)
@router.post("/{space_id}/transfers/direct/{transfer_id}/status", response_model=DirectTransferResponse)
async def update_transfer_status(
    space_id: str,
    transfer_id: str,
    payload: TransferStatusUpdateRequest,
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> DirectTransferResponse:
    stmt = (
        select(DirectTransfer)
        .options(selectinload(DirectTransfer.sender), selectinload(DirectTransfer.recipient))
        .where(
            DirectTransfer.id == transfer_id,
            DirectTransfer.space_id == space_id,
        )
    )
    res = await db.execute(stmt)
    transfer = res.scalars().first()

    if not transfer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transfer not found.")

    if transfer.sender_id != membership.user_id and transfer.recipient_id != membership.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only sender or recipient can update transfer status.",
        )

    transfer.status = payload.status
    if payload.status == "completed":
        transfer.completed_at = datetime.now(timezone.utc)

    await db.commit()

    response_obj = build_transfer_response(transfer, transfer.sender, transfer.recipient)

    await connection_manager.broadcast_to_space(
        space_id,
        {
            "type": "direct_transfer.status_changed",
            "transfer": response_obj.model_dump(mode="json"),
            "error_message": payload.error_message,
        },
    )

    return response_obj


# 4. Get ICE Server Configuration
@router.get("/{space_id}/webrtc/ice_servers", response_model=IceServersResponse)
async def get_ice_servers(
    space_id: str,
    membership: Membership = Depends(get_active_membership),
) -> IceServersResponse:
    # MVP ICE Configuration: Public STUN + coturn fallback
    return IceServersResponse(
        ice_servers=[
            IceServerConfig(urls=["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]),
            IceServerConfig(urls=["stun:localhost:3478"]),
        ]
    )
