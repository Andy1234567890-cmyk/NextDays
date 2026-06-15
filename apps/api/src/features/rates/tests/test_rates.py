from fastapi.testclient import TestClient

from src.main import create_app

client = TestClient(create_app())


def test_rates_health() -> None:
    resp = client.get("/api/v1/rates/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "rates", "status": "ok"}
