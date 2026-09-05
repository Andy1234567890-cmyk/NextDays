"""Tests für den pricing-Slice — der zentrale Preis-Resolver (eine Wahrheit).

Verifiziert die Prioritätsreihenfolge (override > weekday > base), dass ohne
Preis None bleibt (kein Fallback), und die Quote-Aufschlüsselung (Längenpreis,
Kurzaufenthalt, Extra-Gast, Markup, Gebühren, Aktion, Steuern).
"""
import dataclasses
from datetime import date, timedelta

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
    dp_enabled: bool | None = None,
    addons: list[dict] | None = None,
    rate_plan_overrides: list[dict] | None = None,
    discounts: list[dict] | None = None,
) -> PricingResolver:
    # Dynamic Pricing gilt als eingeschaltet, sobald der Test dynamische Preise
    # mitgibt (`dp_enabled` überschreibt das gezielt — z. B. um zu prüfen, dass
    # der manuelle Tagespreis nach dem Abschalten wieder greift).
    aktiv = dp_enabled if dp_enabled is not None else bool(dynamic)
    tables: dict[str, list[dict]] = {
        "rate_plans": [{"base_price": base, "currency": "EUR"}] if base is not None else [],
        "price_overrides": overrides or [],
        "property_pricing_config": [config] if config else [],
        "dp_settings": [{"property_id": "p", "enabled": aktiv}],
        "dynamic_prices": dynamic or [],
        "property_addons": addons or [],
        "rate_plan_price_overrides": rate_plan_overrides or [],
        # Aktionen/Rabatte (property_discounts, 0185 + 0276).
        "property_discounts": discounts or [],
    }
    return PricingResolver(service_client=_DB(tables))


# --- Effektivpreis: dynamic (nur bei aktivem DP) > override > weekday > base ---


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


def test_dynamic_schlaegt_manuellen_tagespreis_wenn_dp_an() -> None:
    # Hat die Agentur Dynamic Pricing eingeschaltet, übernimmt der Autopilot die
    # Preisgestaltung — auch gegen einen älteren manuellen Tagespreis. Live-Anlass
    # (04.09.2026): ein Saisonpreis vom 07.08. verdeckte die berechneten Preise.
    r = _resolver(
        base=100.0,
        overrides=[{"date": "2026-07-01", "price": 220}],
        dynamic=[{"date": "2026-07-01", "price": 175}],
        dp_enabled=True,
    )
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 2))
    assert days[0].price == 175.0 and days[0].source == "dynamic"


def test_manueller_tagespreis_greift_sofort_wieder_wenn_dp_aus() -> None:
    # Der Knackpunkt: schaltet die Agentur ab, gilt SOFORT wieder der manuelle
    # Tagespreis. Die dynamic_prices-Zeilen bleiben dabei bestehen (sie werden
    # nicht gelöscht) — sie dürfen nur nicht mehr wirken.
    r = _resolver(
        base=100.0,
        overrides=[{"date": "2026-07-01", "price": 220}],
        dynamic=[{"date": "2026-07-01", "price": 175}],
        dp_enabled=False,
    )
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 2))
    assert days[0].price == 220.0 and days[0].source == "override"


def test_dp_aus_kein_geisterpreis_ohne_override() -> None:
    # Ohne manuellen Tagespreis darf ein alter dynamic_prices-Bestand nach dem
    # Abschalten NICHT weitergelten — sonst bliebe der Autopilot-Preis stehen,
    # obwohl DP aus ist.
    r = _resolver(
        base=100.0,
        dynamic=[{"date": "2026-07-01", "price": 175}],
        dp_enabled=False,
    )
    days = r.effective_prices("p", date(2026, 7, 1), date(2026, 7, 2))
    assert days[0].price == 100.0 and days[0].source == "base"


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
    # 3 Nächte, base 100, Reinigung 50 fest, Aktion 10 %, MwSt 19 %
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
    }
    r = _resolver(
        base=100.0,
        config=cfg,
        discounts=[
            {"discount_type": "promotion", "discount_kind": "percent",
             "discount_bps": 1000, "name": {"de": "Frühbucher"}},
        ],
    )
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
    # 300 Übernachtung + 50 Reinigung; die Aktion rabattiert NUR die
    # Übernachtung (−30, Branchenstandard: „% des Gesamtwerts der Buchung exkl.
    # Gebühren, Steuern & Aktionen") → 320 netto, +19 % USt = 380,80. Vorher lief
    # der Rabatt über die ganze Zwischensumme und zog auch 10 % von der
    # Reinigungsgebühr ab (374,85) — mehr, als die Oberfläche zusagt.
    assert q.total == 380.8
    assert q.priceless is False


def test_quote_blob_aktion_rabattiert_nicht_mehr() -> None:
    """`type_attributes.pricing.promotions` war der ZWEITE Rabattpfad: Bedingung
    als Freitext, nie geprüft, Prozentsatz von JEDER Buchung abgezogen — eine
    Aktion „20 % nur Juni" rabattierte das ganze Jahr. Der Pfad ist weg; die
    Zeile darf keinen Preis mehr verändern."""
    cfg = {"promotions": [{"name": "Alt", "percent": 20, "conditions": "nur Juni"}]}
    r = _resolver(base=100.0, config=cfg)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 4),
            guests=2,
        )
    )
    assert q.total == 300.0
    assert not [ln for ln in q.lines if ln.kind == "discount"]


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


def test_quote_haustiergebuehr_pro_tier() -> None:
    """„Pro Tier und Aufenthalt": die Gebühr multipliziert die Tierzahl der
    Buchung — mit zwei Hunden das Doppelte, ohne Tier gar nichts."""
    cfg = {
        "fees": [
            {"name": "Haustier", "amount": 25, "basis": "per_pet_stay",
             "feeType": "pet_fee"},
        ],
    }
    r = _resolver(base=100.0, config=cfg)

    def quote_mit(pets: int) -> dict[str, float]:
        q = r.quote(
            QuoteRequest(
                property_id="p",
                check_in=date(2026, 7, 1),
                check_out=date(2026, 7, 4),
                guests=2,
                pets=pets,
            )
        )
        return {line.label: line.amount for line in q.lines}

    assert quote_mit(2)["Haustier"] == 50.0
    assert quote_mit(1)["Haustier"] == 25.0
    # Kein Tier → keine Zeile (Beträge von 0 werden nicht ausgewiesen).
    assert "Haustier" not in quote_mit(0)


