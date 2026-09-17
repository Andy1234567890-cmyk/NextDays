"""Der Sync-Stempel gehoert der OFFENEN Zuordnung (Wurzel 1 + Wurzel 5).

DER GEMESSENE FEHLZUSTAND (17.09.2026, Betrieb „AirSmil", FeWo *Stjerneskud*):
Das Objekt trug drei Zeilen in `channex_property_map` — eine offene und zwei
geschlossene, die seit 0427 als bekannte Altlast weiter `sync_enabled = true`
tragen. `_mark_property_sync` filterte nur auf `property_id`/`tenant_id` und
stempelte alle drei. Der Constraint
`channex_property_map_geschlossen_nicht_aktiv` ist NOT VALID — er greift nicht
beim Anlegen, aber bei JEDEM Update einer solchen Zeile. Das Statement kippte
mit 23514, und zwar samt der gesunden Zeile.

Warum das teuer war: der Stempel steht HINTER der ganzen Channex-Kette. Jeder
Versuch schob Property, Room-Types, Rate-Plans, Steuern und Hotel-Policy
erfolgreich raus und starb erst danach — 45 Jobs, 447 Versuche seit dem
24.08.2026, jeder mit vollem Content-Push gegen das Channex-Budget. Und weil
`sync_content` damit wirft, lief der Schritt danach nie, der freigegebene
Preisplaene den Kanaelen zuordnet.

Warum es niemand sah: der Reconcile frischt den ok-Stempel der AKTIVEN Zeile
separat auf (`property_mapping._sync_stamp_stale`). Der Kanalmanager stand
gruen, waehrend die Jobs auf `dead` liefen.

Der Test prueft deshalb das VERHALTEN an drei Zeilen, nicht die Form des
Aufrufs: die geschlossenen behalten ihren Beleg, nur die offene wird gestempelt.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.content_sync import ContentSyncMixin

TENANT = "a25577cf-c941-45c4-8d23-008887e631aa"
OBJEKT = "6efd2281-1649-4883-9cf1-4e39f49fec66"


class _Update:
    """Sammelt die Filter und wendet das Update auf die passenden Zeilen an."""

    def __init__(self, zeilen: list[dict[str, Any]], payload: dict[str, Any]) -> None:
        self._zeilen = zeilen
        self._payload = payload
        self._filter: list[tuple[str, str, object]] = []

    def eq(self, spalte: str, wert: object) -> _Update:
        self._filter.append(("eq", spalte, wert))
        return self

    def is_(self, spalte: str, wert: object) -> _Update:
        self._filter.append(("is", spalte, wert))
        return self

    def _passt(self, zeile: dict[str, Any]) -> bool:
        for art, spalte, wert in self._filter:
            if art == "eq" and zeile.get(spalte) != wert:
                return False
            # PostgREST: `is.null` trifft ausschliesslich NULL-Werte.
            if art == "is" and wert == "null" and zeile.get(spalte) is not None:
                return False
        return True

    def execute(self) -> None:
        for zeile in self._zeilen:
            if self._passt(zeile):
                zeile.update(self._payload)


class _Tabelle:
    def __init__(self, zeilen: list[dict[str, Any]]) -> None:
        self._zeilen = zeilen

    def update(self, payload: dict[str, Any]) -> _Update:
        return _Update(self._zeilen, payload)


class _DB:
    def __init__(self, zeilen: list[dict[str, Any]]) -> None:
        self.zeilen = zeilen

    def table(self, name: str) -> _Tabelle:
        assert name == "channex_property_map"
        return _Tabelle(self.zeilen)


class _Service(ContentSyncMixin):
    """Nur der Mixin — `_mark_property_sync` braucht ausser `db` nichts."""


def _zeilen() -> list[dict[str, Any]]:
    """Der Live-Stand von Stjerneskud: zwei geschlossene, eine offene."""
    return [
        {
            "id": "8a562e39", "tenant_id": TENANT, "property_id": OBJEKT,
            "sync_enabled": True, "deleted_at": "2026-08-07T13:47:22+00:00",
            "last_sync_status": "ok", "last_sync_error": None,
            "last_sync_at": "2026-08-24T05:12:09+00:00",
        },
        {
            "id": "c78abee4", "tenant_id": TENANT, "property_id": OBJEKT,
            "sync_enabled": True, "deleted_at": "2026-08-07T14:05:22+00:00",
            "last_sync_status": "ok", "last_sync_error": None,
            "last_sync_at": "2026-08-24T05:12:09+00:00",
        },
        {
            "id": "a935ffcd", "tenant_id": TENANT, "property_id": OBJEKT,
            "sync_enabled": True, "deleted_at": None,
            "last_sync_status": "ok", "last_sync_error": None,
            "last_sync_at": "2026-09-17T04:45:32+00:00",
        },
    ]


def test_geschlossene_zuordnungen_werden_nicht_gestempelt() -> None:
    db = _DB(_zeilen())

    _Service()._mark_property_sync(  # noqa: SLF001 — geprueft wird genau dieser Helfer
        db, TENANT, OBJEKT, "error", "Channex meldet 422",
    )

    geschlossen = [z for z in db.zeilen if z["deleted_at"] is not None]
    assert len(geschlossen) == 2
    for zeile in geschlossen:
        # Der Beleg, wie die Registrierung endete, bleibt unangetastet — und die
        # Zeile, die den Constraint verletzt, wird gar nicht erst angefasst.
        assert zeile["last_sync_status"] == "ok"
        assert zeile["last_sync_error"] is None
        assert zeile["last_sync_at"] == "2026-08-24T05:12:09+00:00"


def test_die_offene_zuordnung_wird_gestempelt() -> None:
    db = _DB(_zeilen())

    _Service()._mark_property_sync(  # noqa: SLF001 — geprueft wird genau dieser Helfer
        db, TENANT, OBJEKT, "error", "Channex meldet 422",
    )

    offen = next(z for z in db.zeilen if z["deleted_at"] is None)
    assert offen["last_sync_status"] == "error"
    assert offen["last_sync_error"] == "Channex meldet 422"
    assert offen["last_sync_at"] != "2026-09-17T04:45:32+00:00"
