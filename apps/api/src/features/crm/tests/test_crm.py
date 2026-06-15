from fastapi.testclient import TestClient

from src.main import create_app

client = TestClient(create_app())


def test_crm_health() -> None:
    resp = client.get("/api/v1/crm/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "crm", "status": "ok"}
