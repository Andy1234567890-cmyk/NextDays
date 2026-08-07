"""Der Nachrichten-Eingang (0305) — die Stelle, an der 07.08.2026 nichts ankam.

Geprüft wird das Verhalten, das die drei damaligen Brüche verhindert:
gespeichert wird OHNE Zutun eines Nutzers, mit dem Zeitpunkt des PORTALS, und
mit dem inhaltsfreien Signal, an dem die UI den Eingang merkt.

Die Payload-Form stammt aus echten Ereignissen des Produktivkontos
(`channex_webhook_event`, siehe Modul-Docstring von `nachrichten_eingang`).
"""
from typing import Any

import pytest

from src.features.channel_manager.common import NUR_ANHANG_TEXT
from src.features.channel_manager.nachrichten_eingang import (
    NachrichtenEingangMixin,
    geprueft,
)

TENANT = "11111111-1111-1111-1111-111111111111"
THREAD = "22222222-2222-2222-2222-222222222222"
BUCHUNG = "484c66f1-8bba-478e-8678-8a415f1f0cba"


def payload(**patch: Any) -> dict[str, Any]:
    """Eine echte Gastnachricht, wie Channex sie liefert."""
    roh = {
        "id": "d17f69e4-bb40-44bb-a00c-cf1f78201e93",
        "meta": {"name": "Mathias", "role": "GUEST"},
        "sender": "guest",
        "message": "Guten Morgen liebe Jeanine,",
        "booking_id": BUCHUNG,
        "inserted_at": "2026-08-07T07:53:44.000000",
        "ota_message_id": "32120138668",
        "have_attachment": False,
        "message_thread_id": "d3082659-7403-4f2c-bae7-4fd19fa48357",
    }
    roh.update(patch)
    return roh


class _FakeQuery:
    def __init__(self, name: str, protokoll: list, treffer: list) -> None:
        self._name = name
        self._protokoll = protokoll
        self._treffer = treffer
        self._patch: dict | None = None
        self._filter: dict = {}

    def select(self, *_a: Any, **_k: Any) -> "_FakeQuery":
        return self

    def eq(self, spalte: str, wert: Any) -> "_FakeQuery":
        self._filter[spalte] = wert
        return self

    def or_(self, ausdruck: str) -> "_FakeQuery":
        self._filter["or"] = ausdruck
        return self

    def limit(self, *_a: Any, **_k: Any) -> "_FakeQuery":
        return self

    def upsert(self, zeile: dict, **kw: Any) -> "_FakeQuery":
        self._protokoll.append(("upsert", self._name, zeile, kw))
        return self

    def update(self, patch: dict) -> "_FakeQuery":
        self._patch = patch
        return self

    def execute(self) -> Any:
        if self._patch is not None:
            self._protokoll.append(
                ("update", self._name, self._patch, dict(self._filter))
            )
        return type("R", (), {"data": self._treffer})()


class _FakeDB:
    def __init__(self, *, buchung_bekannt: bool = True) -> None:
        self.protokoll: list = []
        self._buchung_bekannt = buchung_bekannt

    def table(self, name: str) -> _FakeQuery:
        treffer = (
            [{"id": THREAD}]
            if name == "channex_booking" and self._buchung_bekannt
            else []
        )
        return _FakeQuery(name, self.protokoll, treffer)


class _Dienst(NachrichtenEingangMixin):
    def __init__(self, db: _FakeDB | None) -> None:
        self._db = db  # type: ignore[assignment]


def upserts(db: _FakeDB) -> list[dict]:
    return [e[2] for e in db.protokoll if e[0] == "upsert"]


def updates(db: _FakeDB) -> list[tuple[dict, dict]]:
    """Alle update()-Aufrufe als (patch, filter)."""
    return [(e[2], e[3]) for e in db.protokoll if e[0] == "update"]


