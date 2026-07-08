from fastapi.testclient import TestClient

from src.main import create_app
from src.features.dashboard.schemas import DashboardVoiceRequest

client = TestClient(create_app())


def test_dashboard_health() -> None:
    resp = client.get("/api/v1/dashboard/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "dashboard", "status": "ok"}


def test_dashboard_voice_request_accepts_decimal_revenue_value() -> None:
    req = DashboardVoiceRequest.model_validate(
        {
            "utterance": "wie viel Umsatz in den letzten 30 Tagen",
            "snapshot": {
                "today": "2026-07-08",
                "checkouts_today": [],
                "checkins_today": [],
                "upcoming": [],
                "properties": [],
                "checkins_30d": {"value": 12, "change_pct": 10.0},
                "revenue_30d": {"value": 3002.28, "change_pct": 600.0},
                "confirmed_30d": {"value": 8, "change_pct": 4.5},
                "currency": "EUR",
            },
        }
    )
    assert req.snapshot.revenue_30d is not None
    assert req.snapshot.revenue_30d.value == 3002.28
