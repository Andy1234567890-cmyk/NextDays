from fastapi.testclient import TestClient

from src.main import create_app

client = TestClient(create_app())


def test_channel_manager_health() -> None:
    resp = client.get("/api/v1/channel-manager/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "channel_manager", "status": "ok"}
