from fastapi.testclient import TestClient

from src.main import create_app

client = TestClient(create_app())


def test_properties_health() -> None:
    resp = client.get("/api/v1/properties/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "properties", "status": "ok"}
