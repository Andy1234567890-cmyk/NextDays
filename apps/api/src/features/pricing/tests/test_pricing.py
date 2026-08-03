"""Tests für den pricing-Slice — der zentrale Preis-Resolver (eine Wahrheit).

Verifiziert die Prioritätsreihenfolge (override > weekday > base), dass ohne
Preis None bleibt (kein Fallback), und die Quote-Aufschlüsselung (Längenpreis,
Kurzaufenthalt, Extra-Gast, Markup, Gebühren, Aktion, Steuern).
"""
from datetime import date

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.features.pricing.resolver import PricingError, PricingResolver
from src.features.pricing.schemas import QuoteRequest
from src.main import create_app

client = TestClient(create_app())


def test_pricing_health() -> None:
    resp = client.get("/api/v1/pricing/health")
    assert resp.status_code == 200
    assert resp.json() == {"slice": "pricing", "status": "ok"}


def test_price_endpoints_require_booking_total_permission() -> None:
    """/effective und /quote sind hinter PM_BOOKING_TOTAL: ein Owner (ohne diese
    Permission) darf laut §4.2 keine Preise/Gesamtbeträge sehen → 403. Der Guard
    wird direkt geprüft (Owner-Set ohne PM_BOOKING_TOTAL vs. Admin)."""
    from unittest.mock import MagicMock

    import pytest
    from fastapi import HTTPException

    from src.core.security import AuthContext
    from src.features.auth.dependencies import require_granular_permission
    from src.features.auth.granular_permissions import Permission, UserRole

    guard = require_granular_permission(Permission.PM_BOOKING_TOTAL)

    # Owner ohne PM_BOOKING_TOTAL → 403.
    owner_ctx = AuthContext(user_id="u", tenant_id="t1", role="owner")
    owner_svc = MagicMock()
    owner_svc.role_and_permissions.return_value = (UserRole.owner, [])
    with pytest.raises(HTTPException) as exc:
        guard(owner_ctx, owner_svc)
    assert exc.value.status_code == 403

    # Admin → durchgelassen (Admin hat implizit alle Berechtigungen).
    admin_ctx = AuthContext(user_id="a", tenant_id="t1", role="admin")
    admin_svc = MagicMock()
    admin_svc.role_and_permissions.return_value = (UserRole.admin, [])
    assert guard(admin_ctx, admin_svc) is admin_ctx


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
    rate_plan_overrides: list[dict] | None = None,
) -> PricingResolver:
    tables: dict[str, list[dict]] = {
        "rate_plans": [{"base_price": base, "currency": "EUR"}] if base is not None else [],
        "price_overrides": overrides or [],
        "property_pricing_config": [config] if config else [],
        "dynamic_prices": dynamic or [],
        "property_addons": addons or [],
        "rate_plan_price_overrides": rate_plan_overrides or [],
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


# --- Rate-Plan-genauer Datumspreis (Hotel: Twin/BAR ≠ Double/B&B) ------------


def test_effective_rate_plan_price_beats_property_override() -> None:
    """Mit rate_plan_id gewinnt der rate-plan-genaue Datumspreis über den
    property-weiten Override (Hotel: der Plan hat seinen eigenen Preis)."""
    r = _resolver(
        base=100.0,
        overrides=[{"date": "2026-07-01", "price": 180}],
        rate_plan_overrides=[{"date": "2026-07-01", "price": 333}],
    )
    days = r.effective_prices(
        "p", date(2026, 7, 1), date(2026, 7, 2), rate_plan_id="rp1"
    )
    assert days[0].price == 333.0 and days[0].source == "rate_plan"


def test_effective_rate_plan_falls_back_to_property_when_unset() -> None:
    """Für Tage ohne rate-plan-genauen Preis gilt weiter der Property-Override/Base
    (der Plan erbt den property-weiten Preis)."""
    r = _resolver(
        base=100.0,
        overrides=[{"date": "2026-07-02", "price": 180}],
        rate_plan_overrides=[{"date": "2026-07-01", "price": 333}],
    )
    days = r.effective_prices(
        "p", date(2026, 7, 1), date(2026, 7, 3), rate_plan_id="rp1"
    )
    assert days[0].price == 333.0 and days[0].source == "rate_plan"
    assert days[1].price == 180.0 and days[1].source == "override"


def test_effective_ignores_rate_plan_price_without_rate_plan_id() -> None:
    """OHNE rate_plan_id (FeWo, Kalender-Board) bleibt das Verhalten property-weit —
    der rate-plan-genaue Preistopf wird gar nicht gelesen (kein Verhaltensbruch)."""
    r = _resolver(
        base=100.0,
        rate_plan_overrides=[{"date": "2026-07-01", "price": 333}],
    )
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 2))
    assert days[0].price == 100.0 and days[0].source == "base"


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


