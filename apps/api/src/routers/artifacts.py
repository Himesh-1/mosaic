import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from apps.api.src.auth.permissions import get_active_membership
from apps.api.src.database import get_db
from apps.api.src.models.artifact import Artifact
from apps.api.src.models.membership import Membership
from apps.api.src.models.space import Space
from apps.api.src.models.user import User
from apps.api.src.schemas.activity import EventActorInfo
from apps.api.src.schemas.artifact import (
    ArtifactListResponse,
    ArtifactResponse,
    CreateChecklistRequest,
    CreateMessageRequest,
    CreatePollRequest,
    ToggleChecklistItemRequest,
    VotePollRequest,
)
from apps.api.src.services.activity import build_event_envelope, connection_manager, record_activity_event
from apps.api.src.services.idempotency import (
    check_idempotency,
    compute_request_fingerprint,
    save_idempotency_receipt,
)

router = APIRouter(prefix="/spaces", tags=["Artifacts"])


async def ensure_space_active(space_id: str, db: AsyncSession) -> None:
    space = await db.get(Space, space_id)
    if space and space.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="space_completed_read_only: This Space is completed and read-only.",
        )


def build_artifact_response(artifact: Artifact, creator: User) -> ArtifactResponse:
    return ArtifactResponse(
        id=artifact.id,
        space_id=artifact.space_id,
        type=artifact.type,
        created_by=artifact.created_by,
        status=artifact.status,
        content=artifact.content,
        created_at=artifact.created_at,
        updated_at=artifact.updated_at,
        creator=EventActorInfo(
            id=creator.id,
            display_name=creator.display_name,
            avatar_asset_id=creator.avatar_asset_id,
        ),
    )


# 1. Create Message
@router.post("/{space_id}/messages", response_model=ArtifactResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    space_id: str,
    payload: CreateMessageRequest,
    x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id"),
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> ArtifactResponse:
    await ensure_space_active(space_id, db)
    mutation_id = payload.client_mutation_id or x_client_mutation_id
    fingerprint = compute_request_fingerprint(f"/spaces/{space_id}/messages", payload.model_dump())

    # Check Idempotency
    is_applied, prev_response = await check_idempotency(
        db, membership.user_id, space_id, mutation_id, fingerprint
    )
    if is_applied and prev_response:
        return ArtifactResponse(**prev_response)

    creator = await db.get(User, membership.user_id)
    if not creator:
        raise HTTPException(status_code=404, detail="User not found.")

    artifact = Artifact(
        space_id=space_id,
        type="message",
        created_by=membership.user_id,
        content={"text": payload.text},
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
            "type": "message",
            "text": payload.text,
        },
        artifact_id=artifact.id,
    )

    response_obj = build_artifact_response(artifact, creator)

    # Save Idempotency Receipt
    await save_idempotency_receipt(
        db, membership.user_id, space_id, mutation_id, fingerprint, response_obj.model_dump(mode="json")
    )

    await db.commit()

    # Realtime Broadcast
    await connection_manager.broadcast_to_space(space_id, build_event_envelope(event, creator))

    return response_obj


