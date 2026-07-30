"""Tests für den support-Slice (Ticket-Eingang des Melders).

Zwei Dinge entscheiden hier über Datenschutz und Mandantentrennung:
  1. interne Team-Notizen dürfen den Melder NIE erreichen,
  2. ein Melder sieht ausschließlich seine EIGENEN Tickets.
Beides ist entsprechend dicht abgedeckt.
"""
from unittest.mock import MagicMock

import pytest

from src.features.support.schemas import ChatStart, TicketCreate
from src.features.support.service import SupportError, SupportService


def _db() -> MagicMock:
    return MagicMock(name="supabase")


def _ticket_rows(mock: MagicMock, rows: list[dict]) -> None:
    """Die gescopte Ticket-Abfrage (select→eq(id)→eq(scope)→limit) belegen."""
    kette = mock.select.return_value.eq.return_value.eq.return_value.limit.return_value
    kette.execute.return_value.data = rows


def _verlauf_rows(mock: MagicMock, rows: list[dict]) -> None:
    """Die Verlaufs-Abfrage (select→eq(ticket)→eq(internal)→order→limit)."""
    kette = mock.select.return_value.eq.return_value.eq.return_value
    kette.order.return_value.limit.return_value.execute.return_value.data = rows


def _ungelesen_rows(mock: MagicMock, rows: list[dict]) -> None:
    """Die Ungelesen-Abfrage (select→in_→eq→eq→order→limit)."""
    kette = mock.select.return_value.in_.return_value.eq.return_value.eq.return_value
    kette.order.return_value.limit.return_value.execute.return_value.data = rows


# --- Interne Notizen ---------------------------------------------------------


def test_detail_filtert_interne_notizen() -> None:
    """Der Verlauf des Melders wird mit internal=False abgefragt.

    Das ist der sensibelste Punkt des Slice: ohne diesen Filter bekäme der
    Melder die internen Einschätzungen des Teams zu sehen.
    """
    db = _db()
    tickets = MagicMock()
    _ticket_rows(tickets, [
        {
            "id": "tk1", "subject": "Hilfe", "category": None, "status": "open",
            "priority": "normal", "created_at": "2026-01-01T00:00:00+00:00",
            "last_message_at": None,
        }
    ])
    messages = MagicMock()
    _verlauf_rows(messages, [])

    db.table.side_effect = lambda n: tickets if n == "support_tickets" else messages
    SupportService(db=db).detail("tk1", user_id="u1")

    # Die zweite .eq()-Bedingung auf den Nachrichten MUSS internal=False sein.
    interne_filter = messages.select.return_value.eq.return_value.eq
    assert interne_filter.call_args[0] == ("internal", False)


def test_detail_liefert_nur_sichtbare_nachrichten() -> None:
    db = _db()
    tickets = MagicMock()
    _ticket_rows(tickets, [
        {
            "id": "tk1", "subject": "Hilfe", "category": None, "status": "open",
            "priority": "normal", "created_at": "2026-01-01T00:00:00+00:00",
            "last_message_at": None,
        }
    ])
    messages = MagicMock()
    _verlauf_rows(messages, [
        {
            "id": "m1", "author_kind": "reporter", "body": "Sichtbar",
            "created_at": "2026-01-01T00:00:00+00:00",
        }
    ])
    db.table.side_effect = lambda n: tickets if n == "support_tickets" else messages

    res = SupportService(db=db).detail("tk1", user_id="u1")
    assert res is not None
    assert [m.body for m in res.messages] == ["Sichtbar"]
    # Das Schema kennt gar kein internal-Feld.
    assert not hasattr(res.messages[0], "internal")


# --- Scope -------------------------------------------------------------------


def test_scope_ohne_identitaet_wird_abgelehnt() -> None:
    """Ohne Melder-Identität würde die Abfrage ALLE Tickets liefern → 401."""
    db = _db()
    with pytest.raises(SupportError) as exc:
        SupportService(db=db).list()
    assert exc.value.status_code == 401


def test_scope_nutzt_reporter_user_id() -> None:
    db = _db()
    chain = db.table.return_value.select.return_value.order.return_value
    chain.eq.return_value.range.return_value.execute.return_value.data = []
    chain.eq.return_value.range.return_value.execute.return_value.count = 0

    SupportService(db=db).list(user_id="u1")
    assert chain.eq.call_args[0] == ("reporter_user_id", "u1")


def test_scope_nutzt_reporter_guest_id() -> None:
    db = _db()
    chain = db.table.return_value.select.return_value.order.return_value
    chain.eq.return_value.range.return_value.execute.return_value.data = []
    chain.eq.return_value.range.return_value.execute.return_value.count = 0

    SupportService(db=db).list(guest_id="g1")
    assert chain.eq.call_args[0] == ("reporter_guest_id", "g1")


