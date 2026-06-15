from fastapi.testclient import TestClient

from src.main import create_app

client = TestClient(create_app())


def test_booking_engine_health() -> None:
    resp = client.get("/api/v1/booking-engine/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "booking_engine", "status": "ok"}
