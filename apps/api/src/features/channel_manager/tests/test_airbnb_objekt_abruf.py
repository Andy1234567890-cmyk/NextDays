"""Airbnb-Einzelabruf: die ECHTE Mapping-Antwort auswerten.

Die Beispieldaten sind nicht erfunden — sie sind live gemessen am autorisierten
Kanal des Beta-Betriebs (04.08.2026, Objekt „020 Lille Lægehus", Listing
1378994948547697321), unverändert bis auf die Kürzung.

WAS DIESE MESSUNG WIDERLEGT HAT — zwei Annahmen, die vorher im Slice standen:

1. „Airbnb gibt über Channex keine Preise her." FALSCH. Die Antwort von
   `POST channels/{id}/mappings` trägt `default_daily_price: 504` samt Währung,
   Gebühren, Aufenthalts- und Buchungsregeln zurück.

2. „Der Weg zum Mapping ist ein `rate_plans`-Array im Kanal-Update." FALSCH.
   `PUT channels/{id}` mit `rate_plans` antwortet 200 und speichert NICHTS —
   danach steht am Kanal weiter `rate_plans: []`. Wer nur den Status prüft, hält
   das für Erfolg (Wurzel 5). Der richtige Weg ist `POST …/mappings`.

Und eine Warnung zur Methode: der `channels/{id}/execute/<name>`-Namensraum
antwortet auf JEDEN Namen mit 200 `{"meta":{"message":"Success"}}`, auch auf
`voelliger_unsinn_xyz123` (kontrolliert gemessen). Er ist als Existenzbeweis
unbrauchbar; nur eine Änderung an den Daten zählt.
"""
from __future__ import annotations

from src.features.channel_manager.airbnb_objekt_abruf import (
    AirbnbObjektAbrufMixin as M,
)

# Der `pricing_setting`-Block, wie Channex ihn geliefert hat.
PREIS = {
    "default_daily_price": 504,
    "listing_currency": "DKK",
    "price_per_extra_person": 0,
    "guests_included": 1,
    "weekend_price": None,
    "weekly_price_factor": 0.0,
    "monthly_price_factor": 0.0,
    "cleaning_fee": None,
    "security_deposit": None,
    "min_stay_type": "Arrival",
    "standard_fees": [
        {"amount": 25.0, "amount_type": "flat", "charge_period": "PER_NIGHT",
         "charge_type": "PER_GROUP", "fee_type": "PASS_THROUGH_RESORT_FEE",
         "offline": False},
        {"amount": 1590.0, "amount_type": "flat", "charge_period": "PER_BOOKING",
         "charge_type": "PER_GROUP", "fee_type": "PASS_THROUGH_CLEANING_FEE",
         "offline": False},
        {"amount": 150.0, "amount_type": "flat", "charge_period": "PER_BOOKING",
         "charge_type": "PER_GROUP", "fee_type": "PASS_THROUGH_PET_FEE",
         "offline": False},
    ],
}

REGELN = {
    "default_min_nights": 1,
    "default_max_nights": 1125,
    "booking_lead_time": 12,
    "max_days_notice": 365,
    "turnover_days": 0,
    # Airbnbs „nicht gesetzt" ist -1 — das darf NIE als Wert durchgehen.
    "day_of_week_min_nights": [-1, -1, -1, -1, -1, -1, -1],
    "seasonal_min_nights": None,
}

BUCHUNG = {
    # ACHTUNG: check_in als STRING, check_out als ZAHL. Beide Formen kommen vor.
    "check_in_time_start": "16",
    "check_in_time_end": "FLEXIBLE",
    "check_out_time": 10,
    "guest_controls": {
        "allows_pets_as_host": True,
        "pet_capacity": 1,
        "allows_children_as_host": False,
        "allows_events_as_host": False,
        "allows_smoking_as_host": False,
    },
    "cancellation_policy_settings": {
        "cancellation_policy_category": "better_strict_with_grace_period",
    },
}


def test_nachtpreis_aus_echter_antwort() -> None:
    assert M._nachtpreis(PREIS) == 504.0  # noqa: SLF001