# 2. Create Poll
@router.post("/{space_id}/polls", response_model=ArtifactResponse, status_code=status.HTTP_201_CREATED)
async def create_poll(
    space_id: str,
    payload: CreatePollRequest,
    x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id"),
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> ArtifactResponse:
    await ensure_space_active(space_id, db)
    mutation_id = payload.client_mutation_id or x_client_mutation_id
    fingerprint = compute_request_fingerprint(f"/spaces/{space_id}/polls", payload.model_dump())

    is_applied, prev_response = await check_idempotency(
        db, membership.user_id, space_id, mutation_id, fingerprint
    )
    if is_applied and prev_response:
        return ArtifactResponse(**prev_response)

    creator = await db.get(User, membership.user_id)
    if not creator:
        raise HTTPException(status_code=404, detail="User not found.")

    options = [
        {"id": str(i + 1), "label": opt.strip(), "votes": []}
        for i, opt in enumerate(payload.options)
    ]

    artifact = Artifact(
        space_id=space_id,
        type="poll",
        created_by=membership.user_id,
        content={
            "question": payload.question.strip(),
            "options": options,
            "allow_multiple": payload.allow_multiple,
        },
    )
    db.add(artifact)
    await db.flush()

    event = await record_activity_event(
        db,
        space_id=space_id,
        actor_id=membership.user_id,
        event_type="artifact.created",
        payload={
            "artifact_id": artifact.id,
            "type": "poll",
            "question": payload.question.strip(),
        },
        artifact_id=artifact.id,
    )

    response_obj = build_artifact_response(artifact, creator)

    await save_idempotency_receipt(
        db, membership.user_id, space_id, mutation_id, fingerprint, response_obj.model_dump(mode="json")
    )

    await db.commit()
    await connection_manager.broadcast_to_space(space_id, build_event_envelope(event, creator))

    return response_obj


# 3. Vote on Poll
@router.post("/{space_id}/polls/{poll_id}/vote", response_model=ArtifactResponse)
async def vote_poll(
    space_id: str,
    poll_id: str,
    payload: VotePollRequest,
    x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id"),
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> ArtifactResponse:
    await ensure_space_active(space_id, db)
    mutation_id = payload.client_mutation_id or x_client_mutation_id
    fingerprint = compute_request_fingerprint(f"/spaces/{space_id}/polls/{poll_id}/vote", payload.model_dump())

    is_applied, prev_response = await check_idempotency(
        db, membership.user_id, space_id, mutation_id, fingerprint
    )
    if is_applied and prev_response:
        return ArtifactResponse(**prev_response)

    stmt = select(Artifact).options(selectinload(Artifact.creator)).where(
        Artifact.id == poll_id,
        Artifact.space_id == space_id,
        Artifact.type == "poll",
    )
    res = await db.execute(stmt)
    artifact = res.scalars().first()

    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Poll not found.")

    poll_content = dict(artifact.content)
    options = poll_content.get("options", [])
    allow_multiple = poll_content.get("allow_multiple", False)
    user_id = membership.user_id

    # Update votes
    for opt in options:
        current_votes = set(opt.get("votes", []))
        if opt["id"] in payload.option_ids:
            if not allow_multiple:
                # Remove user from all other options
                for other in options:
                    if other["id"] != opt["id"]:
                        other["votes"] = [v for v in other.get("votes", []) if v != user_id]
            current_votes.add(user_id)
        else:
            if not allow_multiple:
                current_votes.discard(user_id)
        opt["votes"] = list(current_votes)

    artifact.content = poll_content
    flag_modified(artifact, "content")
    await db.flush()

    actor = await db.get(User, user_id)
    event = await record_activity_event(
        db,
        space_id=space_id,
        actor_id=user_id,
        event_type="poll.voted",
        payload={
            "artifact_id": artifact.id,
            "poll_question": poll_content.get("question"),
            "voter_user_id": user_id,
            "voter_display_name": actor.display_name if actor else "",
            "content": poll_content,
        },
        artifact_id=artifact.id,
    )

    response_obj = build_artifact_response(artifact, artifact.creator)

    await save_idempotency_receipt(
        db, user_id, space_id, mutation_id, fingerprint, response_obj.model_dump(mode="json")
    )

    await db.commit()
    if actor:
        await connection_manager.broadcast_to_space(space_id, build_event_envelope(event, actor))

    return response_obj


# 4. Create Checklist
@router.post("/{space_id}/checklists", response_model=ArtifactResponse, status_code=status.HTTP_201_CREATED)
async def create_checklist(
    space_id: str,
    payload: CreateChecklistRequest,
    x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id"),
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> ArtifactResponse:
    await ensure_space_active(space_id, db)
    mutation_id = payload.client_mutation_id or x_client_mutation_id
    fingerprint = compute_request_fingerprint(f"/spaces/{space_id}/checklists", payload.model_dump())

    is_applied, prev_response = await check_idempotency(
        db, membership.user_id, space_id, mutation_id, fingerprint
    )
    if is_applied and prev_response:
        return ArtifactResponse(**prev_response)

    creator = await db.get(User, membership.user_id)
    if not creator:
        raise HTTPException(status_code=404, detail="User not found.")

    items = [
        {"id": str(i + 1), "text": item.strip(), "completed": False, "completed_by": None}
        for i, item in enumerate(payload.items)
    ]

    artifact = Artifact(
        space_id=space_id,
        type="checklist",
        created_by=membership.user_id,
        content={"title": payload.title.strip(), "items": items},
    )
    db.add(artifact)
    await db.flush()

    event = await record_activity_event(
        db,
        space_id=space_id,
        actor_id=membership.user_id,
        event_type="artifact.created",
        payload={
            "artifact_id": artifact.id,
            "type": "checklist",
            "title": payload.title.strip(),
        },
        artifact_id=artifact.id,
    )

    response_obj = build_artifact_response(artifact, creator)

    await save_idempotency_receipt(
        db, membership.user_id, space_id, mutation_id, fingerprint, response_obj.model_dump(mode="json")
    )

    await db.commit()
    await connection_manager.broadcast_to_space(space_id, build_event_envelope(event, creator))

    return response_obj


# 5. Toggle Checklist Item
@router.patch("/{space_id}/checklists/{checklist_id}/items/{item_id}", response_model=ArtifactResponse)
async def toggle_checklist_item(
    space_id: str,
    checklist_id: str,
    item_id: str,
    payload: ToggleChecklistItemRequest,
    x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id"),
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> ArtifactResponse:
    await ensure_space_active(space_id, db)
    mutation_id = payload.client_mutation_id or x_client_mutation_id
    fingerprint = compute_request_fingerprint(
        f"/spaces/{space_id}/checklists/{checklist_id}/items/{item_id}", payload.model_dump()
    )

    is_applied, prev_response = await check_idempotency(
        db, membership.user_id, space_id, mutation_id, fingerprint
    )
    if is_applied and prev_response:
        return ArtifactResponse(**prev_response)

    stmt = select(Artifact).options(selectinload(Artifact.creator)).where(
        Artifact.id == checklist_id,
        Artifact.space_id == space_id,
        Artifact.type == "checklist",
    )
    res = await db.execute(stmt)
    artifact = res.scalars().first()

    if not artifact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist not found.")

    checklist_content = dict(artifact.content)
    items = checklist_content.get("items", [])
    toggled_item = None

    for it in items:
        if it["id"] == item_id:
            it["completed"] = payload.completed
            it["completed_by"] = membership.user_id if payload.completed else None
            toggled_item = it
            break

    if not toggled_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist item not found.")

    artifact.content = checklist_content
    flag_modified(artifact, "content")
    await db.flush()

    actor = await db.get(User, membership.user_id)
    event = await record_activity_event(
        db,
        space_id=space_id,
        actor_id=membership.user_id,
        event_type="checklist.updated",
        payload={
            "artifact_id": artifact.id,
            "checklist_title": checklist_content.get("title"),
            "item_id": item_id,
            "item_text": toggled_item["text"],
            "completed": payload.completed,
            "content": checklist_content,
        },
        artifact_id=artifact.id,
    )

    response_obj = build_artifact_response(artifact, artifact.creator)

    await save_idempotency_receipt(
        db, membership.user_id, space_id, mutation_id, fingerprint, response_obj.model_dump(mode="json")
    )

    await db.commit()
    if actor:
        await connection_manager.broadcast_to_space(space_id, build_event_envelope(event, actor))

    return response_obj


# 6. List Artifacts
@router.get("/{space_id}/artifacts", response_model=ArtifactListResponse)
async def list_artifacts(
    space_id: str,
    type: Optional[str] = Query(None, description="Filter by artifact type: message, poll, checklist"),
    limit: int = Query(50, ge=1, le=100),
    membership: Membership = Depends(get_active_membership),
    db: AsyncSession = Depends(get_db),
) -> ArtifactListResponse:
    stmt = (
        select(Artifact)
        .options(selectinload(Artifact.creator))
        .where(
            Artifact.space_id == space_id,
            Artifact.status == "active",
        )
    )
    if type:
        stmt = stmt.where(Artifact.type == type)

    stmt = stmt.order_by(Artifact.created_at.asc()).limit(limit)
    res = await db.execute(stmt)
    artifacts = res.scalars().all()

    artifact_responses = [
        build_artifact_response(a, a.creator)
        for a in artifacts
    ]

    return ArtifactListResponse(
        space_id=space_id,
        artifacts=artifact_responses,
        total_count=len(artifact_responses),
    )