def signale(db: _FakeDB) -> list[tuple[dict, dict]]:
    """Nur die Updates am Thread-Signal (`channex_booking`) — nach Tabelle
    gefiltert, nicht nach Position: der Eingang schreibt auch `portal_messages`
    (Vorgeschichte umhaengen), und die Reihenfolge ist kein Vertrag."""
    return [
        (e[2], e[3]) for e in db.protokoll
        if e[0] == "update" and e[1] == "channex_booking"
    ]


def test_gastnachricht_wird_gespeichert_ohne_zutun() -> None:
    """Der Kern: eine eingehende Nachricht liegt in der DB, bevor jemand klickt.

    Vor 0305 war der einzige Schreiber das Öffnen des Threads im UI.
    """
    db = _FakeDB()
    thread = _Dienst(db).nachricht_spiegeln(TENANT, payload())

    assert thread == THREAD
    (zeile,) = upserts(db)
    assert zeile["tenant_id"] == TENANT
    assert zeile["thread_ref"] == THREAD
    assert zeile["sender"] == "guest"
    assert zeile["body"] == "Guten Morgen liebe Jeanine,"


def test_zeitpunkt_kommt_vom_portal_nicht_von_unserer_uhr() -> None:
    """Wurzel 5b: 07:53:44 UTC ist die Zeit BEIM PORTAL (dort „9:53" in CEST).

    Der Wert wird mit Zonenkennung gespeichert — ohne sie deutet der Browser
    ihn als Ortszeit und verschiebt die Nachricht um zwei Stunden.
    """
    db = _FakeDB()
    _Dienst(db).nachricht_spiegeln(TENANT, payload())

    (zeile,) = upserts(db)
    assert zeile["sent_at"] == "2026-08-07T07:53:44.000000Z"


def test_ohne_zeitpunkt_wird_verworfen_statt_datiert() -> None:
    """Wurzel 4/5b: lieber gar nicht speichern als mit unserer Uhr erfinden."""
    db = _FakeDB()
    assert _Dienst(db).nachricht_spiegeln(TENANT, payload(inserted_at=None)) is None
    assert upserts(db) == []


def test_webhook_und_journal_liefern_dasselbe_ergebnis() -> None:
    """Wurzel 2: beide Wege, eine Übersetzungsstelle, identische Zeile.

    Der Webhook verpackt die Nachricht in `payload`, das Journal legt sie flach
    ab. Käme dabei Verschiedenes heraus, stünde dieselbe Nachricht doppelt im
    Verlauf — der UNIQUE greift nur bei gleichem `message_ref`.
    """
    flach, verpackt = _FakeDB(), _FakeDB()
    _Dienst(flach).nachricht_spiegeln(TENANT, payload())
    _Dienst(verpackt).nachricht_spiegeln(TENANT, {"event": "message", "payload": payload()})

    assert upserts(flach) == upserts(verpackt)


def test_identitaet_ist_die_id_die_beide_quellen_kennen() -> None:
    """Wurzel 2: `id`, NICHT `ota_message_id` — sonst steht alles doppelt.

    Der Verlaufs-Abruf (`GET bookings/:id/messages`) liefert nur `id`. Nähme
    der Eingang `ota_message_id`, trüge dieselbe Nachricht je nach Weg zwei
    Schlüssel und der UNIQUE griffe nicht. Live passiert: 8 von 30 Nachrichten
    lagen doppelt in der Tabelle.
    """
    db = _FakeDB()
    _Dienst(db).nachricht_spiegeln(TENANT, payload())

    (_, _, zeile, kw) = next(e for e in db.protokoll if e[0] == "upsert")
    assert zeile["message_ref"] == "d17f69e4-bb40-44bb-a00c-cf1f78201e93"
    assert kw["on_conflict"] == "tenant_id,message_ref"
    # Die Portal-ID geht nicht verloren, sie ist nur nicht der Schlüssel.
    assert zeile["raw"]["ota_message_id"] == "32120138668"


