import hashlib
import json
from typing import Any, Dict, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.models.receipt import MutationReceipt


def compute_request_fingerprint(path: str, body_dict: Optional[Dict[str, Any]] = None) -> str:
    """Computes a SHA-256 fingerprint for a request path and payload."""
    serialized = json.dumps(body_dict or {}, sort_keys=True, default=str)
    raw = f"{path}:{serialized}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


async def check_idempotency(
    db: AsyncSession,
    actor_id: str,
    space_id: str,
    client_mutation_id: Optional[str],
    fingerprint: str,
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Checks if a mutation with this client_mutation_id was already applied.
    Returns (is_applied, response_payload).
    Raises 409 if the key is reused with a different request fingerprint.
    """
    if not client_mutation_id:
        return False, None

    stmt = select(MutationReceipt).where(
        MutationReceipt.actor_id == actor_id,
        MutationReceipt.client_mutation_id == client_mutation_id,
    )
    result = await db.execute(stmt)
    receipt = result.scalars().first()

    if receipt:
        if receipt.request_hash == fingerprint:
            return True, receipt.response_payload
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="idempotency_key_reused: The mutation key has already been used for a different request.",
            )

    return False, None


async def save_idempotency_receipt(
    db: AsyncSession,
    actor_id: str,
    space_id: str,
    client_mutation_id: Optional[str],
    fingerprint: str,
    response_payload: Dict[str, Any],
    operation: str = "mutation",
) -> None:
    """Saves the mutation outcome in the active database transaction."""
    if not client_mutation_id:
        return

    receipt = MutationReceipt(
        space_id=space_id,
        actor_id=actor_id,
        client_mutation_id=client_mutation_id,
        operation=operation,
        request_hash=fingerprint,
        outcome="applied",
        response_payload=response_payload,
    )
    db.add(receipt)