def test_quote_haustier_pauschale_nur_mit_tier() -> None:
    """Haustier-PAUSCHALE (`per_stay`) greift nur bei einer Buchung mit Tier.

    Das war der Live-Bug: die Bedingung hing an der Basis, und `per_stay`
    multipliziert nichts — die Gebühr lief jedem Gast mit. Alle neun gepflegten
    Haustiergebühren der Kundendatenbank standen genau so (150 DKK, `per_stay`,
    aus dem Airbnb-Import). Die Pauschale bleibt eine Pauschale: zwei Hunde
    kosten dasselbe wie einer, nur ohne Tier entfällt sie.
    """
    cfg = {
        "fees": [
            {"name": "Haustier", "amount": 150, "basis": "per_stay",
             "feeType": "pet_fee"},
            {"name": "Reinigung", "amount": 80, "basis": "per_stay",
             "feeType": "cleaning_fee"},
        ],
    }
    r = _resolver(base=100.0, config=cfg)

    def quote_mit(pets: int) -> dict[str, float]:
        q = r.quote(
            QuoteRequest(
                property_id="p",
                check_in=date(2026, 7, 1),
                check_out=date(2026, 7, 4),
                guests=2,
                pets=pets,
            )
        )
        return {line.label: line.amount for line in q.lines}

    ohne = quote_mit(0)
    assert "Haustier" not in ohne
    # Die Gegenprobe: eine Gebühr OHNE Tierbezug bleibt unberührt.
    assert ohne["Reinigung"] == 80.0

    assert quote_mit(1)["Haustier"] == 150.0
    # Pauschale heißt Pauschale — nicht je Tier (dafür gibt es per_pet_stay).
    assert quote_mit(3)["Haustier"] == 150.0


def test_quote_haustier_altbestand_und_ohne_art() -> None:
    """Der Altbestandsschlüssel `pet` trägt dieselbe Bedingung wie `pet_fee`.

    Eine Gebühr OHNE `feeType` dagegen nicht: welche Art sie hat, ist unbekannt,
    und aus dem Namen „Hundegebühr" eine Art zu raten wäre ein erfundener Wert
    (Wurzel 4). Sie verhält sich wie bisher.
    """
    cfg = {
        "fees": [
            {"name": "Tier alt", "amount": 60, "basis": "per_stay",
             "feeType": "pet"},
            {"name": "Hundegebühr", "amount": 40, "basis": "per_stay"},
        ],
    }
    r = _resolver(base=100.0, config=cfg)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 4),
            guests=2,
            pets=0,
        )
    )
    labels = {line.label: line.amount for line in q.lines}
    assert "Tier alt" not in labels
    assert labels["Hundegebühr"] == 40.0


def test_quote_haustier_prozent_nur_mit_tier() -> None:
    """Auch die prozentuale Haustiergebühr braucht ein Tier.

    Prozent ist immer einmalig auf den Zimmerpreis und multipliziert die
    Tierzahl nie — ohne die Bedingung an der ART wäre gerade dieser Fall
    dauerhaft offen geblieben.
    """
    cfg = {
        "fees": [
            {"name": "Haustier %", "amount": 10, "mode": "percent",
             "basis": "per_stay", "feeType": "pet_fee"},
        ],
    }
    r = _resolver(base=100.0, config=cfg)

    def labels(pets: int) -> dict[str, float]:
        q = r.quote(
            QuoteRequest(
                property_id="p",
                check_in=date(2026, 7, 1),
                check_out=date(2026, 7, 4),
                guests=2,
                pets=pets,
            )
        )
        return {line.label: line.amount for line in q.lines}

    assert "Haustier %" not in labels(0)
    assert labels(1)["Haustier %"] == 30.0


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
    # Frühstück 12/Person. Die MENGE ist die Personenzahl (seit 14.08.2026):
    # `qty=2` heißt „für 2 Personen" → 24. Vorher rechnete die Basis
    # `preis × guests × qty` und die Bestellmenge ließ sich nicht unter die
    # Gästezahl der Buchung drücken — genau der Fall, den ein Betrieb laufend
    # hat (4 Gäste, aber nur 2 Wäschepakete bestellt).
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
            addons=[{"addon_id": "a-1", "qty": 2}],
        )
    )
    # Das Label führt die Menge mit („Frühstück ×2") — sie ist jetzt die
    # Personenzahl und gehört deshalb sichtbar an die Position.
    assert any(
        line.label.startswith("Frühstück") and line.amount == 24.0
        for line in q.lines
    )
    assert q.total == 224.0  # 200 Übernachtung + 24 Frühstück


def test_quote_addon_per_guest_unter_der_gaestezahl() -> None:
    """4 Gäste, aber nur 2 Frühstücke bestellt — der Auslöser der Änderung."""
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
            guests=4,
            addons=[{"addon_id": "a-1", "qty": 2}],
        )
    )
    # 12 × 2 = 24 — nicht 12 × 4 Gäste × 2 = 96 (alte Regel).
    assert any(
        line.label.startswith("Frühstück") and line.amount == 24.0
        for line in q.lines
    )


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


def test_quote_fee_tax_exklusiv_rechnet_die_ust_obendrauf() -> None:
    """Jede Zeile ist BRUTTO (die Rechnung zerlegt sie). Ist der eingetippte
    Betrag netto (`taxIncluded: false`), muss der Satz obendrauf — sonst fehlte
    er auf der Rechnung und der Betrieb bekäme weniger als gewollt."""
    cfg = {
        "fees": [
            {"id": "a", "name": "Netto", "amount": 100, "basis": "per_stay",
             "taxRate": 19, "taxIncluded": False},
            {"id": "b", "name": "Brutto", "amount": 100, "basis": "per_stay",
             "taxRate": 19, "taxIncluded": True},
            # Ohne eigenen Satz gibt es nichts aufzuschlagen (Wurzel 4).
            {"id": "c", "name": "Ohne Satz", "amount": 100, "basis": "per_stay",
             "taxIncluded": False},
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
    assert by_label["Netto"].amount == 119.0
    assert by_label["Brutto"].amount == 100.0
    assert by_label["Ohne Satz"].amount == 100.0


def test_quote_fee_short_stay_only() -> None:
    """„Nur für Kurzaufenthalte" greift genau bis zur Grenze des Objekts — und
    ohne gepflegte Grenze gar nicht (keine geratene Nächtezahl)."""
    cfg = {
        "short_stay_max_nights": 3,
        "fees": [
            {"id": "k", "name": "Kurz", "amount": 30, "basis": "per_stay",
             "shortStayOnly": True},
        ],
    }
    r = _resolver(base=100.0, config=cfg)

    def labels(nights: int) -> set[str]:
        q = r.quote(
            QuoteRequest(
                property_id="p",
                check_in=date(2026, 7, 1),
                check_out=date(2026, 7, 1 + nights),
                guests=2,
            )
        )
        return {line.label for line in q.lines}

    assert "Kurz" in labels(3)
    assert "Kurz" not in labels(4)

    ohne_grenze = _resolver(
        base=100.0,
        config={
            "fees": [
                {"id": "k", "name": "Kurz", "amount": 30, "basis": "per_stay",
                 "shortStayOnly": True},
            ],
        },
    )
    q = ohne_grenze.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 3),
            guests=2,
        )
    )
    assert "Kurz" not in {line.label for line in q.lines}