def test_preis_null_ist_kein_preis() -> None:
    """Airbnb setzt `default_daily_price: 0`, solange nichts geladen ist. Das ist
    „unbekannt", kein Preis — sonst stünde eine Nacht für 0 im Preisplan und der
    Betrieb verkauft umsonst (Wurzel 4/5)."""
    assert M._nachtpreis({"default_daily_price": 0}) is None  # noqa: SLF001


def test_fehlender_preis_wird_nicht_geraten() -> None:
    assert M._nachtpreis({}) is None  # noqa: SLF001
    assert M._nachtpreis({"default_daily_price": None}) is None  # noqa: SLF001


def test_minus_eins_ist_kein_wert() -> None:
    """Airbnbs Sentinel -1 heißt „nicht gesetzt"."""
    assert M._ganzzahl(-1) is None  # noqa: SLF001
    assert M._ganzzahl(0) == 0  # noqa: SLF001
    assert M._ganzzahl(1125) == 1125  # noqa: SLF001
    assert M._ganzzahl("7") == 7  # noqa: SLF001
    assert M._ganzzahl(None) is None  # noqa: SLF001
    assert M._ganzzahl("FLEXIBLE") is None  # noqa: SLF001


def test_stunde_beide_formen() -> None:
    """check_in kommt als String „16", check_out als Zahl 10 — live gemessen."""
    assert M._stunde("16") == 16  # noqa: SLF001
    assert M._stunde(10) == 10  # noqa: SLF001
    assert M._stunde("FLEXIBLE") is None  # noqa: SLF001
    assert M._stunde(None) is None  # noqa: SLF001


def test_stunde_ausserhalb_des_tages() -> None:
    """24 ist keine Uhrzeit; -1 ist Airbnbs „nicht gesetzt"."""
    assert M._stunde(24) is None  # noqa: SLF001
    assert M._stunde(-1) is None  # noqa: SLF001
    assert M._stunde(0) == 0  # noqa: SLF001


