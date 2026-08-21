"""Tests für die ÖFFENTLICHE Preisliste (`GET /subscriptions/public/pricing`).

Die Marketing-Preisseite ist nicht eingeloggt und liest ihre Beträge hier.
Geprüft wird deshalb dreierlei:

1. **Kein Login nötig** — der Endpunkt darf nicht am Auth-Guard hängen, sonst
   zeigt die Preisseite keine Preise (und jemand schreibt sie hart hinein).
2. **Der Cache greift** — ohne ihn löst jeder Seitenaufruf sechs Stripe-
   Abfragen aus (Wurzel 8); ein FEHLER darf dagegen nicht zwischengehalten
   werden, sonst bleibt die Seite zehn Minuten leer, obwohl Stripe wieder
   antwortet.
3. **Der beworbene Marktplatz-Satz stimmt mit dem überein, den das System
   abrechnet** — `MARKETPLACE_FEE_BPS_STANDARD` gegen den Spalten-Default von
   `tenants.platform_fee_bps` (Migration 0180). Genau hier entstünde sonst die
   Falschaussage, die niemand als Bug erkennt: eine Preisseite, die 8 % nennt,
   während die Abrechnung längst mit einem anderen Satz läuft.

Die zweite Hälfte derselben Kette prüft `scripts/i18n/provisionssaetze-pruefen.mjs`:
dass der Satz im FRONTEND nur einmal existiert. Hier stimmt die Zahl, dort ist
sie nicht doppelt — beides ist nötig. Ein grüner Test hier hat nicht verhindert,
dass „0,5 %"/„8 %"/„250 €" parallel im Fließtext von 48 Sprachdateien standen.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.features.subscriptions import preisliste as preisliste_modul
from src.features.subscriptions.errors import SubscriptionsError
from src.features.subscriptions.schemas import (
    MARKETPLACE_FEE_BPS_STANDARD,
    PriceTier,
    PricingResponse,
)
from src.features.subscriptions.service import SubscriptionsService
from src.main import create_app

client = TestClient(create_app())

_MIGRATION = (
    Path(__file__).resolve().parents[6]
    / "supabase/migrations/0180_tenant_account_type.sql"
)


@pytest.fixture(autouse=True)
def _leerer_cache() -> None:
    """Jeder Test startet mit kaltem Cache — sonst hängt das Ergebnis davon ab,
    welcher Test zuvor lief."""
    preisliste_modul._PUBLIC_PRICING_CACHE.clear()  # noqa: SLF001


def _preisliste() -> PricingResponse:
    return PricingResponse(
        currency="EUR",
        grundtarif_tiers=[
            PriceTier(up_to=1, flat_amount=1990),
            PriceTier(up_to=None, unit_amount=600),
        ],
        modules=[],
    )


def test_marktplatz_satz_deckt_sich_mit_der_migration() -> None:
    """Der öffentlich beworbene Satz MUSS der DB-Default sein (Wurzel 4)."""
    sql = _MIGRATION.read_text(encoding="utf-8")
    treffer = re.search(r"platform_fee_bps\s+integer\s+not\s+null\s+default\s+(\d+)", sql)
    assert treffer, "Spalten-Default von platform_fee_bps nicht in 0180 gefunden"
    assert int(treffer.group(1)) == MARKETPLACE_FEE_BPS_STANDARD


def test_public_pricing_ohne_login(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ohne Token: 200 mit Beträgen und Konditionen — nicht 401."""
    monkeypatch.setattr(
        SubscriptionsService, "get_pricing", lambda _self: _preisliste()
    )
    res = client.get("/api/v1/subscriptions/public/pricing")
    assert res.status_code == 200
    body = res.json()
    assert body["currency"] == "EUR"
    assert body["grundtarif_tiers"][0]["flat_amount"] == 1990
    # Die Konditionen, die die Preisseite nennen muss — keine davon darf im
    # Frontend hardcodiert sein.
    assert body["commission_marketplace_percent"] == 8.0
    assert body["commission_external_percent"] == 0.5
    assert body["commission_external_cap_amount"] == 250.0
    assert body["commission_external_cap_currency"] == "EUR"


def test_public_pricing_liefert_keine_tenant_daten(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Öffentlich heißt: nur unsere Preisliste, nichts Tenant-Bezogenes."""
    monkeypatch.setattr(
        SubscriptionsService, "get_pricing", lambda _self: _preisliste()
    )
    body = client.get("/api/v1/subscriptions/public/pricing").json()
    verboten = {"tenant_id", "stripe_customer_id", "property_count", "status"}
    assert verboten.isdisjoint(body.keys())


def test_cache_buendelt_die_stripe_abfragen(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Zweiter Aufruf innerhalb der TTL fragt Stripe NICHT erneut."""
    aufrufe = {"n": 0}

    def _zaehlend(_self: SubscriptionsService) -> PricingResponse:
        aufrufe["n"] += 1
        return _preisliste()

    monkeypatch.setattr(SubscriptionsService, "get_pricing", _zaehlend)
    svc = SubscriptionsService()
    erste = svc.get_public_pricing()
    zweite = svc.get_public_pricing()
    assert aufrufe["n"] == 1
    assert erste == zweite


def test_fehler_wird_nicht_zwischengehalten(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Nach einem Stripe-Ausfall liefert der nächste Aufruf wieder Preise —
    ein gecachter Fehler hätte die Seite zehn Minuten leer gelassen."""
    zustand = {"kaputt": True}

    def _mal_so_mal_so(_self: SubscriptionsService) -> PricingResponse:
        if zustand["kaputt"]:
            raise SubscriptionsError("Stripe weg", status_code=503)
        return _preisliste()

    monkeypatch.setattr(SubscriptionsService, "get_pricing", _mal_so_mal_so)
    svc = SubscriptionsService()
    with pytest.raises(SubscriptionsError):
        svc.get_public_pricing()
    zustand["kaputt"] = False
    assert svc.get_public_pricing().currency == "EUR"


def test_endpunkt_meldet_stripe_ausfall_durch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fehlt die Preisliste, kommt 503 — kein erfundener Ersatzpreis (Wurzel 4)."""

    def _kaputt(_self: SubscriptionsService) -> PricingResponse:
        raise SubscriptionsError("Grundtarif-Preis nicht gefunden", status_code=503)

    monkeypatch.setattr(SubscriptionsService, "get_pricing", _kaputt)
    res = client.get("/api/v1/subscriptions/public/pricing")
    assert res.status_code == 503
