"""Ein neu angelegtes Objekt bekommt die Währung des Betriebs.

Der Anlass (live, 07.08.2026): ein selbst angelegtes Objekt hatte keine
Währung. Der Preisplan-Assistent scheiterte danach mit „currency: String
should have at least 1 character" — ein Fehler, der nicht sagt, was zu tun
ist, an einer Stelle, die mit dem Anlegen nichts zu tun hat.
"""

from __future__ import annotations

from typing import Any

from src.features.properties.verfuegbarkeit_push import tenant_currency


class _Antwort:
    def __init__(self, data: Any) -> None:
        self.data = data


class _Abfrage:
    """Minimaler PostgREST-Nachbau: merkt sich den Scope, liefert `zeilen`."""

    def __init__(self, zeilen: Any, protokoll: dict) -> None:
        self._zeilen = zeilen
        self._protokoll = protokoll

    def select(self, spalten: str) -> _Abfrage:
        self._protokoll["select"] = spalten
        return self

    def eq(self, feld: str, wert: Any) -> _Abfrage:
        self._protokoll.setdefault("eq", []).append((feld, wert))
        return self

    def limit(self, n: int) -> _Abfrage:
        self._protokoll["limit"] = n
        return self

    def execute(self) -> _Antwort:
        return _Antwort(self._zeilen)


class _DB:
    def __init__(self, zeilen: Any) -> None:
        self._zeilen = zeilen
        self.protokoll: dict = {}

    def table(self, name: str) -> _Abfrage:
        self.protokoll["table"] = name
        return _Abfrage(self._zeilen, self.protokoll)


class _KaputteDB:
    def table(self, _name: str) -> Any:
        raise RuntimeError("DB weg")


def test_waehrung_des_betriebs_wird_gelesen():
    db = _DB([{"currency": "DKK"}])
    assert tenant_currency(db, "tenant-1") == "DKK"
    assert db.protokoll["table"] == "tenants"
    # Scope: nur der eigene Betrieb (Wurzel 3).
    assert ("id", "tenant-1") in db.protokoll["eq"]


def test_waehrung_wird_normalisiert():
    assert tenant_currency(_DB([{"currency": " dkk "}]), "t") == "DKK"


def test_ohne_waehrung_bleibt_none():
    """Kein erfundener Ersatzwert (Wurzel 4) — dann fragt die Preis-Seite."""
    assert tenant_currency(_DB([{"currency": None}]), "t") is None
    assert tenant_currency(_DB([{"currency": ""}]), "t") is None
    assert tenant_currency(_DB([]), "t") is None


def test_db_fehler_kippt_die_anlage_nicht():
    """Best-effort: ein unlesbarer Betrieb darf das Anlegen nicht verhindern."""
    assert tenant_currency(_KaputteDB(), "t") is None
