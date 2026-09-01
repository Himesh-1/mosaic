import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_upload_signing_and_completion_flow(client: AsyncClient):
    # 1. Register host and create space
    await client.post(
        "/api/v1/auth/register",
        json={"email": "media_host@example.com", "password": "password1234", "display_name": "Media Host"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Photo Trip"})
    space_id = space_resp.json()["id"]

    # 2. Sign upload request
    sign_resp = await client.post(
        f"/api/v1/spaces/{space_id}/uploads/sign",
        json={
            "original_name": "sunset_view.jpg",
            "mime_type": "image/jpeg",
            "size_bytes": 2048500,
        },
    )
    assert sign_resp.status_code == 200
    sign_data = sign_resp.json()
    assert "upload_url" in sign_data
    assert sign_data["method"] == "PUT"
    asset_id = sign_data["asset_id"]

    # 3. Complete upload
    complete_resp = await client.post(
        f"/api/v1/spaces/{space_id}/uploads/{asset_id}/complete",
        json={"sha256_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
    )
    assert complete_resp.status_code == 200
    asset_data = complete_resp.json()
    assert asset_data["status"] == "ready"
    assert asset_data["original_name"] == "sunset_view.jpg"

    # 4. Fetch private download URL
    url_resp = await client.get(f"/api/v1/spaces/{space_id}/assets/{asset_id}/url")
    assert url_resp.status_code == 200
    assert "download_url" in url_resp.json()

    # 5. List Gallery Assets
    list_resp = await client.get(f"/api/v1/spaces/{space_id}/assets")
    assert list_resp.status_code == 200
    gallery = list_resp.json()
    assert gallery["total_count"] == 1
    assert gallery["assets"][0]["id"] == asset_id


@pytest.mark.asyncio
async def test_unauthorized_asset_access(client: AsyncClient):
    # Host creates space and asset
    await client.post(
        "/api/v1/auth/register",
        json={"email": "owner@example.com", "password": "password1234", "display_name": "Owner"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Private Media"})
    space_id = space_resp.json()["id"]

    sign_resp = await client.post(
        f"/api/v1/spaces/{space_id}/uploads/sign",
        json={"original_name": "private.pdf", "mime_type": "application/pdf", "size_bytes": 50000},
    )
    asset_id = sign_resp.json()["asset_id"]
    await client.post(f"/api/v1/spaces/{space_id}/uploads/{asset_id}/complete", json={})

    # Stranger tries to get download URL
    await client.post(
        "/api/v1/auth/register",
        json={"email": "stranger@example.com", "password": "password1234", "display_name": "Stranger"},
    )
    url_resp = await client.get(f"/api/v1/spaces/{space_id}/assets/{asset_id}/url")
    assert url_resp.status_code == 403
