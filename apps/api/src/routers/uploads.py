import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.api.src.auth.permissions import get_active_membership
from apps.api.src.database import get_db
from apps.api.src.models.artifact import Artifact
from apps.api.src.models.asset import Asset
from apps.api.src.models.membership import Membership
from apps.api.src.models.space import Space
from apps.api.src.models.user import User
from apps.api.src.schemas.activity import EventActorInfo
from apps.api.src.schemas.asset import (
    AssetListResponse,
    AssetResponse,
    AssetUrlResponse,
    CompleteUploadRequest,
    SignUploadRequest,
    SignUploadResponse,
)
from apps.api.src.services.activity import build_event_envelope, connection_manager, record_activity_event
from apps.api.src.services.idempotency import (
    check_idempotency,
    compute_request_fingerprint,
    save_idempotency_receipt,
)
from apps.api.src.services.storage import storage_service

router = APIRouter(prefix="/spaces", tags=["Uploads & Assets"])


async def ensure_space_active(space_id: str, db: AsyncSession) -> None:
    space = await db.get(Space, space_id)
    if space and space.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="space_completed_read_only: This Space is completed and read-only.",
        )


def build_asset_response(asset: Asset, uploader: User) -> AssetResponse:
    download_url = None
    if asset.status == "ready":
        download_url = storage_service.generate_presigned_download_url(
            storage_key=asset.storage_key,
            original_name=asset.original_name,
            expires_in_seconds=900,
        )

    return AssetResponse(
        id=asset.id,
        space_id=asset.space_id,
        uploader_id=asset.uploader_id,
        original_name=asset.original_name,
        mime_type=asset.mime_type,
        size_bytes=asset.size_bytes,
        sha256_hash=asset.sha256_hash,
        storage_key=asset.storage_key,
        thumbnail_key=asset.thumbnail_key,
        download_url=download_url,
        status=asset.status,
        created_at=asset.created_at,
        completed_at=asset.completed_at,
        uploader=EventActorInfo(
            id=uploader.id,
            display_name=uploader.display_name,
            avatar_asset_id=uploader.avatar_asset_id,
        ),
    )


# 1. Sign Upload Request (Get direct presigned PUT URL)
@router.post("/{space_id}/uploads/sign", response_model=SignUploadResponse)
async def sign_upload(
    space_id: str,
    payload: SignUploadRequest,
    x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id"),
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> SignUploadResponse:
    await ensure_space_active(space_id, db)
    mutation_id = payload.client_mutation_id or x_client_mutation_id
    fingerprint = compute_request_fingerprint(f"/spaces/{space_id}/uploads/sign", payload.model_dump())

    is_applied, prev_response = await check_idempotency(
        db, membership.user_id, space_id, mutation_id, fingerprint
    )
    if is_applied and prev_response:
        return SignUploadResponse(**prev_response)

    if payload.size_bytes <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size must be greater than 0.")

    if payload.size_bytes > 52428800:  # 50 MB
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum upload limit of 50 MB.",
        )

    clean_name = payload.original_name.strip()
    if not clean_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File name cannot be empty.")

    asset_id = str(uuid.uuid4())
    storage_key = f"spaces/{space_id}/assets/{asset_id}/{clean_name}"

    asset = Asset(
        id=asset_id,
        space_id=space_id,
        uploader_id=membership.user_id,
        original_name=payload.original_name,
        mime_type=payload.mime_type,
        size_bytes=payload.size_bytes,
        storage_key=storage_key,
        status="pending_upload",
    )
    db.add(asset)

    presigned = storage_service.generate_presigned_upload_url(
        storage_key=storage_key,
        mime_type=payload.mime_type,
        expires_in_seconds=900,
    )

    response_obj = SignUploadResponse(
        asset_id=asset_id,
        upload_url=presigned["upload_url"],
        method=presigned["method"],
        headers=presigned["headers"],
        expires_in_seconds=presigned["expires_in_seconds"],
    )

    await save_idempotency_receipt(
        db, membership.user_id, space_id, mutation_id, fingerprint, response_obj.model_dump(mode="json")
    )

    await db.commit()
    return response_obj


