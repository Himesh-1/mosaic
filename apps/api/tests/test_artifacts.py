import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_message_creation_and_idempotency(client: AsyncClient):
    # 1. Register host and create space
    await client.post(
        "/api/v1/auth/register",
        json={"email": "artifact_host@example.com", "password": "password1234", "display_name": "Artifact Host"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Beach Trip"})
    space_id = space_resp.json()["id"]

    # 2. Create message with X-Client-Mutation-Id
    mutation_id = "mutation-msg-001"
    msg_resp = await client.post(
        f"/api/v1/spaces/{space_id}/messages",
        json={"text": "Hey everyone, don't forget your sunscreen!"},
        headers={"X-Client-Mutation-Id": mutation_id},
    )
    assert msg_resp.status_code == 201
    msg_data = msg_resp.json()
    assert msg_data["type"] == "message"
    assert msg_data["content"]["text"] == "Hey everyone, don't forget your sunscreen!"
    msg_id = msg_data["id"]

    # 3. Retry identical request with same mutation_id -> should return cached receipt
    retry_resp = await client.post(
        f"/api/v1/spaces/{space_id}/messages",
        json={"text": "Hey everyone, don't forget your sunscreen!"},
        headers={"X-Client-Mutation-Id": mutation_id},
    )
    assert retry_resp.status_code == 200 or retry_resp.status_code == 201
    assert retry_resp.json()["id"] == msg_id

    # Verify only 1 message artifact exists
    list_resp = await client.get(f"/api/v1/spaces/{space_id}/artifacts?type=message")
    assert list_resp.status_code == 200
    assert len(list_resp.json()["artifacts"]) == 1

    # 4. Conflict on reusing mutation_id with different payload
    conflict_resp = await client.post(
        f"/api/v1/spaces/{space_id}/messages",
        json={"text": "A completely different message with same mutation key!"},
        headers={"X-Client-Mutation-Id": mutation_id},
    )
    assert conflict_resp.status_code == 409


@pytest.mark.asyncio
async def test_poll_creation_and_voting(client: AsyncClient):
    # Host creates space
    await client.post(
        "/api/v1/auth/register",
        json={"email": "poll_host@example.com", "password": "password1234", "display_name": "Poll Host"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Dinner Choices"})
    space_id = space_resp.json()["id"]

    # Create Poll
    poll_resp = await client.post(
        f"/api/v1/spaces/{space_id}/polls",
        json={
            "question": "Where should we eat tonight?",
            "options": ["Italian Bistro", "Sushi Bar", "Taco Stand"],
            "allow_multiple": False,
        },
    )
    assert poll_resp.status_code == 201
    poll_data = poll_resp.json()
    assert poll_data["type"] == "poll"
    poll_id = poll_data["id"]
    options = poll_data["content"]["options"]
    assert len(options) == 3

    # Vote for Option 2 (Sushi Bar)
    vote_resp = await client.post(
        f"/api/v1/spaces/{space_id}/polls/{poll_id}/vote",
        json={"option_ids": ["2"]},
    )
    assert vote_resp.status_code == 200
    updated_options = vote_resp.json()["content"]["options"]
    assert len(updated_options[1]["votes"]) == 1
    assert len(updated_options[0]["votes"]) == 0


@pytest.mark.asyncio
async def test_checklist_creation_and_toggle(client: AsyncClient):
    # Host creates space
    await client.post(
        "/api/v1/auth/register",
        json={"email": "checklist_host@example.com", "password": "password1234", "display_name": "Checklist Host"},
    )
    space_resp = await client.post("/api/v1/spaces", json={"title": "Camping Gear"})
    space_id = space_resp.json()["id"]

    # Create Checklist
    chk_resp = await client.post(
        f"/api/v1/spaces/{space_id}/checklists",
        json={
            "title": "Essentials",
            "items": ["Tent", "Sleeping Bags", "First Aid Kit"],
        },
    )
    assert chk_resp.status_code == 201
    chk_data = chk_resp.json()
    assert chk_data["type"] == "checklist"
    chk_id = chk_data["id"]
    assert len(chk_data["content"]["items"]) == 3

    # Toggle item 1 to completed
    toggle_resp = await client.patch(
        f"/api/v1/spaces/{space_id}/checklists/{chk_id}/items/1",
        json={"completed": True},
    )
    assert toggle_resp.status_code == 200
    items = toggle_resp.json()["content"]["items"]
    assert items[0]["completed"] is True
    assert items[1]["completed"] is False
