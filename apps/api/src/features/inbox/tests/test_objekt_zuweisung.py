"""Objekt-Zuweisung der Automationen (inbox/objekt_zuweisung, 14.09.2026)."""

from __future__ import annotations

from unittest.mock import patch

from src.features.inbox.objekt_zuweisung import (
    neues_objekt_einordnen,
    zuweisung_normieren,
)


def test_liste_die_alle_objekte_deckt_wird_alle() -> None:
    assert zuweisung_normieren(["a", "b"], {"a", "b"}) is None
    assert zuweisung_normieren(["b", "a", "x"], {"a", "b"}) is None


def test_teilmenge_bleibt_liste() -> None:
    assert zuweisung_normieren(["a"], {"a", "b"}) == ["a"]


def test_leer_ist_alle() -> None:
    assert zuweisung_normieren([], {"a"}) is None
    assert zuweisung_normieren(None, set()) is None


class _Q:
    def __init__(self, db: _DB, name: str) -> None:
        self._db, self._name, self._patch = db, name, None

    def select(self, *_a: object, **_k: object) -> _Q:
        return self

    def eq(self, *_a: object) -> _Q:
        return self

    def is_(self, *_a: object) -> _Q:
        return self

    def update(self, patch: dict) -> _Q:
        self._patch = patch
        return self

    def execute(self) -> object:
        if self._patch is not None:
            self._db.updates.append((self._name, self._patch))
        return type("R", (), {"data": self._db.tables.get(self._name, [])})()


class _DB:
    def __init__(self, tables: dict) -> None:
        self.tables, self.updates = tables, []

    def table(self, name: str) -> _Q:
        return _Q(self, name)


def test_neues_objekt_wird_in_alle_regeln_aufgenommen_und_teilmenge_gemeldet() -> None:
    db = _DB({
        "properties": [{"id": "alt1"}, {"id": "alt2"}, {"id": "neu"}],
        "message_automation": [
            # deckte bisher alle → wird „alle" (NULL)
            {"id": "r1", "name": "Alle", "property_ids": ["alt1", "alt2"], "is_active": True},
            # echte Teilmenge → bleibt, wird gemeldet
            {"id": "r2", "name": "Nur Haus 1", "property_ids": ["alt1"], "is_active": True},
            # gilt schon für alle
            {"id": "r3", "name": "Offen", "property_ids": None, "is_active": True},
            # inaktive Teilmenge → keine Meldung
            {"id": "r4", "name": "Pausiert", "property_ids": ["alt2"], "is_active": False},
        ],
    })
    with patch("src.features.inbox.objekt_zuweisung.melde_systemwarnung") as melden:
        ergebnis = neues_objekt_einordnen(db, "t1", "neu")  # type: ignore[arg-type]
    assert ergebnis == {"aufgenommen": 1, "nicht_abgedeckt": ["Nur Haus 1"]}
    assert db.updates == [("message_automation", {"property_ids": None})]
    melden.assert_called_once()
    assert melden.call_args.kwargs["werte"] == {"regeln": "Nur Haus 1"}
    assert melden.call_args.kwargs["property_id"] == "neu"