# 2. Complete Upload (Mark ready, create file Artifact & ActivityEvent)
@router.post("/{space_id}/uploads/{asset_id}/complete", response_model=AssetResponse)
async def complete_upload(
    space_id: str,
    asset_id: str,
    payload: CompleteUploadRequest,
    x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id"),
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> AssetResponse:
    mutation_id = payload.client_mutation_id or x_client_mutation_id
    fingerprint = compute_request_fingerprint(
        f"/spaces/{space_id}/uploads/{asset_id}/complete", payload.model_dump()
    )

    is_applied, prev_response = await check_idempotency(
        db, membership.user_id, space_id, mutation_id, fingerprint
    )
    if is_applied and prev_response:
        return AssetResponse(**prev_response)

    stmt = select(Asset).options(selectinload(Asset.uploader)).where(
        Asset.id == asset_id,
        Asset.space_id == space_id,
    )
    res = await db.execute(stmt)
    asset = res.scalars().first()

    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    if asset.uploader_id != membership.user_id and membership.role != "host":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to complete this upload.")

    now = datetime.now(timezone.utc)
    asset.status = "ready"
    asset.completed_at = now
    if payload.sha256_hash:
        asset.sha256_hash = payload.sha256_hash

    # Create associated File Artifact
    artifact = Artifact(
        space_id=space_id,
        type="file",
        created_by=membership.user_id,
        content={
            "asset_id": asset.id,
            "original_name": asset.original_name,
            "mime_type": asset.mime_type,
            "size_bytes": asset.size_bytes,
            "storage_key": asset.storage_key,
        },
    )
    db.add(artifact)
    await db.flush()

    # Record Activity Event
    event = await record_activity_event(
        db,
        space_id=space_id,
        actor_id=membership.user_id,
        event_type="artifact.created",
        payload={
            "artifact_id": artifact.id,
            "asset_id": asset.id,
            "type": "file",
            "original_name": asset.original_name,
            "mime_type": asset.mime_type,
            "size_bytes": asset.size_bytes,
        },
        artifact_id=artifact.id,
    )

    response_obj = build_asset_response(asset, asset.uploader)

    await save_idempotency_receipt(
        db, membership.user_id, space_id, mutation_id, fingerprint, response_obj.model_dump(mode="json")
    )

    await db.commit()

    # Realtime Broadcast
    await connection_manager.broadcast_to_space(space_id, build_event_envelope(event, asset.uploader))

    return response_obj


# 3. Get Private Download / View URL
@router.get("/{space_id}/assets/{asset_id}/url", response_model=AssetUrlResponse)
async def get_asset_download_url(
    space_id: str,
    asset_id: str,
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> AssetUrlResponse:
    stmt = select(Asset).where(
        Asset.id == asset_id,
        Asset.space_id == space_id,
        Asset.status == "ready",
    )
    res = await db.execute(stmt)
    asset = res.scalars().first()

    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found or not ready.")

    presigned_url = storage_service.generate_presigned_download_url(
        storage_key=asset.storage_key,
        original_name=asset.original_name,
        expires_in_seconds=900,
    )

    return AssetUrlResponse(
        asset_id=asset.id,
        download_url=presigned_url,
        expires_in_seconds=900,
    )


# 4. List Space Gallery Assets
@router.get("/{space_id}/assets", response_model=AssetListResponse)
async def list_space_assets(
    space_id: str,
    limit: int = Query(50, ge=1, le=100),
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> AssetListResponse:
    stmt = (
        select(Asset)
        .options(selectinload(Asset.uploader))
        .where(
            Asset.space_id == space_id,
            Asset.status == "ready",
        )
        .order_by(Asset.created_at.desc())
        .limit(limit)
    )
    res = await db.execute(stmt)
    assets = res.scalars().all()

    asset_responses = [
        build_asset_response(a, a.uploader)
        for a in assets
    ]

    return AssetListResponse(
        space_id=space_id,
        assets=asset_responses,
        total_count=len(asset_responses),
    )