def test_quote_rate_plan_prices_and_currency_win() -> None:
    # Hotel: mit rate_plan_id bepreist der Quote DIESEN Plan — Basispreis,
    # dessen Datumspreise UND dessen Währung (sie ist die Verkaufs-Wahrheit,
    # config.currency darf sie nicht verdrängen).
    tables = {
        "rate_plans": [{"base_price": 80, "currency": "USD"}],
        "price_overrides": [],
        "property_pricing_config": [{"currency": "EUR"}],
        "dynamic_prices": [],
        "property_addons": [],
        "rate_plan_price_overrides": [{"date": "2026-07-02", "price": 150}],
    }
    r = PricingResolver(service_client=_DB(tables))
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 3),
            guests=2,
            rate_plan_id="rp-1",
        )
    )
    assert q.nightly_total == 230.0  # 80 (Basis) + 150 (Plan-Datumspreis)
    assert q.currency == "USD"


def test_quote_foreign_rate_plan_422() -> None:
    # Fremder/nicht existenter Plan ist ein Datenfehler des Aufrufers — 422,
    # NIE stiller Fallback auf den ältesten Plan (falscher Preis).
    tables = {
        "rate_plans": [],
        "price_overrides": [],
        "property_pricing_config": [],
        "dynamic_prices": [],
        "property_addons": [],
        "rate_plan_price_overrides": [],
    }
    r = PricingResolver(service_client=_DB(tables))
    try:
        r.quote(
            QuoteRequest(
                property_id="p",
                check_in=date(2026, 7, 1),
                check_out=date(2026, 7, 3),
                rate_plan_id="rp-fremd",
            )
        )
        raise AssertionError("sollte 422 werfen")
    except PricingError as exc:
        assert exc.status_code == 422


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
    # 3 Nächte, base 100, Reinigung 50 fest, Frühbucher 10 %, MwSt 19 %
    # (nicht enthalten). Der frühere „Kanal-Markup" ist entfernt (0272,
    # Attrappe) — Portal-Aufschläge sind Kanal-Pläne, keine Quote-Zeile.
    cfg = {
        "fees": [{"name": "Reinigung", "amount": 50, "basis": "per_stay"}],
        # USt. (kind="vat") liegt auf allem, was verkauft wird — also auch auf
        # der Reinigungsgebühr. Nur LOKALE Abgaben rechnen ausschließlich auf den
        # Grundpreis (siehe test_quote_lokale_prozentsteuer_nur_auf_grundpreis).
        "taxes": [
            {"name": "MwSt", "kind": "vat", "mode": "percent", "value": 19,
             "includedInPrice": False}
        ],
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
    assert q.nightly_total == 300.0
    assert q.total == 374.85
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


# --- Abgeleitete Rate-Pläne (derived): Formel + Kaskade-Auflösung ------------

from src.features.pricing.resolver import _apply_offset  # noqa: E402


def test_apply_offset_amount_then_percent() -> None:
    # SiteMinder-Reihenfolge: erst Betrag, dann Prozent. (100+25)*0,85 = 106,25.
    assert _apply_offset(100.0, 25.0, -15.0) == 106.25


def test_apply_offset_mirror_when_both_none() -> None:
    assert _apply_offset(120.0, None, None) == 120.0


def test_apply_offset_le_zero_is_none() -> None:
    # Ergebnis <= 0 → kein Preis (fail-closed, kein Clamp).
    assert _apply_offset(10.0, -20.0, None) is None
    assert _apply_offset(100.0, None, -100.0) is None


def test_apply_offset_parent_none_is_none() -> None:
    assert _apply_offset(None, 25.0, None) is None


def test_apply_offset_rounds_half_up() -> None:
    # 100 * 1,155 = 115,5 → kaufmännisch 115,50 (deterministisch).
    assert _apply_offset(100.0, None, 15.5) == 115.5
    # 33,33 + 0 → 33,33; * 1,105 = 36,829... → 36,83.
    assert _apply_offset(33.33, None, 10.5) == 36.83


class _FilterQ:
    """Query-Stub, der nach eq('id', …)/eq('property_id', …) filtert — nötig,
    damit _load_rate_plan_meta Kind vs. Parent unterscheidet."""

    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows
        self._filters: dict[str, object] = {}

    def select(self, *_a: object, **_k: object) -> "_FilterQ":
        return self

    def eq(self, field: str, value: object) -> "_FilterQ":
        self._filters[field] = value
        return self

    def gte(self, *_a: object, **_k: object) -> "_FilterQ":
        return self

    def lt(self, *_a: object, **_k: object) -> "_FilterQ":
        return self

    def in_(self, *_a: object, **_k: object) -> "_FilterQ":
        return self

    def order(self, *_a: object, **_k: object) -> "_FilterQ":
        return self

    def limit(self, *_a: object, **_k: object) -> "_FilterQ":
        return self

    @property
    def not_(self) -> "_FilterQ":
        return self

    def is_(self, *_a: object, **_k: object) -> "_FilterQ":
        return self

    def execute(self) -> object:
        rows = [
            r for r in self._rows
            if all(r.get(k) == v for k, v in self._filters.items())
        ]

        class _R:
            pass

        res = _R()
        res.data = rows  # type: ignore[attr-defined]
        return res


class _FilterDB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self._tables = tables

    def table(self, name: str) -> _FilterQ:
        return _FilterQ(self._tables.get(name, []))


def _derived_resolver(plans: list[dict], rp_overrides=None) -> PricingResolver:
    return PricingResolver(service_client=_FilterDB({
        "rate_plans": plans,
        "price_overrides": [],
        "property_pricing_config": [],
        "dynamic_prices": [],
        "rate_plan_price_overrides": rp_overrides or [],
    }))


def test_derived_plan_follows_parent_base() -> None:
    plans = [
        {"id": "bar", "property_id": "p", "base_price": 100, "currency": "EUR",
         "rate_mode": "manual"},
        {"id": "bnb", "property_id": "p", "base_price": 0, "currency": "EUR",
         "rate_mode": "derived", "derived_from_rate_plan_id": "bar",
         "offset_amount": 25, "offset_percent": None},
    ]
    r = _derived_resolver(plans)
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 3),
                              rate_plan_id="bnb")
    assert [d.price for d in days] == [125.0, 125.0]
    assert all(d.source == "derived" for d in days)


