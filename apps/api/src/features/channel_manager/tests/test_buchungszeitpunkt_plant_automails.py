"""Nachgetragener Buchungszeitpunkt plant die Automails des Threads sofort
(14.09.2026) — vorher erst der Stundenlauf, die Bestätigung des Kunden kam zu spät."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from src.features.channel_manager.airbnb_historie_dienst import (
    AirbnbHistorieDienstMixin as AirbnbHistorieDienst,
)


class _Q:
    def __init__(self, db: _DB, name: str) -> None:
        self._db, self._name = db, name

    def update(self, patch: dict) -> _Q:
        self._db.updates.append((self._name, patch))
        return self

    def eq(self, *_a: object) -> _Q:
        return self

    def is_(self, *_a: object) -> _Q:
        return self

    def execute(self) -> object:
        return SimpleNamespace(data=[])


class _DB:
    def __init__(self) -> None:
        self.updates: list = []

    def table(self, name: str) -> _Q:
        return _Q(self, name)


def test_gesetzter_zeitpunkt_plant_den_thread() -> None:
    db = _DB()
    dienst = AirbnbHistorieDienst.__new__(AirbnbHistorieDienst)
    zeilen = [{"id": "th1", "ota_reservation_code": "HMABC"}]
    gelesen = SimpleNamespace(
        buchungen=[{"confirmation_code": "HMABC", "booked_at": "2026-09-14T08:05:01Z"}]
    )
    with (
        patch.object(dienst, "_airbnb_token_am_kanal", return_value=("tok",), create=True),
        patch.object(dienst, "nachpflege_bestand", return_value=gelesen),
        patch.object(AirbnbHistorieDienst, "_automails_planen") as planen,
    ):
        gesetzt = dienst._zeitpunkte_eines_kontos(db, "t1", zeilen, "ch1")  # type: ignore[arg-type]
    assert gesetzt == 1
    assert any(n == "channex_booking" and "booked_at" in p for n, p in db.updates)
    planen.assert_called_once_with(db, "t1", "th1")


def test_ohne_zeitpunkt_keine_planung() -> None:
    db = _DB()
    dienst = AirbnbHistorieDienst.__new__(AirbnbHistorieDienst)
    gelesen = SimpleNamespace(buchungen=[])
    with (
        patch.object(dienst, "_airbnb_token_am_kanal", return_value=("tok",), create=True),
        patch.object(dienst, "nachpflege_bestand", return_value=gelesen),
        patch.object(AirbnbHistorieDienst, "_automails_planen") as planen,
    ):
        zeilen = [{"id": "th1", "ota_reservation_code": "X"}]
        gesetzt = dienst._zeitpunkte_eines_kontos(db, "t1", zeilen, "ch1")  # type: ignore[arg-type]
    assert gesetzt == 0
    planen.assert_not_called()
