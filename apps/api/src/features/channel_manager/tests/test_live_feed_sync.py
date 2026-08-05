"""Ereignis-Journal nachziehen: kein Doppelter, kein fremdes Ereignis.

Warum diese Tests: das Journal ist der einzige Nachhol-Weg für alles, was keine
Buchung ist. Zwei Fehler wären hier teuer:
  1. Ein Ereignis doppelt schreiben (der Tick läuft alle 5 Minuten, mehrere
     Worker-Instanzen gleichzeitig) — Wurzel 2.
  2. Ein Ereignis eines FREMDEN Mandanten übernehmen. Das Channex-Konto ist
     kontoweit (white-label), das Journal liefert also auch Ereignisse anderer
     Betriebe — Wurzel 3.

Die Beispieldaten sind die live gemessene Antwort (05.08.2026, Konto AirSmil):
`GET live_feed` → 200, `meta.total = 4`, vier `review`-Ereignisse.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.live_feed_sync import LiveFeedSyncMixin


def _ereignis(live_id: str, event: str, property_id: str | None) -> dict[str, Any]:
    """Ein Journal-Eintrag in der gemessenen Form."""
    return {
        "id": live_id,
        "type": "live_feed_event",
        "attributes": {
            "id": live_id,
            "event": event,
            "inserted_at": "2026-08-04T20:45:16.887130",
            "organization_id": None,
            "payload": {"property_id": property_id, "id": "sache-" + live_id},
        },
    }


class _Tabelle:
    def __init__(self, speicher: list[dict[str, Any]], bekannt: set[str]):
        self._speicher = speicher
        self._bekannt = bekannt
        self._filter: dict[str, Any] = {}
        self._insert: dict[str, Any] | None = None

    def select(self, *_a, **_k):
        return self

    def eq(self, feld: str, wert: Any):
        self._filter[feld] = wert
        return self

    def limit(self, _n: int):
        return self

    def insert(self, zeile: dict[str, Any]):
        self._insert = zeile
        return self

    def execute(self):
        class _Res:
            def __init__(self, data):
                self.data = data

        if self._insert is not None:
            live_id = self._insert.get("live_feed_event_id")
            if live_id in self._bekannt:
                # So verhält sich der UNIQUE-Index aus 0284.
                raise RuntimeError("duplicate key value violates unique constraint")
            self._bekannt.add(live_id)
            self._speicher.append(self._insert)
            return _Res([self._insert])
        gesucht = self._filter.get("live_feed_event_id")
        return _Res([{"id": "x"}] if gesucht in self._bekannt else [])


class _Db:
    def __init__(self, bekannt: set[str] | None = None):
        self.gespeichert: list[dict[str, Any]] = []
        self.bekannt: set[str] = bekannt or set()

    def table(self, _name: str):
        return _Tabelle(self.gespeichert, self.bekannt)


class _Client:
    def __init__(self, seiten: list[dict[str, Any]]):
        self._seiten = seiten
        self.aufrufe: list[int] = []

    def get_live_feed(self, *, page: int, limit: int):  # noqa: ARG002
        self.aufrufe.append(page)
        if page <= len(self._seiten):
            return self._seiten[page - 1]
        return {"data": [], "meta": {"total": 0}}


class _Sync(LiveFeedSyncMixin):
    """Nur der Journal-Abruf; Tenant-Auflösung und Event-Klassen sind gesetzt."""

    _ERROR_EVENTS = frozenset({"sync_error", "general_error"})
    _ACTION_EVENTS = frozenset({"reservation_request", "inquiry", "alteration_request"})

    def __init__(self, client: _Client, db: _Db, eigene: dict[str, str] | None = None):
        self._channex = client
        self._db = db
        self._eigene = eigene if eigene is not None else {"P1": "T1"}

    def _resolve_webhook_property(self, channex_property_id):
        tenant = self._eigene.get(str(channex_property_id))
        return (tenant, "objekt-" + str(channex_property_id)) if tenant else (None, None)


def _seite(ereignisse: list[dict[str, Any]], total: int) -> dict[str, Any]:
    return {"data": ereignisse, "meta": {"total": total, "limit": 100, "page": 1}}


def test_vier_ereignisse_wie_gemessen():
    """Die live gemessene Antwort: 4 Bewertungen, alle neu."""
    client = _Client([
        _seite([_ereignis(f"ev{i}", "review", "P1") for i in range(4)], 4)
    ])
    db = _Db()
    ergebnis = _Sync(client, db).live_feed_nachziehen()
    assert ergebnis == {"gesehen": 4, "neu": 4, "uebersprungen": 0}
    assert len(db.gespeichert) == 4
    assert all(z["live_feed_event_id"].startswith("ev") for z in db.gespeichert)


def test_zweiter_lauf_schreibt_nichts():
    """Wurzel 2: der Tick läuft alle 5 Minuten — Doppelte sind der Normalfall."""
    seiten = [_seite([_ereignis("ev1", "review", "P1")], 1)]
    db = _Db()
    erst = _Sync(_Client(seiten), db).live_feed_nachziehen()
    zweit = _Sync(_Client(seiten), db).live_feed_nachziehen()
    assert erst["neu"] == 1
    assert zweit == {"gesehen": 1, "neu": 0, "uebersprungen": 1}
    assert len(db.gespeichert) == 1


def test_unique_index_faengt_gleichzeitigen_lauf():
    """Wenn zwei Ticks gleichzeitig prüfen, entscheidet der Index — nicht wir.

    Hier ist die Vorprüfung leer (der andere Lauf hat noch nicht geschrieben),
    aber der Insert schlägt fehl. Das Ergebnis muss „nicht neu" sein, nicht ein
    Absturz des Ticks.
    """
    db = _Db()
    tabelle_bekannt = db.bekannt

    class _Rennen(_Sync):
        def _journal_ereignis_bekannt(self, tenant_id, live_id):  # noqa: ARG002
            tabelle_bekannt.add(live_id)  # der andere Lauf war schneller
            return False

    ergebnis = _Rennen(
        _Client([_seite([_ereignis("ev1", "review", "P1")], 1)]), db
    ).live_feed_nachziehen()
    assert ergebnis == {"gesehen": 1, "neu": 0, "uebersprungen": 1}
    assert db.gespeichert == []


def test_fremdes_objekt_wird_nicht_uebernommen():
    """Wurzel 3: das Channex-Konto ist kontoweit — fremde Ereignisse bleiben fremd."""
    client = _Client([
        _seite(
            [
                _ereignis("ev1", "review", "P1"),
                _ereignis("ev2", "review", "FREMD"),
                _ereignis("ev3", "sync_error", None),
            ],
            3,
        )
    ])
    db = _Db()
    ergebnis = _Sync(client, db).live_feed_nachziehen()
    assert ergebnis == {"gesehen": 3, "neu": 1, "uebersprungen": 2}
    assert [z["live_feed_event_id"] for z in db.gespeichert] == ["ev1"]


def test_severity_wie_beim_webhook():
    """Eine Quelle, eine Bedeutung: Journal und Webhook ordnen gleich ein."""
    client = _Client([
        _seite(
            [
                _ereignis("e1", "sync_error", "P1"),
                _ereignis("e2", "reservation_request", "P1"),
                _ereignis("e3", "review", "P1"),
            ],
            3,
        )
    ])
    db = _Db()
    _Sync(client, db).live_feed_nachziehen()
    nach_id = {z["live_feed_event_id"]: z["severity"] for z in db.gespeichert}
    assert nach_id == {"e1": "error", "e2": "action", "e3": "info"}


def test_ereignis_ohne_id_wird_uebersprungen():
    """Ohne Ereignis-ID ist keine Antwort an Airbnb möglich — nicht speichern."""
    kaputt = _ereignis("ev1", "review", "P1")
    kaputt["id"] = None
    kaputt["attributes"]["id"] = None
    db = _Db()
    ergebnis = _Sync(_Client([_seite([kaputt], 1)]), db).live_feed_nachziehen()
    assert ergebnis["neu"] == 0
    assert db.gespeichert == []


def test_blaettert_bis_total_erreicht():
    """Zwei Seiten, dann Schluss — nicht endlos weiterfragen."""
    seite1 = _seite([_ereignis(f"a{i}", "review", "P1") for i in range(100)], 150)
    seite2 = _seite([_ereignis(f"b{i}", "review", "P1") for i in range(50)], 150)
    client = _Client([seite1, seite2])
    db = _Db()
    ergebnis = _Sync(client, db).live_feed_nachziehen()
    assert ergebnis["gesehen"] == 150
    assert client.aufrufe == [1, 2]


def test_leere_seite_beendet_den_lauf():
    client = _Client([_seite([], 0)])
    ergebnis = _Sync(client, _Db()).live_feed_nachziehen()
    assert ergebnis == {"gesehen": 0, "neu": 0, "uebersprungen": 0}
    assert client.aufrufe == [1]


def test_property_id_neben_dem_payload():
    """Airbnbs Dokument zeigt `property_id` NEBEN `payload` — beide Orte gelten."""
    ereignis = _ereignis("ev1", "review", None)
    ereignis["attributes"]["property_id"] = "P1"
    db = _Db()
    ergebnis = _Sync(_Client([_seite([ereignis], 1)]), db).live_feed_nachziehen()
    assert ergebnis["neu"] == 1