def test_derived_plan_follows_parent_date_price() -> None:
    # Datumspreis am Parent → das abgeleitete Kind zieht mit.
    plans = [
        {"id": "bar", "property_id": "p", "base_price": 100, "currency": "EUR",
         "rate_mode": "manual"},
        {"id": "nr", "property_id": "p", "base_price": 0, "currency": "EUR",
         "rate_mode": "derived", "derived_from_rate_plan_id": "bar",
         "offset_amount": None, "offset_percent": -10},
    ]
    r = _derived_resolver(
        plans, rp_overrides=[{"rate_plan_id": "bar", "date": "2026-07-01",
                              "price": 200}],
    )
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 3),
                              rate_plan_id="nr")
    # 200 -10% = 180 am Datumspreis-Tag, 100 -10% = 90 sonst.
    assert days[0].price == 180.0
    assert days[1].price == 90.0


def test_derived_plan_no_price_when_parent_none() -> None:
    plans = [
        {"id": "bar", "property_id": "p", "base_price": None, "currency": "EUR",
         "rate_mode": "manual"},
        {"id": "bnb", "property_id": "p", "base_price": 0, "currency": "EUR",
         "rate_mode": "derived", "derived_from_rate_plan_id": "bar",
         "offset_amount": 25, "offset_percent": None},
    ]
    r = _derived_resolver(plans)
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 2),
                              rate_plan_id="bnb")
    assert days[0].price is None


def test_quote_kurtaxe_pro_gast_pro_nacht() -> None:
    """Kurtaxe „2,50 € pro Gast pro Nacht": 3 Nächte × 2 Gäste = 15,00 €."""
    cfg = {
        "taxes": [
            {
                "id": "kurtaxe",
                "kind": "local",
                "taxType": "TouristTax",
                "name": "Kurtaxe",
                "mode": "amount",
                "value": 2.5,
                "chargeBasis": "PerPerson",
                "period": "PerNight",
                "includedInPrice": False,
            }
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
    kurtaxe = next(line for line in q.lines if line.kind == "tax")
    assert kurtaxe.amount == 15.0
    assert q.total == 315.0


def test_quote_betrags_steuer_altdatensatz_bleibt_pro_nacht() -> None:
    """Ohne chargeBasis/period gilt weiter „einmalig pro Nacht" (Bestand)."""
    cfg = {
        "taxes": [
            {"id": "alt", "name": "Abgabe", "mode": "amount", "value": 3,
             "includedInPrice": False}
        ],
    }
    r = _resolver(base=100.0, config=cfg)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 4),
            guests=4,
        )
    )
    assert next(line for line in q.lines if line.kind == "tax").amount == 9.0


