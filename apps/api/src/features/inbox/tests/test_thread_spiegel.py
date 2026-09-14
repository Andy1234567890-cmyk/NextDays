"""Jede Buchung wird ein Thread — und die Ausnahmen davon.

Was hier geprüft wird, ist der Grund, warum Direktbuchungen jahrelang keine
Automail bekommen haben: es gab keine Zeile in `channex_booking`, und die
Planung sieht ausschließlich dorthin. Die Prüfungen decken beide Richtungen ab
(Wurzel 1): der Thread entsteht, und er geht bei einer Stornierung auf
'cancelled' — sonst begrüßt die Anreise-Automail einen Gast, der abgesagt hat.
"""
from __future__ import annotations

from typing import Any

from src.features.inbox import thread_spiegel

from .test_planung_zusammenspiel import FakeDB, regel


def reservierung(**felder: Any) -> dict:
    return {
        "id": "res-1",
        "tenant_id": "t1",
        "property_id": "p1",
        "guest_id": "g1",
        "channel": "direct",
        "ota_name": None,
        "status": "confirmed",
        "check_in": "2026-10-10",
        "check_out": "2026-10-14",
        "booked_at": "2026-09-01T08:00:00+00:00",
        "created_at": "2026-09-02T09:00:00+00:00",
        "total_amount": 480.50,
        "currency": "DKK",
        "guest_email": "ida@example.dk",
        "guest_phone": "+45 12 34 56 78",
        "guest_language": "da",
        "is_owner_stay": False,
        "stay_name": None,
        "source_channex_booking_id": None,
        "guests": {"name": "Ida Hansen", "email": "alt@example.dk", "phone": None},
        "owners": None,
        **felder,
    }


def _db(res: dict, **extra: list[dict]) -> FakeDB:
    basis: dict[str, list[dict]] = {
        "reservations": [res],
        "channex_booking": [],
        "properties": [{"id": "p1", "tenant_id": "t1", "timezone": "Europe/Copenhagen"}],
        "message_automation": [],
        "message_automation_text": [],
        "tenant_message_language": [],
        "automation_scheduled_message": [],
        "users": [],
    }
    basis.update(extra)
    return FakeDB(**basis)


# --- Die Zeile selbst --------------------------------------------------------
def test_direktbuchung_wird_zum_thread() -> None:
    db = _db(reservierung())
    thread_id = thread_spiegel.spiegeln(db, "t1", "res-1", quelle="direkt")
    zeile = db.rows("channex_booking")[0]
    assert thread_id == zeile["id"]
    # Der Dedup-Schlüssel ist die eigene Reservierungs-ID (Wurzel 2).
    assert zeile["channex_booking_id"] == "res-1"
    assert zeile["ota_name"] == "Direkt"
    assert zeile["status"] == "new"
    assert (zeile["arrival_date"], zeile["departure_date"]) == (
        "2026-10-10", "2026-10-14",
    )
    # Der Zeitpunkt der BUCHUNG, nicht unsere Verarbeitung (Wurzel 5b).
    assert zeile["booked_at"] == "2026-09-01T08:00:00+00:00"
    # Dezimal → Cent: sonst stünde im Posteingang das Hundertfache.
    assert zeile["amount_cents"] == 48050
    assert zeile["raw"] == {"source": "direkt"}


def test_gastdaten_kommen_vollstaendig_mit() -> None:
    db = _db(reservierung())
    thread_spiegel.spiegeln(db, "t1", "res-1", quelle="direkt")
    customer = db.rows("channex_booking")[0]["customer"]
    assert (customer["name"], customer["surname"]) == ("Ida", "Hansen")
    # Die Spalte der Reservierung gewinnt über die Gästekartei.
    assert customer["mail"] == "ida@example.dk"
    assert customer["language"] == "da"


def test_ohne_gastsprache_wird_keine_behauptet() -> None:
    """Wurzel 4: ein leeres `language` gälte in `_customer_of` als gesetzt und
    der Gast bekäme dauerhaft die Standardfassung."""
    db = _db(reservierung(guest_language=None))
    thread_spiegel.spiegeln(db, "t1", "res-1", quelle="direkt")
    assert "language" not in db.rows("channex_booking")[0]["customer"]


def test_kanalnamen_je_vertriebsweg() -> None:
    assert thread_spiegel.ota_name_fuer("direct", None) == "Direkt"
    assert thread_spiegel.ota_name_fuer("website", None) == "Website"
    # Der eigene Marktplatz heißt myBestDays — nie „Direkt" (Markengrenze).
    assert thread_spiegel.ota_name_fuer("portal", None) == "myBestDays"
    # Fremde Kanäle behalten ihren Portalnamen.
    assert thread_spiegel.ota_name_fuer("booking", "Booking.com") == "Booking.com"
    assert thread_spiegel.ota_name_fuer("airbnb", None) == "airbnb"


def test_marktplatzbuchung_traegt_mybestdays() -> None:
    db = _db(reservierung(channel="portal", ota_name="myBestDays"))
    thread_spiegel.spiegeln(db, "t1", "res-1", quelle="booking_engine")
    assert db.rows("channex_booking")[0]["ota_name"] == "myBestDays"


