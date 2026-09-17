"""Die Airbnb-Uebernahme liest die OFFENE Channex-Zuordnung (Wurzel 3).

DER GEMESSENE FEHLZUSTAND (17.09.2026, „FeWo *Stjerneskud*"):
`_registrierung_nachholen_und_lesen` las die Channex-UUID mit

    .eq("tenant_id", …).eq("property_id", …).limit(1)

— ohne `deleted_at`-Filter und ohne `order`. Das Objekt traegt drei Zeilen in
`channex_property_map`, zwei davon geschlossen. Welche Zeile `limit(1)`
liefert, entscheidet damit der Planner; live kam dreimal reproduzierbar die
GESCHLOSSENE Zeile zurueck, deren Channex-Property mit 404 antwortet.

Warum das nicht von selbst heilt: genau diese UUID gilt dem Idempotenz-Zweig
als „schon registriert", er legt also nichts Neues an und gibt die tote Kennung
zurueck. Der Autorisierungslink zeigte auf eine Property, die es nicht gibt.

Der Test stellt die Zeilen bewusst in der Reihenfolge bereit, in der die
Datenbank sie geliefert hat: die geschlossene zuerst.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.airbnb_uebernahme import AirbnbUebernahmeMixin

TENANT = "a25577cf-c941-45c4-8d23-008887e631aa"
OBJEKT = "6efd2281-1649-4883-9cf1-4e39f49fec66"
TOT = "1060923f-fb76-4215-9a31-60386525817d"
LEBEND = "6a17222f-9a75-4e1f-8f8d-9fa07efa9275"


class _Query:
    def __init__(self, zeilen: list[dict[str, Any]]) -> None:
        self._zeilen = zeilen

    def select(self, _spalten: str) -> _Query:
        return self

    def eq(self, spalte: str, wert: object) -> _Query:
        return _Query([z for z in self._zeilen if z.get(spalte) == wert])

    def is_(self, spalte: str, wert: object) -> _Query:
        # PostgREST: `is.null` trifft ausschliesslich NULL-Werte.
        if wert != "null":
            return self
        return _Query([z for z in self._zeilen if z.get(spalte) is None])

    def limit(self, n: int) -> _Query:
        return _Query(self._zeilen[:n])

    def execute(self) -> Any:
        return type("Res", (), {"data": list(self._zeilen)})()


class _DB:
    def __init__(self, zeilen: list[dict[str, Any]]) -> None:
        self._zeilen = zeilen

    def table(self, name: str) -> _Query:
        assert name == "channex_property_map"
        return _Query(self._zeilen)


def _zeilen() -> list[dict[str, Any]]:
    """Live-Reihenfolge: die geschlossene Zeile kam zuerst zurueck."""
    return [
        {
            "tenant_id": TENANT, "property_id": OBJEKT,
            "channex_property_id": TOT,
            "deleted_at": "2026-08-07T13:47:22+00:00",
        },
        {
            "tenant_id": TENANT, "property_id": OBJEKT,
            "channex_property_id": LEBEND,
            "deleted_at": None,
        },
    ]


def test_geschlossene_zuordnung_wird_uebergangen() -> None:
    gelesen = AirbnbUebernahmeMixin._offene_registrierung(  # noqa: SLF001
        _DB(_zeilen()), TENANT, OBJEKT,
    )
    assert gelesen == LEBEND


def test_ohne_offene_zuordnung_kommt_none_statt_der_toten() -> None:
    """Kein Ersatzwert aus einer geschlossenen Zeile (Wurzel 4/5).

    Ohne offene Zuordnung MUSS `None` zurueckkommen — dann legt der Aufrufer
    neu an bzw. bricht fail-closed ab. Eine tote UUID zurueckzugeben waere der
    plausible Ersatzwert, der den Fehler unsichtbar macht.
    """
    nur_geschlossen = [z for z in _zeilen() if z["deleted_at"] is not None]

    gelesen = AirbnbUebernahmeMixin._offene_registrierung(  # noqa: SLF001
        _DB(nur_geschlossen), TENANT, OBJEKT,
    )
    assert gelesen is None
