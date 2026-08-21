"""Die Glocke spricht die Sprache des Empfängers, nicht Englisch.

WARUM DIESE TESTS: Der Dispatcher rendert Mail und SMS über
`aufloesen(users.preferred_language, tenants.default_language)`. Die GLOCKE
nahm stattdessen den Rohtext, den die Aufrufer in `ereignisse.py` bauen — und
den bauen sie im FALLBACK (`en`). Live gesehen am 21.08.2026 in einem
dänisch/deutsch geführten Betrieb: „Jeanine Ågaard is taking over: Reng T".
24 Sprachen liegen im Katalog, eine Grundeinstellung steht am Betrieb — und in
der Glocke stand trotzdem Englisch.
"""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from src.features.notification_settings.dispatcher import NotificationDispatcher


class _Kette:  # pylint: disable=too-few-public-methods
    def __init__(self, db: _DB, tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle

    def select(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def insert(self, zeile: dict) -> _Kette:
        self._db.eingefuegt.append((self._tabelle, zeile))
        return self

    def eq(self, *_a: Any) -> _Kette:
        return self

    def limit(self, _n: int) -> _Kette:
        return self

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._db.tabellen.get(self._tabelle, []))


class _DB:  # pylint: disable=too-few-public-methods
    def __init__(self, tabellen: dict[str, list[dict]]) -> None:
        self.tabellen = tabellen
        self.eingefuegt: list[tuple[str, dict]] = []

    def table(self, name: str) -> _Kette:
        return _Kette(self, name)


def _db(nutzer_sprache: str | None, betriebs_sprache: str | None) -> _DB:
    return _DB(
        {
            "users": [
                {
                    "id": "u-1",
                    "email": "a@b.de",
                    "phone": None,
                    "preferred_language": nutzer_sprache,
                }
            ],
            "tenants": [{"id": "t-1", "default_language": betriebs_sprache}],
            "notification_settings": [],
            "notifications": [],
        }
    )


@pytest.fixture(autouse=True)
def _ohne_versand(monkeypatch: pytest.MonkeyPatch) -> None:
    """Nur die Glocke prüfen — kein Mail-/SMS-Versand in die Timeouts."""
    monkeypatch.setattr(
        NotificationDispatcher, "_sende_kanal", lambda *a, **k: None
    )


def _glocke(db: _DB) -> dict:
    zeilen = [z for t, z in db.eingefuegt if t == "notifications"]
    assert len(zeilen) == 1
    return zeilen[0]


def _senden(db: _DB) -> None:
    NotificationDispatcher(db).sende(  # type: ignore[arg-type]
        user_id="u-1",
        schluessel="task_assigned",
        betreff="New task: Endreinigung",  # der englische Rohtext-Rückfall
        betreff_key="benachrichtigung.aufgabe_neu",
        betreff_werte={"titel": "Endreinigung"},
        text="",
        tenant_id="t-1",
        ziel_pfad="/aufgaben/t1",
    )


def test_glocke_nimmt_die_sprache_des_nutzers() -> None:
    db = _db("de", "da")
    _senden(db)
    assert _glocke(db)["titel"] == "Neue Aufgabe: Endreinigung"


def test_ohne_nutzersprache_gilt_die_grundeinstellung_des_betriebs() -> None:
    """Die zweite Stufe der Kette — genau die, die vorher übersprungen wurde."""
    db = _db(None, "da")
    _senden(db)
    assert _glocke(db)["titel"] == "Ny opgave: Endreinigung"


def test_ohne_jede_einstellung_bleibt_es_englisch() -> None:
    """Letzter Rückfall — nicht die Regel, sondern die Ausnahme."""
    db = _db(None, None)
    _senden(db)
    assert _glocke(db)["titel"] == "New task: Endreinigung"


def test_ohne_katalogschluessel_gilt_der_rohtext() -> None:
    """Rückwärtskompatibel: ein Aufrufer ohne `betreff_key` bleibt lauffähig.

    Sonst stünde bei ihm plötzlich ein leerer Titel in der Glocke.
    """
    db = _db("de", "de")
    NotificationDispatcher(db).sende(  # type: ignore[arg-type]
        user_id="u-1",
        schluessel="task_assigned",
        betreff="Rohtext ohne Schlüssel",
        text="",
        tenant_id="t-1",
    )
    assert _glocke(db)["titel"] == "Rohtext ohne Schlüssel"
