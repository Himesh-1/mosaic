import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_and_get_space(client: AsyncClient):
    # 1. Register Host User
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "host@example.com",
            "password": "password1234",
            "display_name": "Host User",
        },
    )

    # 2. Create Space
    create_payload = {
        "title": "Mount Abu Trip",
        "template": "trip",
        "description": "Our weekend getaway",
        "cover_color": "#246A5A",
    }
    response = await client.post("/api/v1/spaces", json=create_payload)
    assert response.status_code == 201
    space = response.json()
    assert space["title"] == "Mount Abu Trip"
    assert space["template"] == "trip"
    assert space["current_role"] == "host"
    assert space["member_count"] == 1
    assert "slug" in space

    space_id = space["id"]

    # 3. Get Space Details
    get_resp = await client.get(f"/api/v1/spaces/{space_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == space_id
    assert get_resp.json()["current_role"] == "host"

    # 4. List User's Spaces
    list_resp = await client.get("/api/v1/spaces")
    assert list_resp.status_code == 200
    spaces_list = list_resp.json()
    assert len(spaces_list) == 1
    assert spaces_list[0]["id"] == space_id

    # 5. List Members
    members_resp = await client.get(f"/api/v1/spaces/{space_id}/members")
    assert members_resp.status_code == 200
    members_data = members_resp.json()
    assert members_data["total_count"] == 1
    assert members_data["members"][0]["display_name"] == "Host User"
    assert members_data["members"][0]["role"] == "host"


@pytest.mark.asyncio
async def test_space_authorization_boundary(client: AsyncClient):
    # 1. Create Space with User A
    await client.post(
        "/api/v1/auth/register",
        json={"email": "usera@example.com", "password": "password1234", "display_name": "User A"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Private Space A"})
    space_id = space_resp.json()["id"]

    # 2. Register User B
    await client.post(
        "/api/v1/auth/register",
        json={"email": "userb@example.com", "password": "password1234", "display_name": "User B"},
    )

    # 3. User B tries to view or update User A's Space
    get_resp = await client.get(f"/api/v1/spaces/{space_id}")
    assert get_resp.status_code == 403

    patch_resp = await client.patch(f"/api/v1/spaces/{space_id}", json={"title": "Hacked Title"})
    assert patch_resp.status_code == 403

    members_resp = await client.get(f"/api/v1/spaces/{space_id}/members")
    assert members_resp.status_code == 403


@pytest.mark.asyncio
async def test_remove_member_flow(client: AsyncClient):
    # Host creates space
    await client.post(
        "/api/v1/auth/register",
        json={"email": "trip_host@example.com", "password": "password1234", "display_name": "Trip Host"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Trek Space"})
    space_id = space_resp.json()["id"]

    # Create invite
    invite_resp = await client.post(f"/api/v1/spaces/{space_id}/invites", json={})
    invite_token = invite_resp.json()["token"]

    # Member joins as guest
    await client.post("/api/v1/auth/logout")
    join_resp = await client.post(f"/api/v1/invites/{invite_token}/join", json={"display_name": "Trekker 1"})
    assert join_resp.status_code == 200

    # Get member user_id
    me_resp = await client.get("/api/v1/me")
    member_user_id = me_resp.json()["user"]["id"]

    # Host logs back in
    await client.post("/api/v1/auth/logout")
    await client.post("/api/v1/auth/login", json={"email": "trip_host@example.com", "password": "password1234"})

    # Host removes member
    del_resp = await client.delete(f"/api/v1/spaces/{space_id}/members/{member_user_id}")
    assert del_resp.status_code == 204

    # Removed member tries to access space
    await client.post("/api/v1/auth/logout")
    await client.post("/api/v1/auth/guest", json={"display_name": "Other"})
    # Verify member list has 1 active member now
    await client.post("/api/v1/auth/login", json={"email": "trip_host@example.com", "password": "password1234"})
    members_resp = await client.get(f"/api/v1/spaces/{space_id}/members")
    assert members_resp.json()["total_count"] == 1
