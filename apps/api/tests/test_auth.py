import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_and_me(client: AsyncClient):
    payload = {
        "email": "asha@example.com",
        "password": "strongpassword123",
        "display_name": "Asha",
        "device_label": "Asha's Laptop",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["email"] == "asha@example.com"
    assert data["user"]["display_name"] == "Asha"
    assert data["user"]["is_guest"] is False
    assert data["session"]["device_label"] == "Asha's Laptop"
    assert "mosaic_session" in response.cookies

    # Query /me with session cookie
    me_resp = await client.get("/api/v1/me")
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["user"]["id"] == data["user"]["id"]
    assert me_data["user"]["display_name"] == "Asha"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload = {
        "email": "duplicate@example.com",
        "password": "strongpassword123",
        "display_name": "User 1",
    }
    resp1 = await client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 400
    error_data = resp2.json()
    assert "error" in error_data
    assert error_data["error"]["code"] == "http_400"


@pytest.mark.asyncio
async def test_login_and_logout(client: AsyncClient):
    # Register first
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "dev@example.com",
            "password": "securepassword99",
            "display_name": "Dev",
        },
    )

    # Login
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "dev@example.com",
            "password": "securepassword99",
            "device_label": "Dev's Phone",
        },
    )
    assert login_resp.status_code == 200
    assert login_resp.json()["user"]["display_name"] == "Dev"

    # Logout
    logout_resp = await client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 204

    # Me should now fail with 401
    me_resp = await client.get("/api/v1/me")
    assert me_resp.status_code == 401


@pytest.mark.asyncio
async def test_guest_session(client: AsyncClient):
    payload = {
        "display_name": "Guest Participant",
        "device_label": "Guest Tablet",
    }
    response = await client.post("/api/v1/auth/guest", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["display_name"] == "Guest Participant"
    assert data["user"]["is_guest"] is True
    assert data["user"]["email"] is None

    me_resp = await client.get("/api/v1/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["user"]["id"] == data["user"]["id"]
