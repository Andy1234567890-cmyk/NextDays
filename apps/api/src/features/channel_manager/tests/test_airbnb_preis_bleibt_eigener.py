"""Der Airbnb-Abruf darf einen gepflegten Grundpreis nicht überschreiben.

LIVE PASSIERT (06.09.2026, „Feriehus Snerlebo"): 12:25 senkt der Betrieb den
Grundpreis auf 750 DKK, der Abgleich schickt 750 an Channex. 12:45 drückt er
„Voll-Abgleich" am Airbnb-Kanal — der Abruf liest Airbnbs `default_daily_price`
(900, unser eigener Push von vorher) und schreibt ihn in den Preisplan zurück.
Der anschließende Voll-Push schickt 900. Der Betrieb sieht 900 bei Channex und
fragt, warum sein Preis nicht ankommt.

Airbnb ist für Preise ein PUSH-Kanal (Entscheidung 06.09.2026): der Preis geht
von uns dorthin. Ersetzt wird deshalb nur der Platzhalter (base_price 0) eines
eben angelegten Plans — nie ein Wert, den jemand eingetragen hat.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.airbnb_objekt_abruf import (
    AirbnbObjektAbrufMixin,
    _preis_gepflegt,
)

SETTINGS = {
    "pricing_setting": {"default_daily_price": 900, "listing_currency": "DKK"},
    "availability_rule": {"default_min_nights": 1},
    "booking_setting": {},
}


class _Tabelle:
    def __init__(self, db: _Db, name: str) -> None:
        self._db = db
        self._name = name
        self._werte: dict[str, Any] | None = None

    def select(self, *_a: Any) -> _Tabelle:
        return self

    def eq(self, *_a: Any) -> _Tabelle:
        return self

    def limit(self, *_a: Any) -> _Tabelle:
        return self

    def update(self, werte: dict[str, Any]) -> _Tabelle:
        self._werte = werte
        return self

    def execute(self) -> Any:
        if self._werte is not None:
            self._db.updates.append((self._name, self._werte))
        return type("R", (), {"data": [{"type_attributes": {}}]})()


class _Db:
    def __init__(self) -> None:
        self.updates: list[tuple[str, dict[str, Any]]] = []

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(self, name)


class _Dienst(AirbnbObjektAbrufMixin):
    def __init__(self) -> None:
        self.content_synced = 0
        self.abgeleitet: list[dict[str, Any]] = []

    def sync_content(self, *_a: Any, **_kw: Any) -> None:
        self.content_synced += 1

    def _abgeleitete_mitziehen(self, _db: Any, _plan_id: str, aenderung: dict) -> None:
        self.abgeleitet.append(aenderung)


def test_gepflegter_grundpreis_bleibt() -> None:
    db = _Db()
    dienst = _Dienst()
    raus = dienst._preise_von_airbnb(  # noqa: SLF001
        db, "t1", "p1", "l1",
        {"id": "plan-1", "angelegt": False, "base_price": 750.0},
        SETTINGS,
    )
    assert raus["uebernommen"] is False
    assert "bleibt" in raus["hinweis"]
    # Kein Schreibzugriff auf den Preisplan, kein Content-Push mit dem
    # falschen Preis.
    assert not any(t == "rate_plans" for t, _w in db.updates)
    assert dienst.content_synced == 0
    assert dienst.abgeleitet == []


def test_platzhalter_wird_ersetzt() -> None:
    """Der Fall, für den der Preis-Schritt gebaut wurde: neuer Plan mit 0."""
    db = _Db()
    dienst = _Dienst()
    raus = dienst._preise_von_airbnb(  # noqa: SLF001
        db, "t1", "p1", "l1",
        {"id": "plan-1", "angelegt": True, "base_price": 0},
        SETTINGS,
    )
    assert raus["uebernommen"] is True and raus["base_price"] == 900
    assert any(
        t == "rate_plans" and w.get("base_price") == 900 for t, w in db.updates
    )
    assert dienst.content_synced == 1


def test_alter_plan_mit_platzhalter_null_wird_auch_ersetzt() -> None:
    """Ein Plan, der schon existiert, aber noch 0 trägt (Abruf früher ohne
    Preis abgebrochen), ist weiterhin ein Platzhalter."""
    db = _Db()
    raus = _Dienst()._preise_von_airbnb(  # noqa: SLF001
        db, "t1", "p1", "l1",
        {"id": "plan-1", "angelegt": False, "base_price": 0},
        SETTINGS,
    )
    assert raus["uebernommen"] is True


def test_weitere_angaben_kommen_trotzdem() -> None:
    """Geschützt ist der PREIS — Check-in-Zeiten & Co. ergänzen weiter leere
    Felder (dort gilt ohnehin „nur wenn leer")."""
    db = _Db()
    raus = _Dienst()._preise_von_airbnb(  # noqa: SLF001
        db, "t1", "p1", "l1",
        {"id": "plan-1", "angelegt": False, "base_price": 750.0},
        {**SETTINGS, "booking_setting": {"check_in_time_start": "16"}},
    )
    assert raus["weitere"].get("check_in_from") == "16:00"


def test_preis_gepflegt() -> None:
    assert _preis_gepflegt(750) and _preis_gepflegt("900.00") and _preis_gepflegt(0.5)
    assert not _preis_gepflegt(0) and not _preis_gepflegt(None)
    assert not _preis_gepflegt("kaputt") and not _preis_gepflegt("0.00")
