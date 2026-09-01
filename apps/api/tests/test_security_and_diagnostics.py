import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_security_headers_and_diagnostics(client: AsyncClient):
    # 1. Verify Security Headers on Health/Root
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

    # 2. Register & Create Space
    await client.post(
        "/api/v1/auth/register",
        json={"email": "sec_host@example.com", "password": "password1234", "display_name": "SecHost"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Security Space"})
    space_id = space_resp.json()["id"]

    # 3. Test ICE servers diagnostics route
    ice_resp = await client.get(f"/api/v1/spaces/{space_id}/webrtc/ice_servers")
    assert ice_resp.status_code == 200
    assert "ice_servers" in ice_resp.json()
    assert len(ice_resp.json()["ice_servers"]) > 0

    # 4. Test Upload File Size Cap (> 50MB must be rejected with 422 validation error)
    oversized_resp = await client.post(
        f"/api/v1/spaces/{space_id}/uploads/sign",
        json={
            "original_name": "giant_video.mov",
            "mime_type": "video/quicktime",
            "size_bytes": 60 * 1024 * 1024,  # 60 MB
        },
    )
    assert oversized_resp.status_code == 422

    # 5. Test Empty Filename Rejection
    empty_name_resp = await client.post(
        f"/api/v1/spaces/{space_id}/uploads/sign",
        json={
            "original_name": "",
            "mime_type": "image/png",
            "size_bytes": 1024,
        },
    )
    assert empty_name_resp.status_code == 422


@pytest.mark.asyncio
async def test_auth_rate_limiting(client: AsyncClient):
    # Rapidly fire requests to verify rate limiter
    hit_rate_limit = False
    for _ in range(130):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent@example.com", "password": "wrongpassword"},
        )
        if resp.status_code == 429:
            hit_rate_limit = True
            assert resp.json()["error"]["code"] == "rate_limit_exceeded"
            break

    assert hit_rate_limit is True
