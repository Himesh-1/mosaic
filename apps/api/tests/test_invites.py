import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_invite_preview_and_guest_join(client: AsyncClient):
    # 1. Host creates space
    await client.post(
        "/api/v1/auth/register",
        json={"email": "organizer@example.com", "password": "password1234", "display_name": "Organizer"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Hackathon 2026", "template": "event"})
    space_id = space_resp.json()["id"]

    # 2. Host creates custom invite
    invite_resp = await client.post(
        f"/api/v1/spaces/{space_id}/invites",
        json={"mode": "qr", "max_uses": 5, "expires_in_hours": 24},
    )
    assert invite_resp.status_code == 201
    invite_data = invite_resp.json()
    token = invite_data["token"]
    assert token is not None

    # 3. Public/Unauthenticated preview
    await client.post("/api/v1/auth/logout")
    preview_resp = await client.post(f"/api/v1/invites/{token}/preview")
    assert preview_resp.status_code == 200
    preview = preview_resp.json()
    assert preview["space_title"] == "Hackathon 2026"
    assert preview["host_display_name"] == "Organizer"
    assert preview["is_valid"] is True
    assert preview["member_count"] == 1

    # 4. Join as Guest (unauthenticated)
    join_resp = await client.post(
        f"/api/v1/invites/{token}/join",
        json={"display_name": "Hacker Riya", "device_label": "Riya's Laptop"},
    )
    assert join_resp.status_code == 200
    joined_space = join_resp.json()
    assert joined_space["id"] == space_id
    assert joined_space["current_role"] == "member"
    assert joined_space["member_count"] == 2

    # Verify session cookie was set for guest
    assert "mosaic_session" in join_resp.cookies

    # 5. Access space content as newly joined member
    get_space_resp = await client.get(f"/api/v1/spaces/{space_id}")
    assert get_space_resp.status_code == 200
    assert get_space_resp.json()["current_role"] == "member"


@pytest.mark.asyncio
async def test_invalid_and_expired_invites(client: AsyncClient):
    # Preview non-existent token
    bad_preview = await client.post("/api/v1/invites/nonexistent-token-12345/preview")
    assert bad_preview.status_code == 404
    assert bad_preview.json()["error"]["code"] == "http_404"

    # Join non-existent token
    bad_join = await client.post(
        "/api/v1/invites/nonexistent-token-12345/join",
        json={"display_name": "Ghost User"},
    )
    assert bad_join.status_code == 404