def test_fremdes_ticket_ist_nicht_lesbar() -> None:
    """Ein fremdes Ticket ist von einem nicht existierenden ununterscheidbar."""
    db = _db()
    tickets = MagicMock()
    _ticket_rows(tickets, [])
    db.table.return_value = tickets
    assert SupportService(db=db).detail("fremd", user_id="u1") is None


def test_reply_auf_fremdes_ticket_gibt_none() -> None:
    db = _db()
    tickets = MagicMock()
    _ticket_rows(tickets, [])
    db.table.return_value = tickets
    res = SupportService(db=db).reply("fremd", "Text", user_id="u1")
    assert res is None


# --- Anlegen -----------------------------------------------------------------


def test_create_verlangt_genau_eine_identitaet() -> None:
    """Weder beide noch keine Melder-Identität sind zulässig."""
    db = _db()
    req = TicketCreate(subject="Betreff", body="Text")
    svc = SupportService(db=db)

    with pytest.raises(SupportError) as ohne:
        svc.create(req)
    assert ohne.value.status_code == 400

    with pytest.raises(SupportError) as beide:
        svc.create(req, user_id="u1", guest_id="g1")
    assert beide.value.status_code == 400


def test_create_schreibt_eroeffnungstext_nicht_intern() -> None:
    """Der Eröffnungstext ist eine normale Nachricht — nie eine interne Notiz."""
    db = _db()
    tickets = MagicMock()
    tickets.insert.return_value.execute.return_value.data = [{"id": "tk1"}]
    _ticket_rows(tickets, [
        {
            "id": "tk1", "subject": "Betreff", "category": None, "status": "open",
            "priority": "normal", "created_at": "2026-01-01T00:00:00+00:00",
            "last_message_at": None,
        }
    ])
    messages = MagicMock()
    _verlauf_rows(messages, [])
    db.table.side_effect = lambda n: tickets if n == "support_tickets" else messages

    SupportService(db=db).create(
        TicketCreate(subject="Betreff", body="Text"), user_id="u1", tenant_id="t1"
    )
    eingefuegt = messages.insert.call_args[0][0]
    assert eingefuegt["internal"] is False
    assert eingefuegt["author_kind"] == "reporter"


# --- Priorität (serverseitig abgeleitet) -------------------------------------


def test_prioritaet_wird_aus_thema_abgeleitet() -> None:
    """Der Melder kann die Priorität nicht setzen — sie folgt dem Thema.

    Branchenstandard (Zendesk blendet das Feld vor Endkunden aus, ServiceNow
    berechnet es): ein frei wählbares Prioritätsfeld führt zur Inflation, weil
    jeder die höchste Stufe wählt. Zugleich Wurzel 3 — ein Feld, das
    Ressourcenzuteilung steuert, darf nicht vom Client kommen.
    """
    from src.features.support.service import _prioritaet_fuer

    assert _prioritaet_fuer("zahlung") == "high"
    assert _prioritaet_fuer("buchung") == "high"
    assert _prioritaet_fuer("objekt") == "normal"
    assert _prioritaet_fuer("sonstiges") == "low"
    # Unbekanntes/leeres Thema → Standard, nie ein erfundener Wert.
    assert _prioritaet_fuer("erfunden") == "normal"
    assert _prioritaet_fuer(None) == "normal"


def test_create_schreibt_abgeleitete_prioritaet() -> None:
    db = _db()
    tickets = MagicMock()
    tickets.insert.return_value.execute.return_value.data = [{"id": "tk1"}]
    _ticket_rows(tickets, [
        {
            "id": "tk1", "subject": "Zahlung fehlt", "category": "zahlung",
            "status": "open", "priority": "high",
            "created_at": "2026-01-01T00:00:00+00:00", "last_message_at": None,
        }
    ])
    messages = MagicMock()
    _verlauf_rows(messages, [])
    db.table.side_effect = lambda n: tickets if n == "support_tickets" else messages

    SupportService(db=db).create(
        TicketCreate(subject="Zahlung fehlt", body="Text", category="zahlung"),
        user_id="u1",
        tenant_id="t1",
    )
    assert tickets.insert.call_args[0][0]["priority"] == "high"


# --- Status-Übersetzung (Melder-Sicht) ---------------------------------------


