"""Jede Portal-Rate bekommt einen EIGENEN Preisplan.

Live belegt am 23.08.2026: der Betrieb fuehrt bei Booking.com neben der
„Standard Rate" eine „Wochenrate" fuer den Wochenrabatt. Beide Raten landeten
bei uns auf dem EINEN Grundpreis-Plan. Zwei Folgen:

  - Unter „Preise" stand nur „Grundpreis" — die Wochenrate war unsichtbar.
  - Nur ein Eintrag je Plan traegt `primary_occ`, und Booking fuehrt
    Restriktionen auf Rate-Ebene: an „Rævlingehuset" zeigte der
    Extranet-Kalender an der Standard Rate min_stay 3, an der Wochenrate LEER.
    Ueber diese Rate kam um 11:46 eine 1-Nacht-Buchung (1.820 DKK).

Gegenprobe im selben Bestand: bei „FeWo *Stjerneskud*" ist die Wochenrate
(Code 63941996) mit `primary_occ: True` gemappt — dort zeigt das Extranet die 2
auf BEIDEN Raten.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.portal_raten_plaene import (
    MAX_PLAENE_JE_ZIMMER,
    _plan_name,
    plan_fuer_portal_rate,
    vorhandene_plan_namen,
)

GRUNDPREIS: dict[str, Any] = {
    "id": "51e29abe-35d4-4006-b1f1-79be1b5c39a9",
    "base_price": 880,
    "currency": "DKK",
    "min_stay": 3,
}


class _Tabelle:
    """Minimaler Supabase-Tabellen-Doppelgaenger: merkt sich das insert-Payload."""

    def __init__(self, store: dict[str, Any], rueckgabe: list[dict[str, Any]]):
        self._store = store
        self._rueckgabe = rueckgabe

    def insert(self, payload: dict[str, Any]) -> _Tabelle:
        self._store["insert"] = payload
        return self

    def select(self, _spalten: str) -> _Tabelle:
        return self

    def eq(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def is_(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def order(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Tabelle:
        return self

    def execute(self) -> Any:
        return type("R", (), {"data": self._rueckgabe})()


class _Db:
    def __init__(self, store: dict[str, Any], rueckgabe: list[dict[str, Any]]):
        self._store = store
        self._rueckgabe = rueckgabe

    def table(self, _name: str) -> _Tabelle:
        return _Tabelle(self._store, self._rueckgabe)


def test_plan_traegt_den_portal_namen() -> None:
    """Der Plan heisst wie die Rate im Extranet — sonst findet der Betrieb sie
    nicht wieder."""
    assert _plan_name("Wochenrate", 45627350, "Booking.com") == "Wochenrate"
    assert _plan_name("  Weekly Rate  ", 45979612, "Booking.com") == "Weekly Rate"


def test_ohne_titel_der_code_kein_fantasiename() -> None:
    assert _plan_name(None, 45627350, "Booking.com") == "Booking.com Rate 45627350"
    assert _plan_name("", 45627350, "Booking.com") == "Booking.com Rate 45627350"


def test_neuer_plan_erbt_preis_und_waehrung_vom_grundpreis() -> None:
    """Preis und Waehrung kommen vom Grundpreis — die Rate verkauft beim Portal
    schon zu diesem Betrag. Ein abweichender Startpreis waere eine Behauptung
    ueber den Verkauf, die niemand getroffen hat (Wurzel 4).

    Der MINDESTAUFENTHALT dagegen nicht: eine Wochenrate traegt ihre eigenen 7
    (siehe `test_wochenrate_plan_traegt_sieben_statt_grundwert`). Hier deshalb
    eine Rate ohne erkennbaren Typ, damit der Grundwert sichtbar bleibt."""
    store: dict[str, Any] = {}
    db = _Db(store, [{"id": "NEU"}])
    plan_id = plan_fuer_portal_rate(
        db, property_id="P", grundpreis=GRUNDPREIS,
        portal_titel="Non-refundable", rate_code=45627350,
        portal_label="Booking.com",
    )
    assert plan_id == "NEU"
    p = store["insert"]
    assert p["name"] == "Non-refundable"
    assert p["base_price"] == 880
    assert p["currency"] == "DKK"
    assert p["min_stay"] == 3
    # Die Rate verkauft beim Portal bereits — ohne dieses Flag bekaeme sie
    # weiterhin keine Restriktionen.
    assert p["send_to_portals"] is True
    assert p["rate_mode"] == "manual"


def test_kein_plan_wenn_insert_leer_bleibt() -> None:
    """Eine fehlende Plan-Zeile darf den Kanal-Aufbau nicht kippen: None, damit
    der Aufrufer auf den Grundpreis zurueckfaellt."""
    assert plan_fuer_portal_rate(
        _Db({}, []), property_id="P", grundpreis=GRUNDPREIS,
        portal_titel="Wochenrate", rate_code=1, portal_label="Booking.com",
    ) is None


def test_vorhandene_namen_fuer_idempotenz() -> None:
    """Wurzel 2: der Kanal-Aufbau laeuft mehrfach (Reconnect, additiver PUT).
    Ohne Namensabgleich entstuende jedes Mal eine weitere „Wochenrate"."""
    db = _Db({}, [
        {"id": "A", "name": "Grundpreis"},
        {"id": "B", "name": "Wochenrate"},
    ])
    namen = vorhandene_plan_namen(db, "P")
    assert namen["wochenrate"] == "B"
    assert namen["grundpreis"] == "A"


