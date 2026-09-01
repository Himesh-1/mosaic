import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_activity_event_ordering_and_pagination(client: AsyncClient):
    # 1. Register host and create space
    await client.post(
        "/api/v1/auth/register",
        json={"email": "activity_host@example.com", "password": "password1234", "display_name": "Activity Host"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Road Trip"})
    space_id = space_resp.json()["id"]

    # 2. Update Space metadata 3 times to generate ordered events
    await client.patch(f"/api/v1/spaces/{space_id}", json={"description": "First update"})
    await client.patch(f"/api/v1/spaces/{space_id}", json={"description": "Second update"})
    await client.patch(f"/api/v1/spaces/{space_id}", json={"description": "Third update"})

    # 3. Fetch Activity feed from sequence 0
    feed_resp = await client.get(f"/api/v1/spaces/{space_id}/activity?after_sequence=0&limit=10")
    assert feed_resp.status_code == 200
    feed = feed_resp.json()
    assert feed["space_id"] == space_id
    assert len(feed["events"]) >= 4  # space.created + 3 space.updated
    assert feed["latest_sequence"] >= 4

    # Verify sequences are strictly increasing: 1, 2, 3, 4
    sequences = [ev["sequence"] for ev in feed["events"]]
    assert sequences == sorted(sequences)
    assert sequences[0] == 1
    assert sequences[1] == 2

    # 4. Cursor Pagination: fetch after sequence 2
    cursor_resp = await client.get(f"/api/v1/spaces/{space_id}/activity?after_sequence=2&limit=2")
    assert cursor_resp.status_code == 200
    cursor_feed = cursor_resp.json()
    assert len(cursor_feed["events"]) == 2
    assert cursor_feed["events"][0]["sequence"] == 3
    assert cursor_feed["events"][1]["sequence"] == 4
    assert cursor_feed["events"][0]["actor"]["display_name"] == "Activity Host"


@pytest.mark.asyncio
async def test_unauthorized_activity_access(client: AsyncClient):
    # Host creates space
    await client.post(
        "/api/v1/auth/register",
        json={"email": "creator1@example.com", "password": "password1234", "display_name": "Creator 1"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Secret Space"})
    space_id = space_resp.json()["id"]

    # Other user tries to access activity
    await client.post(
        "/api/v1/auth/register",
        json={"email": "intruder@example.com", "password": "password1234", "display_name": "Intruder"},
    )
    activity_resp = await client.get(f"/api/v1/spaces/{space_id}/activity")
    assert activity_resp.status_code == 403
