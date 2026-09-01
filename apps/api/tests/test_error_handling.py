import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_404_error_envelope(client: AsyncClient):
    response = await client.get("/api/v1/non-existent-endpoint")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "http_404"
    assert "message" in data["error"]
    assert "request_id" in data["error"]
    assert data["error"]["request_id"] is not None


@pytest.mark.asyncio
async def test_validation_error_envelope(client: AsyncClient):
    response = await client.post("/api/v1/auth/register", json={"invalid": "payload"})
    assert response.status_code == 422
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "validation_error"
    assert data["error"]["details"] is not None
    assert "request_id" in data["error"]