def test_obergrenze_ist_gesetzt() -> None:
    """Wurzel 8: ein Abruf, der Dutzende Raten liefert, darf nicht Dutzende
    Plaene anlegen. Real fuehren Booking-Kennungen zwei bis drei."""
    assert 2 <= MAX_PLAENE_JE_ZIMMER <= 10


def test_wochenrate_bekommt_sieben_naechte() -> None:
    """Eine Wochenrate IST der Mindestaufenthalt 7 — das ist ihre Mechanik.

    Belegt (partner.booking.com, „Setting up weekly rate plans for extended
    stays"): die Rate erscheint Gaesten, die „stays of seven nights or more"
    suchen, und Booking hat KEINEN separaten Wochenrabatt-Schalter — „you can
    set up discounts through a Weekly or Monthly Rate Plan".

    Erbte sie den Grundwert (real 2–3 Naechte), waere sie keine Wochenrate,
    sondern ein zweiter Standardpreis. Genau dieser Zustand wurde live
    gemessen: bei „FeWo *Stjerneskud*" traegt die Wochenrate denselben Preis
    (605 DKK) und denselben min_stay (2) wie die Standard Rate.
    """
    from src.features.channel_manager.portal_raten_plaene import min_stay_aus_titel

    assert min_stay_aus_titel("Wochenrate") == 7
    assert min_stay_aus_titel("Weekly Rate") == 7
    assert min_stay_aus_titel("weekly") == 7
    # Daenisch: der Beta-Betrieb sitzt in Daenemark, Booking benennt die
    # Ratenkategorie in der Extranet-Sprache.
    assert min_stay_aus_titel("Ugentlig rate") == 7


def test_monatsrate_bekommt_dreissig_naechte() -> None:
    from src.features.channel_manager.portal_raten_plaene import min_stay_aus_titel

    assert min_stay_aus_titel("Monatsrate") == 30
    assert min_stay_aus_titel("Monthly Rate") == 30


def test_unbekannter_titel_erbt_den_grundwert() -> None:
    """Kein geratener Mindestaufenthalt (Wurzel 4): trifft kein Wort, gilt der
    Wert des Grundpreises."""
    from src.features.channel_manager.portal_raten_plaene import min_stay_aus_titel

    assert min_stay_aus_titel("Standard Rate") is None
    assert min_stay_aus_titel("Non-refundable") is None
    assert min_stay_aus_titel("los-rate") is None
    assert min_stay_aus_titel(None) is None
    assert min_stay_aus_titel("   ") is None


def test_wochenrate_plan_traegt_sieben_statt_grundwert() -> None:
    """Der ganze Weg: eine Portal-Rate „Wochenrate" wird ein Plan mit 7
    Naechten, obwohl der Grundpreis 3 traegt."""
    store: dict[str, Any] = {}
    plan_id = plan_fuer_portal_rate(
        _Db(store, [{"id": "NEU"}]),
        property_id="P", grundpreis=GRUNDPREIS,
        portal_titel="Wochenrate", rate_code=45627350,
        portal_label="Booking.com",
    )
    assert plan_id == "NEU"
    assert store["insert"]["min_stay"] == 7, store["insert"]
    # Preis erbt weiter vom Grundpreis: die Rate verkauft beim Portal schon zu
    # diesem Betrag. Den Rabatt setzt der Betrieb unter „Preise".
    assert store["insert"]["base_price"] == 880


def test_plan_hat_keinen_parent() -> None:
    """OHNE parent_rate_plan_id: bei Channex stehen `inherit_rate` und
    `inherit_min_stay_arrival` mit einem Parent standardmaessig auf true
    (Doku rate-plans-collection), und die Wochenrate truege zwangsweise Preis
    und Mindestaufenthalt der Elternrate — genau der Fehler, der behoben wird."""
    store: dict[str, Any] = {}
    plan_fuer_portal_rate(
        _Db(store, [{"id": "NEU"}]),
        property_id="P", grundpreis=GRUNDPREIS,
        portal_titel="Wochenrate", rate_code=1, portal_label="Booking.com",
    )
    assert store["insert"]["rate_mode"] == "manual"
    assert "parent_rate_plan_id" not in store["insert"]
    assert "derived_from_rate_plan_id" not in store["insert"]
