from starlette.testclient import TestClient
from apps.api.src.main import app


def test_websocket_realtime_lifecycle():
    client = TestClient(app)

    # 1. Register Host User via REST API
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "ws_sync_user@example.com",
            "password": "password1234",
            "display_name": "WS Sync User",
        },
    )
    assert reg_resp.status_code == 201
    user_id = reg_resp.json()["user"]["id"]
    cookie_value = reg_resp.cookies.get("mosaic_session")

    # 2. Create Space via REST API
    space_resp = client.post("/api/v1/spaces", json={"title": "WS Live Space"})
    assert space_resp.status_code == 201
    space_id = space_resp.json()["id"]

    # 3. Test WebSocket connection
    with client.websocket_connect("/api/v1/realtime") as websocket:
        # Receive welcome
        welcome = websocket.receive_json()
        assert welcome["type"] == "welcome"
        assert welcome["user_id"] == user_id

        # Subscribe to space
        websocket.send_json({
            "type": "subscribe",
            "space_id": space_id,
            "after_sequence": 0,
        })

        sub_ack = websocket.receive_json()
        assert sub_ack["type"] == "subscribed"
        assert sub_ack["space_id"] == space_id

        # The subscribe replay should deliver the space.created event (sequence 1)
        event_msg = websocket.receive_json()
        assert event_msg["type"] == "space.created"
        assert event_msg["sequence"] == 1
        assert event_msg["actor"]["display_name"] == "WS Sync User"

        # Send presence heartbeat
        websocket.send_json({
            "type": "presence.heartbeat",
            "space_id": space_id,
        })