def test_quote_fee_gueltigkeit_nach_anreise_und_nur_abrechnung() -> None:
    """„Gilt ab" greift nach der ANREISE; „nur in der Eigentümer-Abrechnung"
    wird dem Gast nie berechnet."""
    r = _resolver(
        base=100.0,
        config={
            "fees": [
                {"id": "r", "name": "Resort", "amount": 25, "basis": "per_night",
                 "validFrom": "2026-08-01"},
                {"id": "i", "name": "Intern", "amount": 40, "basis": "per_stay",
                 "ownerStatementOnly": True},
                {"id": "c", "name": "Reinigung", "amount": 300, "basis": "per_stay"},
            ],
        },
    )

    def labels(check_in: date) -> set[str]:
        q = r.quote(
            QuoteRequest(
                property_id="p",
                check_in=check_in,
                check_out=check_in + timedelta(days=2),
                guests=2,
            )
        )
        return {line.label for line in q.lines}

    vorher = labels(date(2026, 7, 30))
    assert "Resort" not in vorher
    assert "Reinigung" in vorher
    nachher = labels(date(2026, 8, 1))
    assert "Resort" in nachher
    assert "Intern" not in vorher and "Intern" not in nachher


# --- Aktionen: Bedingungen werden WIRKLICH geprüft (0276) --------------------


def _mit_aktion(regel: dict, **req_kw: object) -> object:
    """Quote mit genau einer Aktion; Standard-Anfrage 3 Nächte ab 01.07.2026."""
    r = _resolver(
        base=100.0,
        discounts=[{"discount_bps": 1000, "discount_kind": "percent", **regel}],
    )
    kw: dict = {
        "property_id": "p",
        "check_in": date(2026, 7, 1),
        "check_out": date(2026, 7, 4),
        "guests": 2,
        "as_of": date(2026, 6, 1),
        **req_kw,
    }
    return r.quote(QuoteRequest(**kw))


def _rabatt(q: object) -> float:
    return round(sum(ln.amount for ln in q.lines if ln.kind == "discount"), 2)


def test_aktion_ohne_bedingung_gilt_immer() -> None:
    """Keine Bedingung ist eine bewusste Eingabe („20 % auf alles"), kein
    Versehen — im Standard sind alle Bedingungsfelder abwählbar."""
    assert _rabatt(_mit_aktion({"discount_type": "promotion"})) == -30.0


def test_aktion_aufenthaltsdaten() -> None:
    """Mehrere Zeiträume, EINER muss die Nacht decken. Vorher war das ein
    Freitext, der die Rechnung nicht erreichte."""
    juni = {"from": "2026-06-01", "to": "2026-06-30"}
    juli = {"from": "2026-07-01", "to": "2026-07-31"}
    assert _rabatt(_mit_aktion({"discount_type": "promotion", "stay_ranges": [juni]})) == 0.0
    assert _rabatt(
        _mit_aktion({"discount_type": "promotion", "stay_ranges": [juni, juli]})
    ) == -30.0


def test_aktion_zeitraum_nur_die_gedeckten_naechte() -> None:
    """Deckt der Aktionszeitraum nur einen TEIL des Aufenthalts, gilt die Aktion
    nur für die Nächte darin — wörtlich der Branchenstandard („gilt sie nur für
    die Tage, die in den Aktionszeitraum fallen").

    Vorher entschied allein der ANREISETAG: lag er im Zeitraum, bekam der ganze
    Aufenthalt den Rabatt; lag er einen Tag davor, bekam ihn kein einziger Tag.
    Damit rechnete die Buchungsstrecke anders als der Portal-Push, der schon
    immer je Tag rabattiert."""
    # 3 Nächte 01.–04.07. zu je 100. Zeitraum deckt nur den 1. und 2. Juli.
    zwei_von_drei = {"from": "2026-07-01", "to": "2026-07-02"}
    assert _rabatt(
        _mit_aktion({"discount_type": "promotion", "stay_ranges": [zwei_von_drei]})
    ) == -20.0
    # Zeitraum beginnt NACH der Anreise: die gedeckten Nächte zählen trotzdem.
    spaeter = {"from": "2026-07-03", "to": "2026-07-31"}
    assert _rabatt(
        _mit_aktion({"discount_type": "promotion", "stay_ranges": [spaeter]})
    ) == -10.0
    # Gar keine gedeckte Nacht → kein Rabatt (und keine Rabattzeile).
    assert _rabatt(
        _mit_aktion(
            {"discount_type": "promotion",
             "stay_ranges": [{"from": "2026-08-01", "to": "2026-08-31"}]}
        )
    ) == 0.0


def test_aktion_hoechster_wert_gewinnt_auch_als_pauschale() -> None:
    """„Die Aktion mit dem höchsten Wert" — verglichen wird die Ersparnis in Geld.

    Vorher wurde nur `discount_bps` verglichen. Eine Pauschale trägt dort den
    Mindestwert 1 (die Spalte ist NOT NULL und wird bei `fixed` nicht gelesen)
    und konnte deshalb NIE gewinnen: 200 € verloren gegen 5 %."""
    r = _resolver(
        base=100.0,
        discounts=[
            {"discount_type": "promotion", "discount_kind": "percent",
             "discount_bps": 500, "name": {"de": "5 %"}},
            {"discount_type": "promotion", "discount_kind": "fixed",
             "discount_bps": 1, "discount_amount": 200, "name": {"de": "200 €"}},
        ],
    )
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 4),
            guests=2,
            as_of=date(2026, 6, 1),
        )
    )
    # 3 × 100 = 300: 5 % wären 15, die Pauschale ist 200 → sie gewinnt.
    assert _rabatt(q) == -200.0
    assert any("200" in ln.label for ln in q.lines if ln.kind == "discount")


