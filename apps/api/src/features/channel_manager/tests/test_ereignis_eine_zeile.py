"""Ein Channex-Ereignis = EINE Zeile, in EINER Nutzlast-Form (Wurzel 2).

DER GEMESSENE BEFUND (Staging-DB, 24.08.2026), der diese Tests erzwungen hat:
jedes Ereignis lag ZWEIMAL in `channex_webhook_event`, in zwei verschiedenen
Formen, Minuten auseinander:

    created_at           event        log_id / booking_id   form
    2026-08-24 06:06:49  booking_new  ca38f839-…            flach
    2026-08-24 06:03:46  booking_new  ca38f839-…            verschachtelt
    2026-08-24 00:04:40  sync_error   1d327d14-…            flach
    2026-08-24 00:02:55  sync_error   1d327d14-…            verschachtelt

Ueber alle Ereignisse: 338 `review`-Zeilen fuer 179 Ereignisse, 213
`booking_new` fuer 105 — 284 Doppelpaare. Der Betrieb sah jeden Fehler und jede
Buchung doppelt und musste beides einzeln quittieren.

URSACHE: zwei Schreibwege mit zwei Formen.
  * `channels._persist_webhook_event` legte den ganzen Channex-UMSCHLAG
    `{event, payload:{…}, user_id, timestamp, property_id}` als `payload` ab und
    liess die Spalte `live_feed_event_id` leer — die ID steckte im Umschlag.
  * `live_feed_sync._journal_ereignis_spiegeln` legt nur den INHALT flach ab und
    setzt die Spalte.
Der partielle UNIQUE-Index aus 0284 liest die SPALTE. Die Webhook-Zeile liess
sie leer, fiel aus dem Index-Praedikat und kollidierte nie.
"""
from __future__ import annotations

from typing import Any

from src.features.channel_manager.channels import ChannelsMixin

# Die Ereignis-ID, die BEIDE Wege kennen — der fachliche Schluessel.
LIVE_ID = "1d327d14-8720-4329-845d-486b04c17dba"

# So kommt es am Webhook an: der komplette Umschlag (live gemessene Form).
UMSCHLAG: dict[str, Any] = {
    "event": "sync_error",
    "property_id": "P1",
    "user_id": "u-1",
    "timestamp": "2026-08-24T00:02:55Z",
    "payload": {
        "live_feed_event_id": LIVE_ID,
        "log_id": LIVE_ID,
        "channel_id": "kanal-7",
        "error_type": "rate_not_found",
    },
}

# So kommt derselbe Vorgang aus dem Journal-Tick: nur der Inhalt, flach.
INHALT: dict[str, Any] = dict(UMSCHLAG["payload"])


class _Tabelle:
    """Nur `channex_webhook_event`; andere Tabellen schlucken ihre Zeilen.

    Der Tabellenname wird mitgefuehrt, weil `_persist_webhook_event` ausser der
    Ereigniszeile auch eine Verlaufszeile schreibt (`worker_verlauf.merken` →
    `worker_ereignis`). Landete die im selben Speicher, zaehlte jeder Test einen
    Doppelten, den es nicht gibt.
    """

    def __init__(self, db: _Db, name: str):
        self._db = db
        self._name = name
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

        if self._name != "channex_webhook_event":
            return _Res([])

        if self._insert is not None:
            live_id = self._insert.get("live_feed_event_id")
            # So verhaelt sich der partielle UNIQUE-Index aus 0284: er greift
            # NUR bei gesetzter Spalte. Zeilen ohne ID kollidieren nicht.
            if live_id is not None and any(
                z.get("live_feed_event_id") == live_id for z in self._db.gespeichert
            ):
                raise RuntimeError(
                    "duplicate key value violates unique constraint "
                    "(23505) channex_webhook_event_live_feed_uniq"
                )
            self._db.gespeichert.append(self._insert)
            return _Res([self._insert])

        gesucht = self._filter.get("live_feed_event_id")
        treffer = [
            z for z in self._db.gespeichert
            if z.get("live_feed_event_id") == gesucht
        ]
        return _Res(treffer[:1])


class _Db:
    def __init__(self) -> None:
        self.gespeichert: list[dict[str, Any]] = []

    def table(self, name: str):
        return _Tabelle(self, name)

    def rpc(self, *_a, **_k):  # worker_verlauf.merken laeuft best effort
        raise RuntimeError("kein Verlauf im Test")


class _Dienst(ChannelsMixin):
    """Nur der Persistenz-Pfad; Event-Klassen wie in der echten Klasse."""

    _ERROR_EVENTS = frozenset({"sync_error", "general_error"})
    _ACTION_EVENTS = frozenset({"inquiry", "alteration_request"})

    def __init__(self, db: _Db) -> None:
        self._db = db


def _schreibe(dienst: _Dienst, event: str, payload: dict[str, Any]) -> None:
    dienst._persist_webhook_event(  # noqa: SLF001 — genau dieser Pfad ist geprueft
        event, payload, tenant_id="T1", property_id="objekt-1"
    )