def test_quote_prozentsteuer_nur_auf_gewaehlte_grundlage() -> None:
    """taxableBase=[base_price] besteuert NUR die Übernachtung, nicht die
    Reinigungsgebühr."""
    cfg = {
        "fees": [
            {"id": "clean", "name": "Reinigung", "amount": 50, "basis": "per_stay"}
        ],
        "taxes": [
            {
                "id": "city",
                "kind": "local",
                "name": "Stadtsteuer",
                "mode": "percent",
                "value": 10,
                "taxableBase": ["base_price"],
                "includedInPrice": False,
            }
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
    # 10 % von 300 (nur Übernachtung), NICHT von 350.
    assert next(line for line in q.lines if line.kind == "tax").amount == 30.0


def test_quote_grundlage_mit_gebuehrenkategorie_wirkt_nur_bei_airbnb() -> None:
    """Eine gewählte Gebührenkategorie in der Grundlage ändert die EIGENE
    Buchungsstrecke NICHT: dort gilt „Steuern nur auf den Basispreis".

    Die Auswahl wirkt ausschließlich beim Airbnb-Export
    (channel_manager/ota_abgaben.py) — so ist der Branchenstandard live
    beschrieben. Vorher besteuerte diese Grundlage die Reinigungsgebühr auch in
    der Direktbuchung mit (350 statt 300).
    """
    cfg = {
        "fees": [
            {"id": "clean", "name": "Reinigung", "amount": 50, "basis": "per_stay",
             "feeType": "cleaning_fee"}
        ],
        "taxes": [
            {
                "id": "city",
                "kind": "local",
                "name": "Stadtsteuer",
                "mode": "percent",
                "value": 10,
                "taxableBase": ["base_price", "cleaning"],
                "includedInPrice": False,
            }
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
    assert next(line for line in q.lines if line.kind == "tax").amount == 30.0


def test_quote_lokale_prozentsteuer_nur_auf_grundpreis() -> None:
    """Ohne gepflegte Grundlage gilt dasselbe: die lokale Prozent-Steuer rechnet
    auf den Grundpreis, nicht auf Grundpreis + Gebühren."""
    cfg = {
        "fees": [
            {"id": "clean", "name": "Reinigung", "amount": 50, "basis": "per_stay"}
        ],
        "taxes": [
            {"id": "city", "kind": "local", "name": "Stadtsteuer",
             "mode": "percent", "value": 10, "includedInPrice": False}
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
    assert next(line for line in q.lines if line.kind == "tax").amount == 30.0


def test_quote_prozentgebuehr_einmalig_auf_zimmerpreis() -> None:
    """Prozentuale Gebühr: einmalig auf den Zimmerpreis, die Basis multipliziert
    nichts — 5 % von 300 sind 15, auch bei basis=per_night."""
    cfg = {
        "fees": [
            {"id": "resort", "name": "Resortgebühr", "amount": 5,
             "mode": "percent", "basis": "per_night", "feeType": "resort"}
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
    assert next(line for line in q.lines if line.kind == "fee").amount == 15.0
    assert q.total == 315.0


def test_quote_kanal_einschraenkung_gilt_auch_direkt() -> None:
    """Eine Gebühr „nur an Booking" darf in einer Direktbuchung nicht auftauchen.

    Die Einschränkung zählt die eigene Buchungsstrecke mit — sonst behauptet die
    Oberfläche „nur an Booking" und die Rechnung stellt sie trotzdem.
    """
    cfg = {
        "fees": [
            {"id": "b", "name": "Nur Booking", "amount": 50, "basis": "per_stay",
             "portalScope": ["BookingCom"]},
            {"id": "d", "name": "Überall", "amount": 20, "basis": "per_stay"},
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
    labels = [line.label for line in q.lines if line.kind == "fee"]
    assert labels == ["Überall"]
    assert q.total == 320.0


def test_quote_gastseitiger_steuername_gewinnt() -> None:
    """names[locale] ist der Text, den der Gast sieht — nicht der interne Name."""
    cfg = {
        "taxes": [
            {"id": "t", "kind": "local", "name": "intern", "names": {"de": "Kurtaxe"},
             "mode": "amount", "value": 2, "includedInPrice": False}
        ],
    }
    r = _resolver(base=100.0, config=cfg)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 2),
            guests=1,
        )
    )
    assert next(line for line in q.lines if line.kind == "tax").label == "Kurtaxe"


def test_quote_zeitraum_obergrenze() -> None:
    """Ein unbegrenzter Zeitraum aus Client-Input ist ein Fehler (Wurzel 8)."""
    with pytest.raises(ValidationError):
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 1, 1),
            check_out=date(2030, 1, 1),
            guests=1,
        )