def test_aktion_rabattiert_keine_gebuehren() -> None:
    """Grundlage ist der Übernachtungswert, NICHT die Gebühren — genau die Zusage
    am Eingabefeld („exkl. Gebühren, Steuern & Aktionen")."""
    r = _resolver(
        base=100.0,
        config={"fees": [{"name": "Reinigung", "amount": 90, "basis": "per_stay"}]},
        discounts=[
            {"discount_type": "promotion", "discount_kind": "percent",
             "discount_bps": 1000},
        ],
    )
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 4),
            guests=2,
            as_of=date(2026, 6, 1),
        )
    )
    # 10 % von 300 (Übernachtung), nicht von 390.
    assert _rabatt(q) == -30.0
    assert q.total == 360.0


def test_aktion_buchungsdaten() -> None:
    """„Daten der Buchung" prüft `as_of` (wann gebucht wird), NICHT die Anreise."""
    regel = {
        "discount_type": "promotion",
        "booked_from": "2026-05-01",
        "booked_to": "2026-05-31",
    }
    assert _rabatt(_mit_aktion(regel)) == 0.0
    assert _rabatt(_mit_aktion(regel, as_of=date(2026, 5, 15))) == -30.0


def test_aktion_vorlauf_fenster_kombinierbar() -> None:
    """Frühbucher (Untergrenze) und Last Minute (Obergrenze) sind zwei Grenzen
    desselben Maßes und deshalb kombinierbar — im Standard drei unabhängige
    Checkboxen. 30 Tage Vorlauf im Beispiel."""
    assert _rabatt(_mit_aktion({"discount_type": "promotion", "lead_min_days": 60})) == 0.0
    assert _rabatt(_mit_aktion({"discount_type": "promotion", "lead_min_days": 10})) == -30.0
    assert _rabatt(_mit_aktion({"discount_type": "promotion", "lead_max_days": 7})) == 0.0
    # Fenster 10..60 Tage: 30 liegt drin.
    assert _rabatt(
        _mit_aktion(
            {"discount_type": "promotion", "lead_min_days": 10, "lead_max_days": 60}
        )
    ) == -30.0


def test_aktion_mindestnaechte_mit_zeitraum_kombiniert() -> None:
    """Das war mit dem alten Modell NICHT ausdrückbar: der Typ-CHECK erlaubte je
    Zeile genau eine Bedingung."""
    regel = {
        "discount_type": "promotion",
        "min_nights": 5,
        "stay_ranges": [{"from": "2026-07-01", "to": "2026-07-31"}],
    }
    assert _rabatt(_mit_aktion(regel)) == 0.0  # nur 3 Nächte
    assert _rabatt(_mit_aktion(regel, check_out=date(2026, 7, 8))) != 0.0


def test_aktion_angebotscode() -> None:
    """Mit gepflegten Codes greift die Aktion NUR mit einem davon — Groß-/
    Kleinschreibung egal, sonst findet niemand den Grund."""
    regel = {"discount_type": "promotion", "promo_codes": ["SOMMER26"]}
    assert _rabatt(_mit_aktion(regel)) == 0.0
    assert _rabatt(_mit_aktion(regel, promo_code="sommer26")) == -30.0
    assert _rabatt(_mit_aktion(regel, promo_code="WINTER")) == 0.0


def test_aktion_kanal_einschraenkung() -> None:
    """Dieselbe Achse wie bei Gebühren/Steuern: „nur Booking" darf in einer
    Direktbuchung nicht erscheinen."""
    regel = {"discount_type": "promotion", "portal_scope": ["BookingCom"]}
    assert _rabatt(_mit_aktion(regel)) == 0.0
    assert _rabatt(_mit_aktion(regel, channel="BookingCom")) == -30.0


def test_aktion_pauschalbetrag_kappt_bei_der_summe() -> None:
    """Eine Pauschale darf den Preis nicht unter null drücken — ein negativer
    Gesamtpreis wäre eine Auszahlung an den Gast."""
    q = _mit_aktion(
        {"discount_type": "promotion", "discount_kind": "fixed", "discount_amount": 50}
    )
    assert _rabatt(q) == -50.0
    assert q.total == 250.0
    zu_gross = _mit_aktion(
        {"discount_type": "promotion", "discount_kind": "fixed",
         "discount_amount": 5000}
    )
    assert zu_gross.total == 0.0


def test_aktion_bester_einzelrabatt_kein_stacking() -> None:
    """Mehrere greifende Aktionen addieren sich NICHT (Booking/Airbnb-Standard) —
    nur die höchste gewinnt."""
    r = _resolver(
        base=100.0,
        discounts=[
            {"discount_type": "promotion", "discount_bps": 500,
             "discount_kind": "percent"},
            {"discount_type": "promotion", "discount_bps": 2000,
             "discount_kind": "percent"},
        ],
    )
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 4),
            guests=2,
        )
    )
    assert _rabatt(q) == -60.0  # 20 % von 300, nicht 25 %


def test_aktion_kaputtes_datum_faellt_nicht_offen_aus() -> None:
    """Ein unlesbares Grenzdatum darf die Bedingung nicht WEGFALLEN lassen —
    sonst griffe der Rabatt plötzlich überall (Wurzel 5, fail-closed)."""
    regel = {"discount_type": "promotion", "stay_ranges": [{"from": "kaputt", "to": "x"}]}
    assert _rabatt(_mit_aktion(regel)) == 0.0


def test_promo_code_applied_nur_bei_echtem_treffer() -> None:
    """Der Gast muss unterscheiden können: „Code angewendet" oder „Code ungültig,
    aber es gilt eine automatische Aktion". Sonst sieht er einen Rabatt und hält
    seinen falschen Code für gültig."""
    # Aktion MIT Code: nur mit dem Code greift sie, dann ist die Antwort True.
    mit_code = {"discount_type": "promotion", "promo_codes": ["SOMMER26"]}
    q = _mit_aktion(mit_code, promo_code="sommer26")
    assert _rabatt(q) == -30.0
    assert q.promo_code_applied is True
    q = _mit_aktion(mit_code, promo_code="WINTER")
    assert _rabatt(q) == 0.0
    assert q.promo_code_applied is False
    # Automatische Aktion (ohne Codes) + falscher Code: Rabatt ja, Code nein.
    q = _mit_aktion({"discount_type": "promotion"}, promo_code="WINTER")
    assert _rabatt(q) == -30.0
    assert q.promo_code_applied is False


