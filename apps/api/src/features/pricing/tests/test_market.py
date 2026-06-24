"""Tests für die Markt-Signal-Provider (Phase 2)."""
from datetime import date

from src.features.pricing.market import NullProvider
from src.features.pricing.market.airdna import AirDnaProvider


def test_null_provider_returns_empty() -> None:
    p = NullProvider()
    out = p.market_signal("munich", ["a", "b"], [date(2026, 7, 1), date(2026, 7, 2)])
    assert out == {}


class _FakeResp:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class _FakeClient:
    """Minimaler httpx.Client-Stub: gibt eine feste AirDNA-Antwort zurück."""

    def __init__(self, payload: dict) -> None:
        self._payload = payload
        self.last_url: str | None = None
        self.last_params: dict | None = None

    def get(self, url: str, params: dict, headers: dict) -> _FakeResp:
        self.last_url = url
        self.last_params = params
        return _FakeResp(self._payload)


def test_airdna_parses_market_days() -> None:
    payload = {
        "days": [
            {"date": "2026-07-01", "comp_price": 145.5, "demand_index": 0.8,
             "event_uplift_pct": 12},
            # Alternative Feldnamen (median_price/demand/event_pct).
            {"date": "2026-07-02", "median_price": 160, "demand": 0.9, "event_pct": 0},
            {"date": "bad"},  # zu kurz/ungültig → trotzdem geparst (key 'bad'[:10])
        ]
    }
    client = _FakeClient(payload)
    p = AirDnaProvider(api_key="k", client=client)
    out = p.market_signal("munich", ["x"], [date(2026, 7, 1), date(2026, 7, 2)])
    assert out["2026-07-01"].comp_price == 145.5
    assert out["2026-07-01"].demand_index == 0.8
    assert out["2026-07-01"].event_uplift_pct == 12.0
    assert out["2026-07-02"].comp_price == 160.0
    assert out["2026-07-02"].demand_index == 0.9
    # comp_refs werden als Query mitgesendet.
    assert client.last_params is not None and client.last_params["comp_refs"] == "x"


def test_airdna_no_market_key_returns_empty() -> None:
    p = AirDnaProvider(api_key="k", client=_FakeClient({"days": []}))
    assert p.market_signal(None, [], [date(2026, 7, 1)]) == {}


def test_airdna_handles_fetch_error_gracefully() -> None:
    class _BoomClient:
        def get(self, *_a: object, **_k: object) -> _FakeResp:
            raise RuntimeError("network down")

    p = AirDnaProvider(api_key="k", client=_BoomClient())
    # Fehler → leeres Signal (best-effort), kein Crash.
    assert p.market_signal("munich", [], [date(2026, 7, 1)]) == {}