class _FakeTable:
    """Minimale Supabase-Tabelle: merkt sich, was geschrieben wurde."""

    def __init__(self, laden: list[dict] | None = None) -> None:
        self.laden = laden or []
        self.geschrieben: dict | None = None

    def select(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    def eq(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    def limit(self, *_a: object, **_k: object) -> _FakeTable:
        return self

    def update(self, werte: dict) -> _FakeTable:
        self.geschrieben = werte
        return self

    def execute(self) -> object:
        return type("R", (), {"data": self.laden})()


class _FakeDb:
    def __init__(self, tabelle: _FakeTable) -> None:
        self.tabelle = tabelle

    def table(self, _name: str) -> _FakeTable:
        return self.tabelle


def test_weitere_felder_aus_echter_antwort() -> None:
    """Alles, was Airbnb außer dem Preis liefert, landet am Objekt."""
    tabelle = _FakeTable([{"type_attributes": {}}])
    gesetzt = M._weitere_felder_uebernehmen(  # noqa: SLF001
        M(), _FakeDb(tabelle), "p1", PREIS, REGELN, BUCHUNG,
    )
    assert gesetzt["check_in_from"] == "16:00"
    assert gesetzt["check_out_until"] == "10:00"
    assert gesetzt["pets_allowed"] is True
    assert gesetzt["pets_max"] == 1
    assert gesetzt["smoking_allowed"] is False
    assert gesetzt["max_nights"] == 1125

    # Airbnbs Rohdaten werden mitgeschrieben — sie sind der Beleg, woher unsere
    # Zahlen kommen.
    roh = (tabelle.geschrieben or {})["type_attributes"]["airbnb"]
    assert roh["pricing_setting"]["default_daily_price"] == 504
    assert len(roh["pricing_setting"]["standard_fees"]) == 3


def test_gepflegte_werte_bleiben() -> None:
    """Wurzel 1: was der Betrieb selbst eingestellt hat, überschreibt der Abruf
    NICHT — sonst setzt jeder Abruf die eigene Hausregel zurück."""
    tabelle = _FakeTable([{"type_attributes": {
        "check_in_from": "14:00", "pets_allowed": False, "max_nights": 30,
    }}])
    gesetzt = M._weitere_felder_uebernehmen(  # noqa: SLF001
        M(), _FakeDb(tabelle), "p1", PREIS, REGELN, BUCHUNG,
    )
    assert "check_in_from" not in gesetzt
    assert "pets_allowed" not in gesetzt
    assert "max_nights" not in gesetzt
    # Der eigene Wert steht unverändert in der DB.
    neu = (tabelle.geschrieben or {})["type_attributes"]
    assert neu["check_in_from"] == "14:00"
    assert neu["pets_allowed"] is False


def test_leere_airbnb_antwort_setzt_nichts() -> None:
    """Kein Fantasiewert, wenn Airbnb nichts liefert (Wurzel 4)."""
    tabelle = _FakeTable([{"type_attributes": {}}])
    gesetzt = M._weitere_felder_uebernehmen(  # noqa: SLF001
        M(), _FakeDb(tabelle), "p1", {}, {}, {},
    )
    assert gesetzt == {}


# --- Kanal-Pläne (portal_scope, 0272) müssen mitgezogen werden --------------
#
# Live gemessen an „Feriehus Grævlinge" (05.08.2026): Der Abruf setzte den
# Grundplan auf `min_stay: 1` (Airbnbs Stand), der abgeleitete Kanal-Plan blieb
# auf `min_stay: 2` stehen. `_upsert_channex_rate_plan` schickt genau den
# min_stay des KIND-Plans an Channex — an Airbnb wären also 2 Nächte gegangen,
# während Airbnb selbst 1 führt.


class _KindTabelle:
    """Merkt sich Updates, statt sie zu schreiben."""

    def __init__(self, laden: list[dict], protokoll: list[tuple]) -> None:
        self._laden = laden
        self._protokoll = protokoll
        self._patch: dict | None = None
        self._filter: tuple | None = None

    def select(self, *_a: str, **_k: object) -> _KindTabelle:
        return self

    def update(self, patch: dict) -> _KindTabelle:
        self._patch = patch
        return self

    def eq(self, spalte: str, wert: object) -> _KindTabelle:
        self._filter = (spalte, wert)
        return self

    def execute(self) -> object:
        if self._patch is not None:
            self._protokoll.append((self._filter, self._patch))
            self._patch = None
            return type("R", (), {"data": []})()
        return type("R", (), {"data": self._laden})()


class _KindDb:
    def __init__(self, kinder: list[dict]) -> None:
        self.kinder = kinder
        self.updates: list[tuple] = []

    def table(self, _name: str) -> _KindTabelle:
        return _KindTabelle(self.kinder, self.updates)


def test_kanalplan_erbt_waehrung_und_mindestaufenthalt() -> None:
    """Wurzel 1: der Gegenzustand des Kind-Plans muss mitgepflegt werden."""
    db = _KindDb([{"id": "kind-1"}])
    anzahl = M._abgeleitete_mitziehen(  # noqa: SLF001 — Testziel
        db, "eltern-1", {"base_price": 950.0, "currency": "DKK", "min_stay": 1}
    )
    assert anzahl == 1
    (feld, wert), patch = db.updates[0]
    assert (feld, wert) == ("derived_from_rate_plan_id", "eltern-1")
    assert patch == {"currency": "DKK", "min_stay": 1}


def test_kanalplan_erbt_den_preis_NICHT() -> None:
    """`base_price` bleibt außen vor — sonst zwei Preis-Wahrheiten (Wurzel 4).

    Der Resolver rechnet die Kindkurve immer aus der Elternkurve plus Offset
    (`resolver._rate_plan_curve`); die Spalte im Kind ist eine tote Kopie.
    """
    db = _KindDb([{"id": "kind-1"}])
    M._abgeleitete_mitziehen(db, "eltern-1", {"base_price": 950.0})  # noqa: SLF001
    assert db.updates == []


def test_ohne_kinder_kein_update() -> None:
    """Kein Kanal-Plan → kein Schreibvorgang (Wurzel 2)."""
    db = _KindDb([])
    assert M._abgeleitete_mitziehen(  # noqa: SLF001
        db, "eltern-1", {"min_stay": 1}
    ) == 0
    assert db.updates == []