def test_eingelöster_code_verdrängt_automatische_aktionen() -> None:
    """Code-Vorrang (Branchenstandard, wörtlich): „Gibt ein Gast einen Aktionscode
    an […], werden Aktionen ohne Code nicht angewendet. Stattdessen verwendet das
    System den Wert der Aktion, die dem angegebenen Code zugeordnet ist."

    Der eingelöste Code gewinnt also auch dann, wenn eine automatische Aktion
    MEHR gebracht hätte — nicht der höchste Rabatt, sondern die Entscheidung des
    Gastes zählt, sobald sein Code gültig ist."""
    r = _resolver(
        base=100.0,
        discounts=[
            {"discount_type": "promotion", "discount_kind": "percent",
             "discount_bps": 2000, "name": {"de": "Juni automatisch"}},
            {"discount_type": "promotion", "discount_kind": "percent",
             "discount_bps": 500, "promo_codes": ["SOMMER26"],
             "name": {"de": "Mit Code"}},
        ],
    )

    def _q(code: str | None) -> object:
        return r.quote(
            QuoteRequest(
                property_id="p",
                check_in=date(2026, 7, 1),
                check_out=date(2026, 7, 4),
                guests=2,
                as_of=date(2026, 6, 1),
                promo_code=code,
            )
        )

    # Ohne Code: die automatische Aktion (20 % von 300).
    q = _q(None)
    assert _rabatt(q) == -60.0
    assert q.promo_code_applied is False
    # Mit gültigem Code: 5 % — obwohl 20 % möglich gewesen wären.
    q = _q("sommer26")
    assert _rabatt(q) == -15.0
    assert q.promo_code_applied is True
    # UNGÜLTIGER Code: nichts wird verdrängt, die automatische Aktion bleibt.
    q = _q("QUATSCH")
    assert _rabatt(q) == -60.0
    assert q.promo_code_applied is False


def test_tierbedingung_deckt_alle_pet_arten() -> None:
    """`PET_FEE_TYPES` muss deckungsgleich mit der Kategorie „pet" sein.

    Die Menge liegt bewusst als Kopie in `pricing/tierbedingung.py`, weil die
    öffentliche API den Resolver spiegelt, aber kein `features/properties` hat
    (siehe Modul-Kopf dort). Eine Kopie ohne Prüfung driftet: eine neue
    Tier-Gebührenart in `FEE_TYPE_CATEGORY` würde stillschweigend jedem Gast
    berechnet — genau der Bug, den diese Bedingung schließt. Dieser Test ist die
    Klammer, nicht die Disziplin.
    """
    from src.features.pricing.tierbedingung import PET_FEE_TYPES
    from src.features.properties.gebuehren import (
        FEE_TYPE_ALTBESTAND,
        FEE_TYPE_CATEGORY,
        PET_BASIS_CATEGORIES,
    )

    aus_katalog = {
        art
        for art, kategorie in {**FEE_TYPE_CATEGORY, **FEE_TYPE_ALTBESTAND}.items()
        if kategorie in PET_BASIS_CATEGORIES
    }
    assert PET_FEE_TYPES == aus_katalog


def test_quote_optionale_gebuehr_nur_bei_wahl() -> None:
    """Eine als optional markierte Gebühr wird ohne die Wahl des Gastes NICHT
    berechnet — das ist die Zusage der Oberfläche („Gast kann ab-/zuwählen").

    Vorher las der Resolver das Flag überhaupt nicht: die Gebühr lief jedem Gast
    mit, der sie damit gar nicht abwählen KONNTE. Nur der Channel-Manager
    beachtete es (optionale Gebühren gehen an kein Portal) — im Preis war es
    eine Attrappe.
    """
    cfg = {
        "fees": [
            {"id": "f-opt", "name": "Endreinigung", "amount": 80,
             "basis": "per_stay", "feeType": "cleaning_fee", "optional": True},
            {"id": "f-pflicht", "name": "Kurtaxe-Service", "amount": 20,
             "basis": "per_stay", "feeType": "resort"},
        ],
    }
    r = _resolver(base=100.0, config=cfg)

    def labels(**kw: object) -> dict[str, float]:
        q = r.quote(
            QuoteRequest(
                property_id="p",
                check_in=date(2026, 7, 1),
                check_out=date(2026, 7, 4),
                guests=2,
                **kw,  # type: ignore[arg-type]
            )
        )
        return {line.label: line.amount for line in q.lines}

    ohne = labels()
    assert "Endreinigung" not in ohne
    # Die Gegenprobe: die Pflichtgebühr bleibt unberührt.
    assert ohne["Kurtaxe-Service"] == 20.0

    assert labels(fees=["f-opt"])["Endreinigung"] == 80.0
    # Eine fremde ID wählt nichts aus (kein „irgendwas trifft zu").
    assert "Endreinigung" not in labels(fees=["f-fremd"])


def test_quote_optionale_gebuehr_ohne_id_entfaellt() -> None:
    """Optional ohne `id` ist unwählbar — die Wahl läuft über die ID.

    Fail-closed in Richtung des Gastes: eine Gebühr, die er nicht anwählen kann,
    darf ihm nicht berechnet werden. `normalize_fees` vergibt jeder Gebühr eine
    ID, das trifft also nur von Hand gebauten Bestand.
    """
    cfg = {"fees": [{"name": "Ohne ID", "amount": 50, "basis": "per_stay",
                     "feeType": "cleaning_fee", "optional": True}]}
    r = _resolver(base=100.0, config=cfg)
    q = r.quote(
        QuoteRequest(
            property_id="p",
            check_in=date(2026, 7, 1),
            check_out=date(2026, 7, 4),
            guests=2,
        )
    )
    assert "Ohne ID" not in {line.label for line in q.lines}


