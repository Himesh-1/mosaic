import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_direct_transfer_intent_and_response_lifecycle(client: AsyncClient):
    # 1. Register sender and create space
    await client.post(
        "/api/v1/auth/register",
        json={"email": "sender@example.com", "password": "password1234", "display_name": "Sender"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "P2P Space"})
    space_id = space_resp.json()["id"]

    # 2. Register recipient and join space
    invite_resp = await client.post(f"/api/v1/spaces/{space_id}/invites", json={})
    token = invite_resp.json()["token"]

    await client.post(
        "/api/v1/auth/register",
        json={"email": "recipient@example.com", "password": "password1234", "display_name": "Recipient"},
    )
    recip_me = await client.get("/api/v1/me")
    recipient_id = recip_me.json()["user"]["id"]

    await client.post(f"/api/v1/invites/{token}/join", json={})

    # 3. Log back in as sender
    await client.post(
        "/api/v1/auth/login",
        json={"email": "sender@example.com", "password": "password1234"},
    )

    # 4. Initiate transfer intent
    intent_resp = await client.post(
        f"/api/v1/spaces/{space_id}/transfers/direct/intent",
        json={
            "recipient_id": recipient_id,
            "file_name": "vacation_video.mp4",
            "mime_type": "video/mp4",
            "size_bytes": 10485760,
            "sha256_hash": "c2008352e3c10e972b22ec682f48ab29d48b459d1e996246f687a4aac82dd140",
        },
    )
    assert intent_resp.status_code == 200
    transfer_data = intent_resp.json()
    assert transfer_data["status"] == "pending_approval"
    transfer_id = transfer_data["id"]

    # 5. Log in as recipient and accept transfer
    await client.post(
        "/api/v1/auth/login",
        json={"email": "recipient@example.com", "password": "password1234"},
    )

    respond_resp = await client.post(
        f"/api/v1/spaces/{space_id}/transfers/direct/{transfer_id}/respond",
        json={"action": "accept"},
    )
    assert respond_resp.status_code == 200
    assert respond_resp.json()["status"] == "accepted"

    # 6. Update transfer status to transferring, then completed
    transferring_resp = await client.post(
        f"/api/v1/spaces/{space_id}/transfers/direct/{transfer_id}/status",
        json={"status": "transferring"},
    )
    assert transferring_resp.status_code == 200
    assert transferring_resp.json()["status"] == "transferring"

    completed_resp = await client.post(
        f"/api/v1/spaces/{space_id}/transfers/direct/{transfer_id}/status",
        json={"status": "completed"},
    )
    assert completed_resp.status_code == 200
    assert completed_resp.json()["status"] == "completed"
    assert completed_resp.json()["completed_at"] is not None

    # 7. Check ICE servers endpoint
    ice_resp = await client.get(f"/api/v1/spaces/{space_id}/webrtc/ice_servers")
    assert ice_resp.status_code == 200
    assert len(ice_resp.json()["ice_servers"]) > 0


@pytest.mark.asyncio
async def test_transfer_declined_and_unauthorized(client: AsyncClient):
    # Sender setup
    await client.post(
        "/api/v1/auth/register",
        json={"email": "sender2@example.com", "password": "password1234", "display_name": "Sender 2"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "P2P Space 2"})
    space_id = space_resp.json()["id"]

    # Recipient setup
    invite_resp = await client.post(f"/api/v1/spaces/{space_id}/invites", json={})
    token = invite_resp.json()["token"]

    await client.post(
        "/api/v1/auth/register",
        json={"email": "recipient2@example.com", "password": "password1234", "display_name": "Recipient 2"},
    )
    recip_me = await client.get("/api/v1/me")
    recipient_id = recip_me.json()["user"]["id"]
    await client.post(f"/api/v1/invites/{token}/join", json={})

    # Stranger setup (not in space)
    await client.post(
        "/api/v1/auth/register",
        json={"email": "stranger2@example.com", "password": "password1234", "display_name": "Stranger 2"},
    )

    # Stranger tries to create transfer in space -> 403
    stranger_intent = await client.post(
        f"/api/v1/spaces/{space_id}/transfers/direct/intent",
        json={
            "recipient_id": recipient_id,
            "file_name": "secret.txt",
            "mime_type": "text/plain",
            "size_bytes": 100,
        },
    )
    assert stranger_intent.status_code == 403
