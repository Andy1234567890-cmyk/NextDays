"""Tests für den pricing-Slice — der zentrale Preis-Resolver (eine Wahrheit).

Verifiziert die Prioritätsreihenfolge (override > weekday > base), dass ohne
Preis None bleibt (kein Fallback), und die Quote-Aufschlüsselung (Längenpreis,
Kurzaufenthalt, Extra-Gast, Markup, Gebühren, Aktion, Steuern).
"""
from datetime import date

from fastapi.testclient import TestClient

from src.features.pricing.resolver import PricingResolver
from src.features.pricing.schemas import QuoteRequest
from src.main import create_app

client = TestClient(create_app())


def test_pricing_health() -> None:
    resp = client.get("/api/v1/pricing/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "pricing", "status": "ok"}


class _Q:
    """Minimaler Supabase-Query-Stub: gibt für eine Tabelle feste Zeilen zurück."""

    def __init__(self, data: list[dict]) -> None:
        self._data = data

    def select(self, *_a: object, **_k: object) -> "_Q":
        return self

    def eq(self, *_a: object, **_k: object) -> "_Q":
        return self

    def gte(self, *_a: object, **_k: object) -> "_Q":
        return self

    def lt(self, *_a: object, **_k: object) -> "_Q":
        return self

    def in_(self, *_a: object, **_k: object) -> "_Q":
        return self

    def order(self, *_a: object, **_k: object) -> "_Q":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Q":
        return self

    @property
    def not_(self) -> "_Q":
        return self

    def is_(self, *_a: object, **_k: object) -> "_Q":
        return self

    def execute(self) -> object:
        class _R:
            pass

        r = _R()
        r.data = self._data  # type: ignore[attr-defined]
        return r


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self._tables = tables

    def table(self, name: str) -> _Q:
        return _Q(self._tables.get(name, []))


def _resolver(
    *,
    base: float | None = None,
    overrides: list[dict] | None = None,
    config: dict | None = None,
    dynamic: list[dict] | None = None,
    addons: list[dict] | None = None,
) -> PricingResolver:
    tables: dict[str, list[dict]] = {
        "rate_plans": [{"base_price": base, "currency": "EUR"}] if base is not None else [],
        "price_overrides": overrides or [],
        "property_pricing_config": [config] if config else [],
        "dynamic_prices": dynamic or [],
        "property_addons": addons or [],
    }
    return PricingResolver(service_client=_DB(tables))


# --- Effektivpreis: Priorität override > weekday > base ----------------------


def test_effective_uses_base_when_no_override() -> None:
    r = _resolver(base=100.0)
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 3))
    assert [d.price for d in days] == [100.0, 100.0]
    assert all(d.source == "base" for d in days)


def test_effective_override_beats_base() -> None:
    r = _resolver(base=100.0, overrides=[{"date": "2026-07-01", "price": 180}])
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 3))
    assert days[0].price == 180.0 and days[0].source == "override"
    assert days[1].price == 100.0 and days[1].source == "base"


def test_effective_weekday_beats_base_but_not_override() -> None:
    # 2026-07-01 ist ein Mittwoch (wed).
    cfg = {"custom_by_weekday": True, "weekday_prices": {"wed": 130}}
    r = _resolver(base=100.0, config=cfg)
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 2))
    assert days[0].price == 130.0 and days[0].source == "weekday"


def test_effective_dynamic_beats_weekday_and_base() -> None:
    # Dynamic Pricing schlägt Wochentagspreis und Basis.
    cfg = {"custom_by_weekday": True, "weekday_prices": {"wed": 130}}
    r = _resolver(
        base=100.0, config=cfg, dynamic=[{"date": "2026-07-01", "price": 175}]
    )
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 2))
    assert days[0].price == 175.0 and days[0].source == "dynamic"


def test_effective_manual_override_beats_dynamic() -> None:
    # Manueller Host-Override gewinnt IMMER über den Dynamic-Pricing-Vorschlag.
    r = _resolver(
        base=100.0,
        overrides=[{"date": "2026-07-01", "price": 220}],
        dynamic=[{"date": "2026-07-01", "price": 175}],
    )
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 2))
    assert days[0].price == 220.0 and days[0].source == "override"


def test_effective_dp_off_falls_back_to_base() -> None:
    # Ohne dynamic_prices-Eintrag (DP aus) → Basispreis.
    r = _resolver(base=100.0, dynamic=[])
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 2))
    assert days[0].price == 100.0 and days[0].source == "base"


def test_effective_none_without_price() -> None:
    r = _resolver()  # kein Rate-Plan, kein Override, keine Konfig
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 2))
    assert days[0].price is None and days[0].source == "none"


def test_effective_base_when_config_table_missing() -> None:
    """Regression: fehlt die property_pricing_config-Tabelle (nicht migriert),
    liefert der Resolver weiter den Basispreis — der Kalender bleibt nutzbar."""

    class _FailingConfig(_Q):
        def execute(self) -> object:
            raise RuntimeError("relation property_pricing_config does not exist")

    class _DBMissingConfig:
        def table(self, name: str) -> _Q:
            if name == "property_pricing_config":
                return _FailingConfig([])
            if name == "rate_plans":
                return _Q([{"base_price": 99, "currency": "EUR"}])
            return _Q([])

    r = PricingResolver(service_client=_DBMissingConfig())
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 3))
    assert [d.price for d in days] == [99.0, 99.0]
    assert all(d.source == "base" for d in days)