def test_quote_bezeichnungen_in_der_sprache_des_gastes() -> None:
    """Gebühr, Steuer und Zusatzleistung tragen den Namen in `locale`.

    Vorher war Deutsch fest verdrahtet (`_pick_locale_text` bevorzugte "de",
    die Addons setzten `locale = "de"`, Gebühren lasen `names` gar nicht) — in
    einem Produkt für 27 Länder eine Falschaussage auf der Rechnung des Gastes
    und kein technischer Default (Wurzel 4).
    """
    cfg = {
        "fees": [
            {"id": "f1", "name": "Reinigung", "amount": 80, "basis": "per_stay",
             "feeType": "cleaning_fee",
             "names": {"de": "Reinigung", "da": "Rengøring", "en": "Cleaning"}},
        ],
        "taxes": [
            {"kind": "local", "mode": "amount", "value": 5,
             "basis": "per_guest_night", "includedInPrice": False,
             "name": "Kurtaxe",
             "names": {"de": "Kurtaxe", "da": "Turistskat", "en": "City tax"}},
        ],
    }
    r = _resolver(base=100.0, config=cfg)

    def labels(locale: str) -> set[str]:
        q = r.quote(
            QuoteRequest(
                property_id="p",
                check_in=date(2026, 7, 1),
                check_out=date(2026, 7, 4),
                guests=2,
                locale=locale,
            )
        )
        return {line.label for line in q.lines}

    assert {"Rengøring", "Turistskat"} <= labels("da")
    assert {"Cleaning", "City tax"} <= labels("en")
    # Regionsvariante wird auf die Basissprache gekappt.
    assert "Rengøring" in labels("da-DK")
    # Sprache ohne Übersetzung fällt auf ENGLISCH zurück, nicht auf Deutsch.
    assert {"Cleaning", "City tax"} <= labels("fr")
    # Ein unbekannter Code ebenso — kein Absturz, kein leeres Label.
    assert {"Cleaning", "City tax"} <= labels("zh")


# --------------------------------------------------------------------------
# Schreibweg der Einstellungen: ein Feld, das DpSettingsUpdate nicht kennt,
# wird von Pydantic STILL verworfen — `update` speichert dann nichts und meldet
# trotzdem Erfolg. Genau so ging am 04.09.2026 ein angenommener KI-Vorschlag
# verloren: die Entscheidungshistorie sagte "angenommen", dp_settings.
# occupancy_steps blieb []. Die Engine las das Feld längst, nur schreiben
# konnte es niemand.
# --------------------------------------------------------------------------

_LEITER = [
    {"ab_pct": 60, "adjust_pct": 4},
    {"ab_pct": 80, "adjust_pct": 10},
    {"ab_pct": 90, "adjust_pct": 15},
]


def test_dp_update_kennt_occupancy_steps() -> None:
    """Der Kern des Fehlers: das Feld muss den Patch überleben."""
    from src.features.pricing.schemas import DpSettingsUpdate

    patch = DpSettingsUpdate(occupancy_steps=_LEITER).model_dump(
        mode="json", exclude_none=True
    )
    assert patch["occupancy_steps"] == _LEITER


def test_dp_update_alle_berater_felder_kommen_an() -> None:
    """Jedes Feld, das der KI-Berater vorschlagen kann, muss schreibbar sein.

    Der Berater erzeugt seine Vorschläge über `feld=`-Namen; steht einer davon
    nicht in DpSettingsUpdate, ist "Übernehmen" eine Attrappe. Der Test liest
    die Namen aus dem Berater-Modul, damit ein neues Feld ihn bricht statt
    stillschweigend ins Leere zu laufen.
    """
    import re
    from pathlib import Path

    from src.features.pricing.schemas import DpSettingsUpdate

    quelle = (
        Path(__file__).resolve().parents[1] / "ki_berater.py"
    ).read_text(encoding="utf-8")
    felder = set(re.findall(r'feld="([a-z_]+)"', quelle))
    assert felder, "Keine feld=-Namen im Berater gefunden — Regex prüfen."
    unbekannt = felder - set(DpSettingsUpdate.model_fields)
    assert not unbekannt, (
        f"Der Berater schlägt Felder vor, die DpSettingsUpdate nicht kennt: "
        f"{sorted(unbekannt)} — 'Übernehmen' würde nichts speichern."
    )


def test_dp_update_occupancy_steps_grenzen_wie_db_check() -> None:
    """Pydantic muss dieselben Grenzen ziehen wie dp_occupancy_steps_gueltig
    (0550) — sonst wirft die DATENBANK einen 500 auf einen Wert, den das
    Schema durchgelassen hat."""
    from src.features.pricing.schemas import DpSettingsUpdate

    for schlecht in (
        [{"ab_pct": 120, "adjust_pct": 5}],
        [{"ab_pct": -1, "adjust_pct": 5}],
        [{"ab_pct": 50, "adjust_pct": 400}],
        [{"ab_pct": 50, "adjust_pct": -95}],
        [{"ab_pct": 50}],
    ):
        with pytest.raises(ValidationError):
            DpSettingsUpdate(occupancy_steps=schlecht)
    # Mehr als 20 Stufen lehnt der DB-CHECK ab.
    with pytest.raises(ValidationError):
        DpSettingsUpdate(
            occupancy_steps=[{"ab_pct": i, "adjust_pct": 1} for i in range(21)]
        )


def test_dp_update_abschlag_stufe_erlaubt() -> None:
    """Negative Anpassung ist ausdrücklich vorgesehen (schwache Zeiträume)."""
    from src.features.pricing.schemas import DpSettingsUpdate

    u = DpSettingsUpdate(occupancy_steps=[{"ab_pct": 30, "adjust_pct": -10}])
    assert u.occupancy_steps is not None
    assert u.occupancy_steps[0].adjust_pct == -10


def test_dp_update_leerer_patch_wird_abgewiesen() -> None:
    """Ein Patch ohne Felder speichert nichts und darf nicht Erfolg melden."""
    from unittest.mock import MagicMock

    from src.features.pricing.schemas import DpSettingsUpdate
    from src.features.pricing.settings_service import DpSettingsService

    svc = DpSettingsService(service_client=MagicMock())
    svc._require_own_property = lambda *a, **k: None  # noqa: SLF001
    ctx = MagicMock(tenant_id="t1", role="admin")
    with pytest.raises(PricingError) as exc:
        svc.update(ctx, "p1", DpSettingsUpdate())
    assert exc.value.status_code == 422


def test_dp_response_gibt_occupancy_steps_zurueck() -> None:
    """Rückweg: was gespeichert ist, muss das Frontend auch sehen — sonst
    zeigt die Oberfläche eine leere Leiter über einer aktiven Regel."""
    from src.features.pricing.settings_service import _DEFAULTS, DpSettingsService

    resp = DpSettingsService._to_response(  # noqa: SLF001
        "p1", {**_DEFAULTS, "occupancy_steps": _LEITER}
    )
    assert [s.model_dump() for s in resp.occupancy_steps] == _LEITER