def test_nachzuegler_markiert_trotzdem_ungelesen() -> None:
    """Der Zeitstempel-Guard darf die Ungelesen-Markierung nicht mitnehmen.

    Lägen beide im selben Patch, hätte eine nachgereichte ältere Gastnachricht
    (das Journal garantiert keine Reihenfolge) den Thread gelesen aussehen
    lassen, obwohl der Gast geschrieben hat.
    """
    db = _FakeDB()
    _Dienst(db).nachricht_spiegeln(TENANT, payload())

    patches = [p for p, _ in signale(db)]
    assert {"last_message_at": "2026-08-07T07:53:44.000000Z"} in patches
    assert {"is_read": False} in patches
    # Nur der Zeitstempel trägt den Monotonie-Guard.
    guards = [f.get("or") for _, f in signale(db)]
    assert sum(1 for g in guards if g) == 1


@pytest.mark.parametrize(
    "boese",
    [
        "2026-01-01Z),is_read.eq.true,(tenant_id.not.is.null",
        "2026-01-01T00:00:00Z,foo.eq.bar",
        "morgen",
    ],
)
def test_zeitstempel_injection_wird_abgewiesen(boese: str) -> None:
    """Wurzel 8: `sent_at` landet in einem PostgREST-Filter, der NICHT maskiert.

    Der Wert stammt aus der Portal-Payload — also aus zweiter Hand vom
    Angreifer. Was nicht wie ein Zeitstempel aussieht, kommt gar nicht erst
    bis zum Filter.
    """
    db = _FakeDB()
    assert _Dienst(db).nachricht_spiegeln(TENANT, payload(inserted_at=boese)) is None
    assert upserts(db) == []
    assert updates(db) == []


def test_gastnachricht_setzt_signal_und_ungelesen() -> None:
    """Das Realtime-Signal (0305) — daran merkt die UI den Eingang."""
    db = _FakeDB()
    _Dienst(db).nachricht_spiegeln(TENANT, payload())

    (patch, filt) = signale(db)[0]
    assert patch["last_message_at"] == "2026-08-07T07:53:44.000000Z"
    assert filt["tenant_id"] == TENANT  # Wurzel 3
    assert filt["id"] == THREAD
    # Jeder Schreibvorgang ist tenant-gescopt, auch der zweite.
    assert all(f["tenant_id"] == TENANT for _, f in updates(db))


def test_eigene_antwort_macht_thread_nicht_ungelesen() -> None:
    """Wurzel 1: `is_read=false` gehört zum Eingang, nicht zum eigenen Senden."""
    db = _FakeDB()
    _Dienst(db).nachricht_spiegeln(TENANT, payload(sender="property"))

    patches = [p for p, _ in signale(db)]
    assert {"last_message_at": "2026-08-07T07:53:44.000000Z"} in patches
    assert all("is_read" not in p for p in patches)


def test_signal_geht_nie_rueckwaerts() -> None:
    """Das Journal garantiert keine Reihenfolge — eine ältere Nachricht darf
    den Thread nicht zurückdatieren."""
    db = _FakeDB()
    _Dienst(db).nachricht_spiegeln(TENANT, payload())

    (_, filt) = signale(db)[0]
    assert filt["or"] == (
        "last_message_at.is.null,last_message_at.lt.2026-08-07T07:53:44.000000Z"
    )


def test_support_nachricht_ohne_buchung_wird_gespeichert() -> None:
    """Airbnb-Support (`booking_id: null`): speichern, aber keinen Thread melden.

    Real vorgekommen am 07.08.2026. Die Nachricht ist echt und darf nicht
    verloren gehen, hängt aber an keiner Buchung — und die Thread-Liste zeigt
    nur Buchungen.
    """
    db = _FakeDB()
    thread = _Dienst(db).nachricht_spiegeln(
        TENANT, payload(booking_id=None, sender="property")
    )

    assert thread is None
    (zeile,) = upserts(db)
    assert zeile["booking_ref"] is None
    assert zeile["thread_ref"] == zeile["portal_thread_ref"]
    assert updates(db) == []  # kein Signal ohne Thread


