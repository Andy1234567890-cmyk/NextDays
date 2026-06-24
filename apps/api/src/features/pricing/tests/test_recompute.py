"""Tests für den Dynamic-Pricing-Recompute-Service.

Verifiziert: DP schreibt NUR dynamic_prices (nie price_overrides); DP-AUS ist ein
No-op; ohne Basispreis kein erfundener Preis; Saison-Aufschlag fließt ein.
"""
from datetime import date

from src.features.pricing.recompute import DynamicPricingRecompute


class _Q:
    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op: str | None = None
        self._payload: object = None

    def select(self, *_a: object, **_k: object) -> "_Q":
        return self

    def eq(self, *_a: object, **_k: object) -> "_Q":
        return self

    def in_(self, *_a: object, **_k: object) -> "_Q":
        return self

    def gte(self, *_a: object, **_k: object) -> "_Q":
        return self

    def lt(self, *_a: object, **_k: object) -> "_Q":
        return self

    def order(self, *_a: object, **_k: object) -> "_Q":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Q":
        return self

    def upsert(self, payload: object, **_k: object) -> "_Q":
        self._op, self._payload = "upsert", payload
        return self

    def execute(self) -> object:
        class _R:
            pass

        r = _R()
        if self._op == "upsert":
            self._db.writes.setdefault(self._table, [])
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            self._db.writes[self._table].extend(rows)  # type: ignore[arg-type]
            r.data = rows  # type: ignore[attr-defined]
        else:
            r.data = self._db.tables.get(self._table, [])  # type: ignore[attr-defined]
        return r


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self.writes: dict[str, list[dict]] = {}

    def table(self, name: str) -> _Q:
        return _Q(self, name)


def _db(*, enabled: bool, base: float | None, seasons: bool = False) -> _DB:
    tables: dict[str, list[dict]] = {
        "dp_settings": [
            {
                "property_id": "p1",
                "enabled": enabled,
                "min_price": None,
                "max_price": None,
                "weekend_uplift_pct": 0,
                "last_minute": [],
                "orphan_gap_discount_pct": 0,
                "occupancy_sensitivity": 0,
                "min_stay_min": 1,
                "min_stay_max": 3,
            }
        ],
        "rate_plans": (
            [{"property_id": "p1", "base_price": base, "currency": "EUR"}]
            if base is not None
            else []
        ),
        "properties": [{"id": "p1", "tenant_id": "t1"}],
        "availability": [],
        "season_assignments": [{"template_id": "tmpl1"}] if seasons else [],
        "seasons": [{"id": "s1", "percent": 50}] if seasons else [],
        "season_periods": (
            [{"season_id": "s1", "start_date": "2026-07-01", "end_date": "2026-07-31"}]
            if seasons
            else []
        ),
        "events": [],
        "event_periods": [],
    }
    return _DB(tables)


def test_recompute_writes_only_dynamic_prices() -> None:
    db = _db(enabled=True, base=100.0)
    svc = DynamicPricingRecompute(service_client=db)
    n = svc.recompute_property(
        "p1", start=date(2026, 7, 1), end=date(2026, 7, 4)
    )
    assert n == 3
    # NUR dynamic_prices geschrieben — NIE price_overrides.
    assert "dynamic_prices" in db.writes
    assert "price_overrides" not in db.writes
    assert len(db.writes["dynamic_prices"]) == 3
    assert all(row["price"] == 100.0 for row in db.writes["dynamic_prices"])


def test_recompute_disabled_is_noop() -> None:
    db = _db(enabled=False, base=100.0)
    svc = DynamicPricingRecompute(service_client=db)
    n = svc.recompute_property("p1", start=date(2026, 7, 1), end=date(2026, 7, 4))
    assert n == 0
    assert db.writes == {}


def test_recompute_no_base_no_price() -> None:
    db = _db(enabled=True, base=None)
    svc = DynamicPricingRecompute(service_client=db)
    n = svc.recompute_property("p1", start=date(2026, 7, 1), end=date(2026, 7, 4))
    assert n == 0  # kein Basispreis → kein erfundener Preis
    assert db.writes == {}


def test_recompute_applies_season_uplift() -> None:
    db = _db(enabled=True, base=100.0, seasons=True)
    svc = DynamicPricingRecompute(service_client=db)
    svc.recompute_property("p1", start=date(2026, 7, 1), end=date(2026, 7, 2))
    # Saison +50 % → 150.
    assert db.writes["dynamic_prices"][0]["price"] == 150.0


def test_recompute_all_only_enabled() -> None:
    db = _db(enabled=True, base=100.0)
    svc = DynamicPricingRecompute(service_client=db)
    res = svc.recompute_all(horizon_days=3)
    assert res["properties"] == 1
    assert res["days"] >= 1