def test_berater_mindestpreis_liest_zukunft_nicht_vergangenheit() -> None:
    """`dynamic_prices` ist der berechnete VORRAT (heute → Zukunft), keine
    Historie. Die Mindestpreis-Prüfung lief ursprünglich über denselben
    Rückblick wie die Auslastungsprüfung und fand deshalb ausnahmslos null
    Zeilen — sie konnte nie einen Vorschlag machen, und das stille `return
    None` verbarg es. Der Test hält den Zeitraum fest.
    """
    from datetime import date as _date
    from unittest.mock import MagicMock

    from src.features.pricing.ki_berater import DpKiBerater

    gefragt: dict[str, str] = {}

    class _Abfrage:
        def select(self, *_a: object, **_k: object) -> "_Abfrage":
            return self

        def eq(self, *_a: object, **_k: object) -> "_Abfrage":
            return self

        def gte(self, _spalte: str, wert: str) -> "_Abfrage":
            gefragt["ab"] = wert
            return self

        def lt(self, _spalte: str, wert: str) -> "_Abfrage":
            gefragt["bis"] = wert
            return self

        def execute(self) -> MagicMock:
            return MagicMock(data=[])

    db = MagicMock()
    db.table.return_value = _Abfrage()
    berater = DpKiBerater(db)

    von, bis = _date(2025, 9, 4), _date(2026, 9, 4)
    berater._spanne_pruefen("p1", {}, von, bis)  # noqa: SLF001

    # Gesucht wird AB dem Stichtag (heute), nicht davor.
    assert gefragt["ab"] == bis.isoformat(), (
        f"Mindestpreis-Prüfung liest ab {gefragt['ab']} — muss ab {bis} "
        "(heute) in die Zukunft lesen, dort stehen die berechneten Preise."
    )
    assert gefragt["bis"] > gefragt["ab"]


def test_berater_prueft_immer_alle_regeln_mit_grund() -> None:
    """Jede Prüfung muss ein Ergebnis MIT Grund liefern — auch wenn sie nichts
    vorschlägt. Ein stilles None ist im Betrieb nicht von einem Defekt zu
    unterscheiden ("keine Vorschläge" nannte zwei mögliche Ursachen und keine
    Antwort)."""
    from src.features.pricing.ki_berater import DpKiBerater, Pruefung

    # Leere Einstellungen, keine Nächte: jede Prüfung muss dennoch berichten.
    berater = DpKiBerater(None)
    ergebnis = berater._stufen_pruefen({}, set(), 5)  # noqa: SLF001
    assert isinstance(ergebnis, Pruefung)
    assert ergebnis.ergebnis == "zu_wenig_daten"
    assert ergebnis.grund

    gepflegt = berater._stufen_pruefen(  # noqa: SLF001
        {"occupancy_steps": [{"ab_pct": 80, "adjust_pct": 10}]}, set(), 400
    )
    assert isinstance(gepflegt, Pruefung)
    assert gepflegt.ergebnis == "passt"
    assert "gepflegt" in gepflegt.grund


# --------------------------------------------------------------------------
# Tagesmodus + Freigabe (0554)
# --------------------------------------------------------------------------


def test_tagesmodus_zeitraum_hat_obergrenze() -> None:
    """Wurzel 8: ein unbegrenzter Datumsbereich ist ein Angriff — und ein
    vertippter Endtermin würde hunderttausende Zeilen schreiben."""
    from datetime import date as _date

    from src.features.pricing.tagesmodus_service import TagesmodusService

    svc = TagesmodusService.__new__(TagesmodusService)
    # 400 Tage sind erlaubt, 401 nicht.
    assert len(svc._zeitraum_pruefen(  # noqa: SLF001
        _date(2026, 1, 1), _date(2026, 1, 1) + timedelta(days=399)
    )) == 400
    with pytest.raises(PricingError) as exc:
        svc._zeitraum_pruefen(  # noqa: SLF001
            _date(2026, 1, 1), _date(2026, 1, 1) + timedelta(days=400)
        )
    assert exc.value.status_code == 422


def test_tagesmodus_ende_vor_start_wird_abgewiesen() -> None:
    from datetime import date as _date

    from src.features.pricing.tagesmodus_service import TagesmodusService

    svc = TagesmodusService.__new__(TagesmodusService)
    with pytest.raises(PricingError):
        svc._zeitraum_pruefen(_date(2026, 5, 10), _date(2026, 5, 1))  # noqa: SLF001


def test_tagesmodus_wechsel_von_manuell_loest_override() -> None:
    """Wurzel 1 — der Gegenzustand: wer von 'manuell' zurück auf 'dynamisch'
    stellt, muss den festen Preis loswerden. Bliebe er in price_overrides
    stehen, schlüge er weiterhin die Automatik, und der Nutzer sähe seine
    Wahl wirkungslos."""
    from datetime import date as _date
    from unittest.mock import MagicMock

    from src.features.pricing.tagesmodus_service import TagesmodusService

    geloescht: dict[str, object] = {}

    class _Tabelle:
        def __init__(self, name: str) -> None:
            self.name = name

        def select(self, *_a: object, **_k: object) -> "_Tabelle":
            return self

        def eq(self, spalte: str, wert: object) -> "_Tabelle":
            if self.name == "price_overrides":
                geloescht.setdefault("eq", []).append((spalte, wert))  # type: ignore[union-attr]
            return self

        def in_(self, _spalte: str, werte: list[str]) -> "_Tabelle":
            if self.name == "price_overrides":
                geloescht["tage"] = werte
            return self

        def gte(self, *_a: object) -> "_Tabelle":
            return self

        def lte(self, *_a: object) -> "_Tabelle":
            return self

        def limit(self, *_a: object) -> "_Tabelle":
            return self

        def delete(self) -> "_Tabelle":
            if self.name == "price_overrides":
                geloescht["aufgerufen"] = True
            return self

        def upsert(self, *_a: object, **_k: object) -> "_Tabelle":
            return self

        def execute(self) -> MagicMock:
            if self.name == "properties":
                return MagicMock(data=[{"id": "p1"}])
            if self.name == "dp_day_modes":
                # Zwei Tage stehen aktuell auf 'manuell'.
                return MagicMock(
                    data=[{"date": "2026-06-01"}, {"date": "2026-06-02"}]
                )
            return MagicMock(data=[])

    db = MagicMock()
    db.table.side_effect = _Tabelle
    svc = TagesmodusService(db)
    ctx = MagicMock(tenant_id="t1", role="admin")

    svc.setzen(
        ctx, "p1",
        von=_date(2026, 6, 1), bis=_date(2026, 6, 2), modus="dynamisch",
    )

    assert geloescht.get("aufgerufen"), (
        "Wechsel auf 'dynamisch' hat den festen Preis NICHT gelöst — er würde "
        "die Automatik weiter überstimmen."
    )
    assert geloescht.get("tage") == ["2026-06-01", "2026-06-02"]