def test_beide_formen_desselben_ereignisses_ergeben_eine_zeile() -> None:
    """DER GEMESSENE ZUSTAND: verschachtelt + flach = EINE Zeile.

    Genau das lag live doppelt vor (sync_error 1d327d14-…, zwei Zeilen zwei
    Minuten auseinander). Reihenfolge wie live: der Umschlag kam zuerst.
    """
    db = _Db()
    dienst = _Dienst(db)

    _schreibe(dienst, "sync_error", UMSCHLAG)
    _schreibe(dienst, "sync_error", INHALT)

    assert len(db.gespeichert) == 1, db.gespeichert
    # Und zwar in der FLACHEN Form — der Umschlag ist ausgepackt.
    zeile = db.gespeichert[0]
    assert zeile["payload"] == INHALT
    assert "event" not in zeile["payload"]
    assert zeile["live_feed_event_id"] == LIVE_ID


def test_umgekehrte_reihenfolge_ebenfalls_eine_zeile() -> None:
    """Der Journal-Tick kann zuerst dran sein — dann gilt dasselbe."""
    db = _Db()
    dienst = _Dienst(db)

    _schreibe(dienst, "sync_error", INHALT)
    _schreibe(dienst, "sync_error", UMSCHLAG)

    assert len(db.gespeichert) == 1, db.gespeichert
    assert db.gespeichert[0]["payload"] == INHALT


def test_umschlag_allein_wird_ausgepackt_gespeichert() -> None:
    """Nur der Webhook: eine Zeile, Inhalt flach, ID in der SPALTE.

    Die Spalte ist der Kern — sie liess der Webhook-Pfad leer, weshalb der
    UNIQUE-Index aus 0284 nie griff.
    """
    db = _Db()
    _schreibe(_Dienst(db), "sync_error", UMSCHLAG)

    assert len(db.gespeichert) == 1
    zeile = db.gespeichert[0]
    assert zeile["payload"] == INHALT
    assert zeile["live_feed_event_id"] == LIVE_ID
    assert zeile["severity"] == "error"
    # Die Umschlag-Felder gehoeren in ihre eigenen Spalten, nicht in payload.
    assert zeile["event"] == "sync_error"
    assert zeile["property_id"] == "objekt-1"


def test_flache_form_allein_bleibt_unveraendert() -> None:
    """Nur der Journal-Tick: eine Zeile, nichts umgebaut."""
    db = _Db()
    _schreibe(_Dienst(db), "sync_error", INHALT)

    assert len(db.gespeichert) == 1
    assert db.gespeichert[0]["payload"] == INHALT
    assert db.gespeichert[0]["live_feed_event_id"] == LIVE_ID


def test_ereignisse_ohne_schluessel_werden_nicht_zusammengeworfen() -> None:
    """Der partielle Index darf nicht alles kollidieren lassen.

    `activate_channel`/`disconnect_listing` (live 41 bzw. 5 Zeilen) tragen KEINE
    Ereignis-ID — sie kommen nur per Webhook, nie ueber das Journal, also gibt
    es dort auch kein Doppel. Ein VOLLER UNIQUE haette sie alle gegeneinander
    kollidieren lassen und ab der zweiten Zeile stillschweigend verschluckt.
    """
    db = _Db()
    dienst = _Dienst(db)

    for kanal in ("kanal-1", "kanal-2", "kanal-3"):
        _schreibe(dienst, "activate_channel", {"channel_id": kanal})

    assert len(db.gespeichert) == 3
    assert all("live_feed_event_id" not in z for z in db.gespeichert)


def test_redelivery_verliert_den_quittierten_zustand_nicht() -> None:
    """Ein quittierter Fehler springt bei Redelivery NICHT auf „offen" (Wurzel 1).

    Channex wiederholt bis ~24 h. Kam die Redelivery, nachdem der Betrieb den
    Fehler abgehakt hat, darf sie den Stand nicht ueberschreiben — sonst liegt
    dieselbe Arbeit wieder auf dem Tisch. Deshalb wird die vorhandene Zeile
    STEHEN GELASSEN, nicht aktualisiert.
    """
    db = _Db()
    dienst = _Dienst(db)

    _schreibe(dienst, "sync_error", UMSCHLAG)
    # Der Betrieb quittiert.
    db.gespeichert[0]["resolved"] = True
    db.gespeichert[0]["resolution"] = {"note": "Rate neu gemappt"}

    # Redelivery auf BEIDEN Wegen.
    _schreibe(dienst, "sync_error", UMSCHLAG)
    _schreibe(dienst, "sync_error", INHALT)

    assert len(db.gespeichert) == 1
    assert db.gespeichert[0]["resolved"] is True
    assert db.gespeichert[0]["resolution"] == {"note": "Rate neu gemappt"}


def test_ereignis_id_auch_ohne_inneren_payload_gefunden() -> None:
    """Die ID steht im Umschlag — auch wenn `payload` fehlt oder kein Objekt ist.

    `_live_feed_event_id` wird deshalb ZWEIMAL befragt: einmal auf dem Umschlag,
    einmal auf dem ausgepackten Inhalt. Kein erfundener Ersatzwert (Wurzel 4).
    """
    db = _Db()
    _schreibe(
        _Dienst(db),
        "review",
        {"event": "review", "live_feed_event_id": LIVE_ID, "payload": None},
    )

    assert len(db.gespeichert) == 1
    assert db.gespeichert[0]["live_feed_event_id"] == LIVE_ID
