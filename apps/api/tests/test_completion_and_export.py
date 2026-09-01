import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_space_completion_lifecycle_and_readonly_enforcement(client: AsyncClient):
    # 1. Register host and create space
    await client.post(
        "/api/v1/auth/register",
        json={"email": "completion_host@example.com", "password": "password1234", "display_name": "Host"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Roadtrip 2026"})
    space_id = space_resp.json()["id"]

    # 2. Add sample content (message, poll, checklist)
    await client.post(f"/api/v1/spaces/{space_id}/messages", json={"text": "Let's plan the trip!"})
    await client.post(
        f"/api/v1/spaces/{space_id}/polls",
        json={"question": "Car 1 or Car 2?", "options": ["Car 1", "Car 2"]},
    )
    chk_resp = await client.post(
        f"/api/v1/spaces/{space_id}/checklists",
        json={"title": "Packing", "items": ["Snacks", "Water"]},
    )
    chk_id = chk_resp.json()["id"]
    await client.patch(f"/api/v1/spaces/{space_id}/checklists/{chk_id}/items/1", json={"completed": True})

    # 3. Host completes space
    complete_resp = await client.post(f"/api/v1/spaces/{space_id}/complete")
    assert complete_resp.status_code == 200
    assert complete_resp.json()["status"] == "completed"
    assert complete_resp.json()["completed_at"] is not None

    # 4. Verify read-only enforcement on mutations
    msg_blocked = await client.post(
        f"/api/v1/spaces/{space_id}/messages",
        json={"text": "Attempting to post in completed space"},
    )
    assert msg_blocked.status_code == 400

    poll_blocked = await client.post(
        f"/api/v1/spaces/{space_id}/polls",
        json={"question": "Blocked?", "options": ["Yes", "No"]},
    )
    assert poll_blocked.status_code == 400

    upload_blocked = await client.post(
        f"/api/v1/spaces/{space_id}/uploads/sign",
        json={"original_name": "photo.jpg", "mime_type": "image/jpeg", "size_bytes": 1000},
    )
    assert upload_blocked.status_code == 400

    # 5. Fetch Summary Recap
    summary_resp = await client.get(f"/api/v1/spaces/{space_id}/summary")
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert summary["status"] == "completed"
    assert summary["message_count"] == 1
    assert summary["poll_count"] == 1
    assert summary["checklist_count"] == 1
    assert summary["completed_checklist_items"] == 1

    # 6. Fetch Export Archive
    export_resp = await client.get(f"/api/v1/spaces/{space_id}/export")
    assert export_resp.status_code == 200
    export_data = export_resp.json()
    assert export_data["space"]["id"] == space_id
    assert len(export_data["members"]) == 1
    assert len(export_data["artifacts"]) == 3
    assert len(export_data["activity_events"]) > 0

    # 7. Host reopens space
    reopen_resp = await client.post(f"/api/v1/spaces/{space_id}/reopen")
    assert reopen_resp.status_code == 200
    assert reopen_resp.json()["status"] == "active"

    # Mutations allowed again
    msg_allowed = await client.post(
        f"/api/v1/spaces/{space_id}/messages",
        json={"text": "Back open!"},
    )
    assert msg_allowed.status_code == 201


@pytest.mark.asyncio
async def test_non_host_cannot_complete_space(client: AsyncClient):
    # Host creates space
    await client.post(
        "/api/v1/auth/register",
        json={"email": "h1@example.com", "password": "password1234", "display_name": "Host 1"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Host Only"})
    space_id = space_resp.json()["id"]

    invite_resp = await client.post(f"/api/v1/spaces/{space_id}/invites", json={})
    token = invite_resp.json()["token"]

    # Member joins
    await client.post(
        "/api/v1/auth/register",
        json={"email": "m1@example.com", "password": "password1234", "display_name": "Member 1"},
    )
    await client.post(f"/api/v1/invites/{token}/join", json={})

    # Member attempts to complete space -> 403
    complete_resp = await client.post(f"/api/v1/spaces/{space_id}/complete")
    assert complete_resp.status_code == 403