# --- Idempotenz --------------------------------------------------------------
def test_zweiter_aufruf_legt_keine_zweite_konversation_an() -> None:
    """Retry, Doppelklick, nächste Änderung — alles derselbe Thread (Wurzel 2)."""
    db = _db(reservierung())
    erst = thread_spiegel.spiegeln(db, "t1", "res-1", quelle="direkt")
    zweit = thread_spiegel.spiegeln(db, "t1", "res-1", quelle="direkt")
    assert erst == zweit
    assert len(db.rows("channex_booking")) == 1


# --- Gegenzustand Storno -----------------------------------------------------
def test_storno_setzt_den_thread_auf_cancelled_und_raeumt_ab() -> None:
    db = _db(
        reservierung(status="cancelled"),
        channex_booking=[
            {
                "id": "th1", "tenant_id": "t1", "channex_booking_id": "res-1",
                "property_id": "p1", "status": "new", "ota_name": "Direkt",
                "arrival_date": "2026-10-10", "departure_date": "2026-10-14",
                "booked_at": "2026-09-01T08:00:00+00:00",
            }
        ],
        message_automation=[regel()],
        automation_scheduled_message=[
            {
                "id": "s1", "tenant_id": "t1", "automation_id": "a1",
                "thread_id": "th1", "status": "pending",
            }
        ],
    )
    thread_spiegel.spiegeln(db, "t1", "res-1", quelle="direkt")
    assert db.rows("channex_booking")[0]["status"] == "cancelled"
    # Erst der Thread-Status lässt `_offene_stornieren` greifen.
    assert db.rows("automation_scheduled_message")[0]["status"] == "cancelled"


# --- Wer NICHT gespiegelt wird ----------------------------------------------
def test_ota_buchung_wird_nicht_doppelt_gespiegelt() -> None:
    """Hinter einer Channex-Kennung steht bereits ein Thread aus `bookings_sync`.
    Eine zweite Zeile daneben wäre eine zweite Konversation — und doppelte
    Automails."""
    db = _db(reservierung(source_channex_booking_id="cbk-77", channel="booking"))
    assert thread_spiegel.spiegeln(db, "t1", "res-1", quelle="direkt") is None
    assert db.rows("channex_booking") == []


def test_csv_uebernahme_wird_gespiegelt() -> None:
    """Der CSV-Import trägt zwar eine `source_channex_booking_id`, hinter ihr
    steht aber kein Channex-Thread — sie beginnt mit `csv:`."""
    db = _db(reservierung(source_channex_booking_id="csv:abc"))
    assert thread_spiegel.spiegeln(db, "t1", "res-1", quelle="uebernahme")
    assert db.rows("channex_booking")[0]["raw"] == {"source": "uebernahme"}


def test_eigennutzung_bekommt_thread_aber_keine_automails() -> None:
    """Ein Eigentümer-Aufenthalt hat keinen Gast: „Wir freuen uns auf Sie" wäre
    falsch, und ohne Mailadresse endete jede Automail als Zustellproblem."""
    db = _db(
        reservierung(
            is_owner_stay=True, stay_name="Tochter Lisa",
            guest_id=None, guest_email=None, guests=None,
            owners={"name": "Ole Jensen"},
        ),
        message_automation=[regel()],
    )
    thread_spiegel.spiegeln(db, "t1", "res-1", quelle="sperrantrag")
    zeile = db.rows("channex_booking")[0]
    assert zeile["customer"]["name"] == "Tochter"
    assert zeile["customer"]["surname"] == "Lisa"
    assert db.rows("automation_scheduled_message") == []


def test_fremde_reservierung_wird_nicht_gespiegelt() -> None:
    """Wurzel 3: geladen wird immer mit tenant_id — der Service-Role-Key umgeht
    RLS, ein Load allein per ID wäre eine offene Mandantengrenze."""
    db = _db(reservierung(tenant_id="t2"))
    assert thread_spiegel.spiegeln(db, "t1", "res-1", quelle="direkt") is None


def test_best_effort_kippt_den_aufrufer_nicht() -> None:
    class _Kaputt:
        def table(self, _name: str) -> Any:
            raise RuntimeError("DB weg")

    # Kein Fehler nach außen — die Buchung ist an dieser Stelle committet.
    thread_spiegel.spiegeln_best_effort(_Kaputt(), "t1", "res-1", quelle="direkt")


# --- Die Weiche des Versands -------------------------------------------------
def test_eigener_thread_wird_an_quelle_und_kanal_erkannt() -> None:
    assert thread_spiegel.ist_eigener_thread({"raw": {"source": "direkt"}})
    assert thread_spiegel.ist_eigener_thread({"raw": {"source": "booking_engine"}})
    # Altbestand ohne `raw.source`: der Kanalname trägt die Aussage.
    assert thread_spiegel.ist_eigener_thread({"ota_name": "myBestDays"})
    assert thread_spiegel.ist_eigener_thread({"ota_name": "Website"})
    # Ein Portal-Thread bleibt beim Channex-Chat.
    assert not thread_spiegel.ist_eigener_thread(
        {"ota_name": "Booking.com", "raw": {"customer": {}}}
    )
    assert not thread_spiegel.ist_eigener_thread({})