# --- Quote-Aufschlüsselung ---------------------------------------------------


def test_quote_priceless_without_rate_plan() -> None:
    r = _resolver()
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 4),
            guests=2,
        )
    )
    assert q.priceless is True
    assert q.total == 0.0


def test_quote_full_breakdown() -> None:
    # 3 Nächte, base 100, Markup booking +10 %, Reinigung 50 fest, Frühbucher 10 %,
    # MwSt 19 % (nicht enthalten). Erwartet 406.98 (vgl. Smoke-Test).
    cfg = {
        "markup": {"booking": 10},
        "fees": [{"name": "Reinigung", "amount": 50, "basis": "per_stay"}],
        "taxes": [{"name": "MwSt", "mode": "percent", "value": 19, "includedInPrice": False}],
        "promotions": [{"name": "Frühbucher", "percent": 10}],
    }
    r = _resolver(base=100.0, config=cfg)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 4),
            guests=2,
            channel="booking",
        )
    )
    assert q.nightly_total == 330.0  # 300 + 10 % Markup
    assert q.total == 406.98
    assert q.priceless is False


def test_quote_fee_tax_rate_snapshot_in_line() -> None:
    """fees[].taxRate wandert als Snapshot in die QuoteLine (Frühstück 19 %);
    Gebühr ohne taxRate bleibt ohne Zeilen-Satz (Rechnung → Übernachtungssatz)."""
    cfg = {
        "fees": [
            {"name": "Frühstück", "amount": 40, "basis": "per_stay", "taxRate": 19},
            {"name": "Reinigung", "amount": 50, "basis": "per_stay"},
        ],
    }
    r = _resolver(base=100.0, config=cfg)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 4),
            guests=2,
        )
    )
    by_label = {line.label: line for line in q.lines}
    assert by_label["Frühstück"].kind == "fee"
    assert by_label["Frühstück"].tax_rate == 19.0
    assert by_label["Reinigung"].tax_rate is None


def test_quote_direct_has_no_markup() -> None:
    cfg = {"markup": {"booking": 25}}
    r = _resolver(base=100.0, config=cfg)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 3),
            guests=1,
            channel="direct",
        )
    )
    assert q.nightly_total == 200.0  # kein Markup für direct
    assert q.total == 200.0


def test_quote_length_price_replaces_base() -> None:
    # Wochenpreis 80/Nacht ab 7 Nächten verdrängt den Basispreis (100).
    cfg = {
        "length_prices": [{"kind": "weekly", "minNights": 7, "pricePerNight": 80}],
    }
    r = _resolver(base=100.0, config=cfg)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 8),  # 7 Nächte
            guests=1,
        )
    )
    assert q.nightly_total == 560.0  # 7 × 80, nicht 700


def test_quote_extra_guest_surcharge() -> None:
    # Ab dem 3. Gast 20/Nacht. 2 Nächte, 4 Gäste → 2 Extra-Gäste × 20 × 2 = 80.
    cfg = {"extra_guest_charge": 20, "extra_guest_from": 3}
    r = _resolver(base=100.0, config=cfg)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 3),
            guests=4,
        )
    )
    assert q.nightly_total == 280.0  # 200 + 80


def test_quote_short_stay_surcharge() -> None:
    # Kurzaufenthalt ≤ 2 Nächte: +30/Nacht. 2 Nächte → +60.
    cfg = {"short_stay_max_nights": 2, "short_stay_surcharge": 30}
    r = _resolver(base=100.0, config=cfg)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 3),
            guests=1,
        )
    )
    assert q.nightly_total == 260.0  # 200 + 60


# --- Quote mit Zusatzleistungen (Upsells) ------------------------------------


def test_quote_includes_addon_per_guest() -> None:
    # Frühstück 12/Gast, 2 Gäste, 2 Nächte → 24 als eigene Position.
    addons = [
        {
            "id": "a-1",
            "name": {"de": "Frühstück"},
            "price": 12,
            "basis": "per_guest",
            "tax_rate": None,
        }
    ]
    r = _resolver(base=100.0, addons=addons)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 3),
            guests=2,
            addons=[{"addon_id": "a-1", "qty": 1}],
        )
    )
    assert any(line.label == "Frühstück" and line.amount == 24.0 for line in q.lines)
    assert q.total == 224.0  # 200 Übernachtung + 24 Frühstück


def test_quote_addon_with_tax() -> None:
    # Reinigung 50 pro Aufenthalt + 19% Steuer = 59.5.
    addons = [
        {
            "id": "a-2",
            "name": {"de": "Endreinigung"},
            "price": 50,
            "basis": "per_stay",
            "tax_rate": 19,
        }
    ]
    r = _resolver(base=100.0, addons=addons)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 3),
            guests=1,
            addons=[{"addon_id": "a-2", "qty": 1}],
        )
    )
    assert any(line.amount == 59.5 for line in q.lines)
    assert q.total == 259.5