def test_tagesmodus_anpassung_braucht_prozent() -> None:
    """Eine Anpassung ohne Wert wäre eine Regel, die stillschweigend nichts
    tut — genau die Klasse Fehler, die 'occupancy_steps' hatte."""
    from datetime import date as _date
    from unittest.mock import MagicMock

    from src.features.pricing.tagesmodus_service import TagesmodusService

    svc = TagesmodusService(MagicMock())
    svc._require_own_property = lambda *a, **k: None  # noqa: SLF001
    with pytest.raises(PricingError) as exc:
        svc.setzen(
            MagicMock(tenant_id="t1"), "p1",
            von=_date(2026, 6, 1), bis=_date(2026, 6, 1), modus="anpassung",
        )
    assert exc.value.status_code == 422


def test_tagesmodus_grenzen_wie_db_check() -> None:
    """Deckungsgleich mit dem CHECK aus 0554 (-90 bis 300)."""
    from datetime import date as _date
    from unittest.mock import MagicMock

    from src.features.pricing.tagesmodus_service import TagesmodusService

    svc = TagesmodusService(MagicMock())
    svc._require_own_property = lambda *a, **k: None  # noqa: SLF001
    for schlecht in (-91.0, 301.0):
        with pytest.raises(PricingError):
            svc.setzen(
                MagicMock(tenant_id="t1"), "p1",
                von=_date(2026, 6, 1), bis=_date(2026, 6, 1),
                modus="anpassung", adjust_pct=schlecht,
            )


def test_dp_update_kennt_freigabe_noetig() -> None:
    """Der Schalter muss schreibbar sein — sonst dieselbe stille Attrappe wie
    bei occupancy_steps (Feld fehlt im Schema, Pydantic verwirft es, 200)."""
    from src.features.pricing.schemas import DpSettingsUpdate

    patch = DpSettingsUpdate(freigabe_noetig=True).model_dump(
        mode="json", exclude_none=True
    )
    assert patch == {"freigabe_noetig": True}


def test_dp_felder_ueberall_bekannt() -> None:
    """Jedes Feld der Antwort muss auch die Engine-Dataclass kennen.

    DREIMAL an einem Tag dieselbe Klasse: ein Feld wird in der Migration
    angelegt, im Pydantic-Schema ergänzt — und die Engine-Dataclass bzw. der
    Schreibweg vergessen. Die Folgen waren jeweils still oder spät:
      * occupancy_steps  — „Übernehmen" meldete Erfolg und speicherte nichts
      * freigabe_noetig  — die Objektliste warf 500 (AttributeError)
    Der Test vergleicht die Feldmengen, statt auf den nächsten Zufallsfund zu
    warten.
    """
    from src.features.pricing.engine import DpSettings as EngineSettings
    from src.features.pricing.schemas import DpSettingsResponse, DpSettingsUpdate

    engine_felder = {f.name for f in dataclasses.fields(EngineSettings)}
    # Felder, die bewusst NICHT in der Rechen-Dataclass liegen:
    #   property_id          — beschreibt das Objekt, nicht die Rechenregeln
    #   market_key/comp_refs — Adressierung der Markt-QUELLE, nicht Teil der
    #                          Rechnung; der Recompute liest sie aus der
    #                          Rohzeile (siehe recompute._settings_row)
    #   freigabe_ab_tagen    — steuert den PUSH (freigabe.py), nicht den Preis
    #   rate_plan_id         — steuert, WOHIN gepusht wird (recompute liest die
    #                          Rohzeile), nicht die Rechnung
    #   quellmaerkte         — adressiert die Feiertags-QUELLE (Laender), die
    #                          Engine bekommt daraus nur ist_feiertag/ist_ferien
    #   saison_verfuegbar    — nur LESEND: „hat das Objekt einen Saisonkalender"
    #                          (0565), abgeleitet aus dem Kalender, keine Regel
    nur_antwort = {
        "property_id", "market_key", "comp_refs",
        "freigabe_ab_tagen", "rate_plan_id", "quellmaerkte", "saison_verfuegbar",
    }
    fehlend = set(DpSettingsResponse.model_fields) - engine_felder - nur_antwort
    assert not fehlend, (
        f"Diese Felder kennt die Engine-Dataclass nicht: {sorted(fehlend)} — "
        "die Übersicht liest sie von dort und wirft sonst AttributeError."
    )

    # Und umgekehrt: alles Schreibbare muss auch lesbar zurückkommen.
    nicht_lesbar = set(DpSettingsUpdate.model_fields) - set(
        DpSettingsResponse.model_fields
    )
    assert not nicht_lesbar, (
        f"Schreibbar, aber nicht lesbar: {sorted(nicht_lesbar)} — gespeicherte "
        "Werte wären in der Oberfläche unsichtbar."
    )


def test_dp_defaults_decken_alle_antwortfelder() -> None:
    """_DEFAULTS muss jedes Antwortfeld kennen — sonst steht bei einem Objekt
    ohne dp_settings-Zeile ein Feld auf dem Pydantic-Default statt auf dem
    fachlich gewollten Wert."""
    from src.features.pricing.schemas import DpSettingsResponse
    from src.features.pricing.settings_service import _DEFAULTS

    ohne = (
        set(DpSettingsResponse.model_fields)
        - set(_DEFAULTS)
        # saison_verfuegbar ist kein gespeicherter Wert, sondern wird je Abruf
        # aus dem Saisonkalender abgeleitet (0565).
        - {"property_id", "saison_verfuegbar"}
    )
    assert not ohne, f"Kein Default hinterlegt für: {sorted(ohne)}"


def test_dp_saison_regel_ohne_kalender_wird_abgewiesen(monkeypatch) -> None:  # noqa: ANN001
    """0565: ohne Saisonkalender ist „Mindestpreis aus dem Saisonkalender"
    nicht waehlbar — der Server sagt 422, statt eine Attrappe zu speichern."""
    from unittest.mock import MagicMock

    from src.features.pricing import settings_service as ss
    from src.features.pricing.schemas import DpSettingsUpdate

    svc = ss.DpSettingsService(service_client=MagicMock())
    svc._require_own_property = lambda *a, **k: None  # noqa: SLF001
    monkeypatch.setattr(ss, "saison_vorhanden", lambda *_a, **_k: False)
    ctx = MagicMock(tenant_id="t1", role="admin")
    with pytest.raises(PricingError) as exc:
        svc.update(ctx, "p1", DpSettingsUpdate(saison_mindestpreis=True))
    assert exc.value.status_code == 422
    assert "Saisonkalender" in exc.value.message
