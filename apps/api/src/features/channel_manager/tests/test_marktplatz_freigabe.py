"""Marktplatz-Zählung im Kanalmanager: gelistet ≠ sichtbar.

DER ANLASS (11.08.2026): die Kanal-Karte „myBestDays" meldete „18 Objekte
gelistet", auf dem Marktplatz stand kein einziges. Ursache war nicht der
Marktplatz, sondern die Zahl: sie zählte `status='active' AND
listed_on_marketplace` und ließ die Freigabe des Betreibers
(`moderation_status='approved'`, 0203) weg — genau die Bedingung, die der
öffentliche Marktplatz zusätzlich abfragt. 17 Objekte standen auf `pending`.

Die Zahl muss dieselbe Bedingung tragen wie `booking_engine.list_listings`,
sonst behauptet die Oberfläche einen Verkaufskanal, der nicht verkauft.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.channels import ChannelsMixin


class _Tabelle:
    """Attrappe einer Tabelle: `eq`-Filter auf einer Zeilenliste."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows
        self._filter: list[tuple[str, Any]] = []

    def select(self, *_a: object, **_k: object) -> _Tabelle:
        return self

    def eq(self, spalte: str, wert: Any) -> _Tabelle:
        self._filter.append((spalte, wert))
        return self

    def execute(self) -> Any:
        rows = [
            r for r in self._rows
            if all(r.get(k) == v for k, v in self._filter)
        ]
        return type("R", (), {"data": rows})()


class _DB:
    def __init__(self, tabellen: dict[str, list[dict[str, Any]]]) -> None:
        self._tabellen = tabellen

    def table(self, name: str) -> _Tabelle:
        return _Tabelle(list(self._tabellen.get(name, [])))


class _Dienst(ChannelsMixin):
    def __init__(self, db: _DB) -> None:
        self._db = db

    def _require_tenant(self, _ctx: object) -> str:
        return "t-1"

    def _require_db(self) -> _DB:
        return self._db

    def _portal_catalog(self) -> list[dict[str, str]]:
        return []  # OTA-Katalog ist hier nicht der Prüfgegenstand


def _objekt(moderation: str | None, *, gelistet: bool = True,
            status: str = "active") -> dict[str, Any]:
    return {
        "id": f"p-{moderation}-{status}-{gelistet}",
        "tenant_id": "t-1",
        "status": status,
        "listed_on_marketplace": gelistet,
        "moderation_status": moderation,
    }


def test_marktplatz_zaehlt_nur_freigegebene_als_gelistet() -> None:
    db = _DB({
        "properties": [
            _objekt("approved"),
            _objekt("pending"),
            _objekt("draft"),
            _objekt("rejected"),
        ],
    })
    markt = _Dienst(db).channel_overview(object())["marketplace"]
    assert markt["listed_count"] == 1
    assert markt["pending_count"] == 3


def test_marktplatz_ignoriert_nicht_gelistete_und_entwuerfe() -> None:
    """Schalter aus oder Objekt kein `active` → zählt in KEINER der beiden
    Zahlen mit (auch nicht als „wartet")."""
    db = _DB({
        "properties": [
            _objekt("approved", gelistet=False),
            _objekt("pending", gelistet=False),
            _objekt("approved", status="draft"),
            _objekt("pending", status="draft"),
        ],
    })
    markt = _Dienst(db).channel_overview(object())["marketplace"]
    assert markt["listed_count"] == 0
    assert markt["pending_count"] == 0


def test_marktplatz_ohne_objekte_ist_null_und_nicht_geraten() -> None:
    markt = _Dienst(_DB({})).channel_overview(object())["marketplace"]
    assert markt["listed_count"] == 0
    assert markt["pending_count"] == 0