def test_unbekannte_buchung_speichert_am_portal_thread() -> None:
    """Buchung (noch) nicht importiert: die Nachricht bleibt trotzdem erhalten."""
    db = _FakeDB(buchung_bekannt=False)
    assert _Dienst(db).nachricht_spiegeln(TENANT, payload()) is None

    (zeile,) = upserts(db)
    assert zeile["booking_ref"] == BUCHUNG
    assert zeile["thread_ref"] == "d3082659-7403-4f2c-bae7-4fd19fa48357"


def test_reine_anhang_nachricht_wird_gespiegelt() -> None:
    """Nur ein Foto, kein Text: die Nachricht ist echt und muss in die Tabelle.

    Vorher wurde sie verworfen — die Thread-Liste zeigte dann die VORLETZTE
    Nachricht als neueste, und der Eingang löste keine Folgeaktion aus. `body`
    ist NOT NULL, deshalb steht dort ein sprachneutrales Kürzel statt eines
    erfundenen Satzes (Wurzel 4); die echten Bild-URLs liefert der Verlauf.
    """
    db = _FakeDB()
    ergebnis = _Dienst(db).nachricht_spiegeln(
        TENANT, payload(message="", have_attachment=True)
    )

    assert ergebnis is not None
    (zeile,) = upserts(db)
    assert zeile["body"] == NUR_ANHANG_TEXT


def test_ohne_text_und_ohne_anhang_uebersprungen() -> None:
    """Weder Text noch Bild — dann gibt es nichts zu zeigen, und ein leerer
    `body` kippte den Upsert mit 23502 (NOT NULL)."""
    db = _FakeDB()
    ergebnis = _Dienst(db).nachricht_spiegeln(
        TENANT, payload(message="", have_attachment=False)
    )

    assert ergebnis is None
    assert upserts(db) == []


@pytest.mark.parametrize("sender", ["", "ava_bot", "HOST", None])
def test_unbekannter_absender_wird_nicht_geraten(sender: object) -> None:
    """Ein falscher Absender macht aus der eigenen Antwort eine ungelesene
    Gastnachricht — lieber ablehnen und im Log sehen (Wurzel 4)."""
    assert geprueft(payload(sender=sender)) is None


def test_system_nachricht_kommt_durch_ohne_ungelesen() -> None:
    """`sender: "system"` trägt Airbnb-Anfragen (Channex-Doku) — speichern.

    Sie ist keine Gastnachricht: der Thread wird dadurch nicht ungelesen.
    """
    db = _FakeDB()
    _Dienst(db).nachricht_spiegeln(TENANT, payload(sender="system"))

    (zeile,) = upserts(db)
    assert zeile["sender"] == "system"
    assert {"is_read": False} not in [p for p, _ in signale(db)]


def test_vorgeschichte_wandert_zur_spaeter_gebuchten_reservierung() -> None:
    """Anfrage VOR der Buchung: sobald die Buchung da ist, gehört der frühere
    Verlauf an ihren Thread — sonst beginnt er mitten im Gespräch."""
    db = _FakeDB()
    _Dienst(db).nachricht_spiegeln(TENANT, payload())

    umhaengen = [
        (p, f) for p, f in updates(db) if p.get("thread_ref") == THREAD
    ]
    assert len(umhaengen) == 1
    (_, filt) = umhaengen[0]
    assert filt["tenant_id"] == TENANT  # Wurzel 3
    # Nur Zeilen, die noch am Portal-Thread hängen — nichts anderes anfassen.
    assert filt["portal_thread_ref"] == filt["thread_ref"]


def test_ohne_datenbank_passiert_nichts() -> None:
    """Der Dienst läuft auch ohne DB-Client (Worker-Start, Tests)."""
    assert _Dienst(None).nachricht_spiegeln(TENANT, payload()) is None