def test_status_wird_fuer_melder_uebersetzt() -> None:
    """Interne Status werden nie roh an den Melder ausgeliefert.

    'waiting' heißt intern „wir warten auf den Melder" — aus dessen Sicht ist
    die richtige Aussage „du bist dran". 'resolved'/'closed' sind für ihn
    dasselbe.
    """
    from src.features.support.service import _melder_status

    assert _melder_status("open") == "in_bearbeitung"
    assert _melder_status("waiting") == "wartet_auf_dich"
    assert _melder_status("resolved") == "geloest"
    assert _melder_status("closed") == "geloest"
    # Unbekannter Wert → neutraler Zustand statt Rohwert (fail-safe).
    assert _melder_status("irgendwas") == "in_bearbeitung"
    assert _melder_status(None) == "in_bearbeitung"


def test_detail_liefert_uebersetzten_status() -> None:
    db = _db()
    tickets = MagicMock()
    _ticket_rows(tickets, [
        {
            "id": "tk1", "subject": "Hilfe", "category": None,
            "status": "waiting", "priority": "normal",
            "created_at": "2026-01-01T00:00:00+00:00", "last_message_at": None,
        }
    ])
    messages = MagicMock()
    _verlauf_rows(messages, [])
    db.table.side_effect = lambda n: tickets if n == "support_tickets" else messages

    res = SupportService(db=db).detail("tk1", user_id="u1")
    assert res is not None
    assert res.status == "wartet_auf_dich"


# --- Live-Chat (0236) --------------------------------------------------------


def test_chat_betreff_wird_aus_erster_nachricht_abgeleitet() -> None:
    """Ein Chat hat keinen Betreff — die Agenten-Liste braucht trotzdem einen."""
    from src.features.support.service import _betreff_aus_nachricht

    assert _betreff_aus_nachricht("Hallo, kurze Frage") == "Hallo, kurze Frage"
    assert _betreff_aus_nachricht("  mehrere\n  Zeilen  ") == "mehrere Zeilen"
    lang = _betreff_aus_nachricht("A" * 200)
    assert len(lang) == 80 and lang.endswith("…")


def test_chat_start_ist_idempotent() -> None:
    """Doppelklick/Retry darf keine zweite Konversation eröffnen (Wurzel 2)."""
    db = _db()
    tickets = MagicMock()
    _ticket_rows(tickets, [
        {
            "id": "tk1", "subject": "Hallo", "category": None, "status": "open",
            "priority": "normal", "created_at": "2026-01-01T00:00:00+00:00",
            "last_message_at": None, "source": "chat",
        }
    ])
    messages = MagicMock()
    # Treffer auf die bereits gespeicherte client_msg_id.
    kette = messages.select.return_value.eq.return_value.limit.return_value
    kette.execute.return_value.data = [{"ticket_id": "tk1"}]
    _verlauf_rows(messages, [])
    db.table.side_effect = lambda n: tickets if n == "support_tickets" else messages

    res = SupportService(db=db).start_chat(
        ChatStart(body="Hallo", client_msg_id="c1"), user_id="u1", tenant_id="t1"
    )
    assert res is not None and res.id == "tk1"
    # Keine zweite Konversation angelegt.
    tickets.insert.assert_not_called()


def test_ungelesen_zaehlt_nur_neuere_teamnachrichten() -> None:
    """Ungelesen = sichtbare Team-Nachrichten jünger als der eigene Cursor."""
    db = _db()
    messages = MagicMock()
    _ungelesen_rows(messages, [
        {"ticket_id": "tk1", "created_at": "2026-01-02T10:00:00+00:00"},
        {"ticket_id": "tk1", "created_at": "2026-01-01T10:00:00+00:00"},
        {"ticket_id": "tk2", "created_at": "2026-01-02T10:00:00+00:00"},
    ])
    db.table.side_effect = lambda n: messages

    svc = SupportService(db=db)
    gezaehlt = svc._ungelesen_je_ticket([  # noqa: SLF001 — interne Rechnung
        {"id": "tk1", "reporter_last_read_at": "2026-01-02T00:00:00+00:00"},
        {"id": "tk2", "reporter_last_read_at": None},
    ])
    assert gezaehlt == {"tk1": 1, "tk2": 1}


def test_bewertung_nur_nach_abschluss() -> None:
    """Eine Note auf einen laufenden Vorgang misst nichts → 409."""
    db = _db()
    tickets = MagicMock()
    _ticket_rows(tickets, [
        {
            "id": "tk1", "subject": "Hilfe", "category": None, "status": "open",
            "priority": "normal", "created_at": "2026-01-01T00:00:00+00:00",
            "last_message_at": None,
        }
    ])
    db.table.return_value = tickets
    with pytest.raises(SupportError) as exc:
        SupportService(db=db).rate("tk1", rating=5, comment=None, user_id="u1")
    assert exc.value.status_code == 409
