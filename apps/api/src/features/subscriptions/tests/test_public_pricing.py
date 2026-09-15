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
        SubscriptionsService, "get_pricing", lambda _self, _waehrung=None: _preisliste()
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
    assert body["commission_external_cap_amount"] == 50.0
    assert body["commission_external_cap_currency"] == "EUR"


def test_public_pricing_liefert_keine_tenant_daten(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Öffentlich heißt: nur unsere Preisliste, nichts Tenant-Bezogenes."""
    monkeypatch.setattr(
        SubscriptionsService, "get_pricing", lambda _self, _waehrung=None: _preisliste()
    )
    body = client.get("/api/v1/subscriptions/public/pricing").json()
    verboten = {"tenant_id", "stripe_customer_id", "property_count", "status"}
    assert verboten.isdisjoint(body.keys())


def test_cache_buendelt_die_stripe_abfragen(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Zweiter Aufruf innerhalb der TTL fragt Stripe NICHT erneut."""
    aufrufe = {"n": 0}

    def _zaehlend(
        _self: SubscriptionsService, _waehrung: str | None = None
    ) -> PricingResponse:
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

    def _mal_so_mal_so(
        _self: SubscriptionsService, _waehrung: str | None = None
    ) -> PricingResponse:
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

    def _kaputt(
        _self: SubscriptionsService, _waehrung: str | None = None
    ) -> PricingResponse:
        raise SubscriptionsError("Grundtarif-Preis nicht gefunden", status_code=503)

    monkeypatch.setattr(SubscriptionsService, "get_pricing", _kaputt)
    res = client.get("/api/v1/subscriptions/public/pricing")
    assert res.status_code == 503


# --- Anzeigewährung ------------------------------------------------------
# Die Marketing-Seite fragt die Währung ihrer Sprache an (marketing/lib/
# anzeigewaehrung.ts). Geprüft wird hier NICHT, ob Stripe eine Währung führt —
# das entscheidet Stripe — sondern dass der Endpunkt den Wunsch durchreicht,
# unsinnigen Input abweist und je Währung getrennt zwischenhält.


def _preisliste_in(waehrung: str) -> PricingResponse:
    """Preisliste, die so tut, als hätte Stripe diese Währung."""
    return PricingResponse(
        currency=waehrung,
        grundtarif_tiers=[
            PriceTier(up_to=1, flat_amount=14900),
            PriceTier(up_to=None, unit_amount=4500),
        ],
        modules=[],
    )


def test_waehrungswunsch_wird_durchgereicht(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`?currency=DKK` erreicht den Service — sonst wäre der Parameter Zierde."""
    gesehen: list[str | None] = []

    def _merkend(
        _self: SubscriptionsService, waehrung: str | None = None
    ) -> PricingResponse:
        gesehen.append(waehrung)
        return _preisliste_in(waehrung or "EUR")

    monkeypatch.setattr(SubscriptionsService, "get_pricing", _merkend)
    res = client.get("/api/v1/subscriptions/public/pricing?currency=DKK")
    assert res.status_code == 200
    assert gesehen == ["DKK"]
    assert res.json()["currency"] == "DKK"


def test_kleinschreibung_wird_normalisiert(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`dkk` und `DKK` sind dieselbe Währung — sonst zwei Cache-Einträge."""
    gesehen: list[str | None] = []

    def _merkend(
        _self: SubscriptionsService, waehrung: str | None = None
    ) -> PricingResponse:
        gesehen.append(waehrung)
        return _preisliste_in(waehrung or "EUR")

    monkeypatch.setattr(SubscriptionsService, "get_pricing", _merkend)
    svc = SubscriptionsService()
    svc.get_public_pricing("dkk")
    svc.get_public_pricing("DKK")
    assert gesehen == ["DKK"]  # der zweite Aufruf kam aus dem Cache


def test_cache_trennt_die_waehrungen(monkeypatch: pytest.MonkeyPatch) -> None:
    """Der zweite Besucher mit anderer Sprache bekommt SEINE Währung.

    Mit einem Cache über alle Währungen hätte der erste Aufruf entschieden, was
    zehn Minuten lang alle sehen — der Fehler, den man erst bemerkt, wenn ein
    dänischer Kunde nach Euro-Preisen fragt.
    """
    aufrufe: list[str | None] = []

    def _je_waehrung(
        _self: SubscriptionsService, waehrung: str | None = None
    ) -> PricingResponse:
        aufrufe.append(waehrung)
        return _preisliste_in(waehrung or "EUR")

    monkeypatch.setattr(SubscriptionsService, "get_pricing", _je_waehrung)
    svc = SubscriptionsService()
    assert svc.get_public_pricing("DKK").currency == "DKK"
    assert svc.get_public_pricing("SEK").currency == "SEK"
    assert svc.get_public_pricing().currency == "EUR"
    # Drei verschiedene Währungen = drei Stripe-Runden, nicht eine geteilte.
    assert aufrufe == ["DKK", "SEK", None]
    # Und jede davon liegt danach im Cache.
    assert svc.get_public_pricing("DKK").currency == "DKK"
    assert aufrufe == ["DKK", "SEK", None]


@pytest.mark.parametrize("wert", ["EU", "EURO", "1234", "€", "e u r", "../etc"])
def test_unsinnige_waehrung_endet_in_422(wert: str) -> None:
    """Angreiferkontrollierter Input darf keinen 500 werfen (Wurzel 5).

    Der Wert landet serverseitig in einem Stripe-`expand`-Pfad — deshalb kommt
    hier nichts durch, was nicht genau drei Buchstaben ist (Wurzel 8).
    """
    res = client.get("/api/v1/subscriptions/public/pricing", params={"currency": wert})
    assert res.status_code == 422


def test_leere_waehrung_gilt_als_keine(monkeypatch: pytest.MonkeyPatch) -> None:
    """`?currency=` ist kein Fehler, sondern „keine Angabe" — die Antwort kommt
    in der Standardwährung."""
    monkeypatch.setattr(
        preisliste_modul,
        "waehrung_pruefen",
        preisliste_modul.waehrung_pruefen,
    )
    assert preisliste_modul.waehrung_pruefen("") is None
    assert preisliste_modul.waehrung_pruefen("   ") is None
    assert preisliste_modul.waehrung_pruefen(None) is None
    assert preisliste_modul.waehrung_pruefen(" dkk ") == "DKK"


def test_provisionsdeckel_bleibt_euro(monkeypatch: pytest.MonkeyPatch) -> None:
    """Auch in einer DKK-Antwort steht der Deckel in EUR.

    Er ist keine Preisangabe, sondern eine vertragliche Grenze, die die
    Abrechnung in EUR rechnet (`provisionsdeckel.py`). Ihn mitzuwandeln hieße,
    eine Zahl zu nennen, die so nirgends gilt (Wurzel 4). Dieser Test ist die
    Bremse gegen die naheliegende „Verbesserung", ihn mitzuübersetzen.
    """
    monkeypatch.setattr(
        SubscriptionsService,
        "get_pricing",
        lambda _self, waehrung=None: _preisliste_in(waehrung or "EUR"),
    )
    body = client.get("/api/v1/subscriptions/public/pricing?currency=DKK").json()
    assert body["currency"] == "DKK"
    assert body["commission_external_cap_currency"] == "EUR"
    assert body["commission_external_cap_amount"] == 50.0


def test_stripeobject_kippt_die_preisliste_nicht() -> None:
    """`currency_options` von Stripe ist KEIN dict — und darf nichts umbringen.

    Live passiert am 24.08.2026: `dict(stripe_objekt)` las das Objekt als Folge
    von Paaren, griff auf Index 0 zu und starb mit `KeyError: 0`. Die Seite
    zeigte daraufhin „Preise gerade nicht abrufbar" — ein Fehler in der
    NEBENSACHE Währung hatte den Hauptpfad mitgenommen. Dieser Test hält die
    Auswertung von der einzigen Annahme frei, die sie nicht treffen darf.
    """

    class _WieStripeObject:
        """So verhält sich Stripes `StripeObject` wirklich: kein dict-Subtyp,
        `dict(obj)` und `obj.keys()` scheitern beide, aber `to_dict()` trägt."""

        def __init__(self, daten: dict[str, object]) -> None:
            self._daten = daten

        def to_dict(self) -> dict[str, object]:
            return dict(self._daten)

        def __getattr__(self, name: str) -> object:
            # Jeder Attributzugriff ist ein FELDzugriff — genau daran ist
            # `.keys()` gescheitert.
            raise AttributeError(name)

        def __getitem__(self, k: object) -> object:
            if k == 0:
                raise KeyError(0)  # `dict(obj)` läuft genau hier auf
            return self._daten[k]  # type: ignore[index]

    preis = {"currency_options": _WieStripeObject({"EUR": {}, "DKK": {"x": 1}})}
    assert set(preisliste_modul._waehrungsoptionen(preis)) == {"eur", "dkk"}  # noqa: SLF001

    # Und die Fälle, in denen es NICHTS zu lesen gibt: leeres Dict, keine
    # Ausnahme — sonst wäre der Hauptpfad wieder von der Nebensache abhängig.
    assert preisliste_modul._waehrungsoptionen({}) == {}  # noqa: SLF001
    assert preisliste_modul._waehrungsoptionen(  # noqa: SLF001
        {"currency_options": None}
    ) == {}
    assert preisliste_modul._waehrungsoptionen(  # noqa: SLF001
        {"currency_options": object()}
    ) == {}


# --- Die ganze Kette mit echten Währungsoptionen -------------------------
# Diese Tests fahren `get_pricing` gegen einen NACHGEBILDETEN Stripe-Client,
# dessen Preise `currency_options` tragen. Sie prüfen damit das Einzige, was
# sonst erst nach dem Schreiben in Stripe sichtbar würde: dass die DKK-Beträge
# tatsächlich durchkommen, dass die Staffel der Fremdwährung genommen wird und
# dass eine unvollständige Währung die ganze Liste auf EUR zurückfallen lässt.


class _SO:
    """Verhält sich wie Stripes `StripeObject`: kein dict, kein `.keys()`,
    aber `to_dict()`. Genau die Form, an der zwei Zugriffe gescheitert sind."""

    def __init__(self, daten: dict) -> None:
        self._daten = daten

    def to_dict(self) -> dict:
        return dict(self._daten)

    def __getattr__(self, name: str) -> object:
        raise AttributeError(name)

    def __getitem__(self, k: object) -> object:
        if k == 0:
            raise KeyError(0)
        return self._daten[k]  # type: ignore[index]

    def __contains__(self, k: object) -> bool:
        return k in self._daten


_EUR_STAFFEL = [
    {"up_to": 1, "flat_amount": 1990, "unit_amount": None},
    {"up_to": None, "flat_amount": None, "unit_amount": 400},
]
_DKK_STAFFEL = [
    {"up_to": 1, "flat_amount": 14900, "unit_amount": None},
    {"up_to": None, "flat_amount": None, "unit_amount": 3000},
]


def _stripe_attrappe(*, modul_hat_dkk: bool = True) -> object:
    """Minimaler Stripe-Client: ein Staffelpreis + die Modulpreise."""

    def _preis(lookup: str) -> dict:
        if lookup == "mnd_grundtarif_month":
            return {
                "id": "price_gt",
                "currency": "eur",
                "billing_scheme": "tiered",
                "tiers": _EUR_STAFFEL,
                "currency_options": _SO(
                    {"eur": _SO({"tiers": _EUR_STAFFEL}),
                     "dkk": _SO({"tiers": _DKK_STAFFEL})}
                ),
            }
        optionen = {"eur": _SO({"unit_amount": 3000})}
        if modul_hat_dkk:
            optionen["dkk"] = _SO({"unit_amount": 22500})
        return {
            "id": f"price_{lookup}",
            "currency": "eur",
            "billing_scheme": "per_unit",
            "unit_amount": 3000,
            "tiers": [],
            "currency_options": _SO(optionen),
        }

    class _Prices:
        def list(self, params: dict) -> object:  # noqa: A003
            lookup = params["lookup_keys"][0]
            return type("R", (), {"data": [_preis(lookup)]})()

        def retrieve(self, price_id: str, params: dict) -> dict:  # noqa: ARG002
            return _preis("mnd_grundtarif_month")

    class _V1:
        prices = _Prices()

    return type("S", (), {"v1": _V1()})()


def _stripe_setzen(
    monkeypatch: pytest.MonkeyPatch, svc: SubscriptionsService, attrappe: object
) -> None:
    """Die Attrappe an die Stelle des echten Stripe-Clients setzen.

    `_stripe` ist eine `property` auf der KLASSE, kein Instanz-Attribut. Ein
    `monkeypatch.setattr(svc, "_stripe", …)` liest beim Sichern des alten Werts
    den Getter — und der baut einen echten StripeClient, was unter pytest mit
    einem Live-Key bewusst gesperrt ist. Deshalb wird die property selbst
    ersetzt; monkeypatch stellt sie nach dem Test zurück.
    """
    monkeypatch.setattr(
        type(svc), "_stripe", property(lambda _self: attrappe), raising=False
    )


def test_dkk_kommt_durch(monkeypatch: pytest.MonkeyPatch) -> None:
    """Trägt Stripe DKK, liefert die Liste DKK — Betrag UND Kennzeichen."""
    svc = SubscriptionsService()
    _stripe_setzen(monkeypatch, svc, _stripe_attrappe())
    liste = svc.get_pricing("DKK")
    assert liste.currency == "DKK"
    # Die Staffel MUSS die dänische sein, nicht die Euro-Staffel.
    assert liste.grundtarif_tiers[0].flat_amount == 14900
    assert liste.grundtarif_tiers[1].unit_amount == 3000
    assert all(m.unit_amount == 22500 for m in liste.modules if m.lookup_key)


def test_ohne_wunsch_bleibt_es_euro(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ohne Währungswunsch ändert sich nichts — auch wenn DKK verfügbar wäre."""
    svc = SubscriptionsService()
    _stripe_setzen(monkeypatch, svc, _stripe_attrappe())
    liste = svc.get_pricing()
    assert liste.currency == "EUR"
    assert liste.grundtarif_tiers[0].flat_amount == 1990


def test_ein_modul_ohne_waehrung_kippt_die_ganze_liste(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fehlt DKK an EINEM Modul, kommt ALLES in EUR.

    Genau so verhält sich Stripe Checkout: trägt nicht jede Position die lokale
    Währung, rechnet es den GESAMTEN Vorgang in der Standardwährung ab. Eine
    Seite, die den Grundtarif in Kronen und ein Modul in Euro zeigt, nennt eine
    Summe, die der Kunde nie zu zahlen bekommt.
    """
    svc = SubscriptionsService()
    _stripe_setzen(monkeypatch, svc, _stripe_attrappe(modul_hat_dkk=False))
    liste = svc.get_pricing("DKK")
    assert liste.currency == "EUR"
    assert liste.grundtarif_tiers[0].flat_amount == 1990
    assert all(m.unit_amount == 3000 for m in liste.modules if m.lookup_key)


def test_unbekannte_waehrung_faellt_auf_euro(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Eine Währung, die Stripe nicht führt, ist kein Fehler — nur kein DKK."""
    svc = SubscriptionsService()
    _stripe_setzen(monkeypatch, svc, _stripe_attrappe())
    assert svc.get_pricing("SEK").currency == "EUR"
