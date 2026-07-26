"""Tests für den diagnostics-Slice (technische Support-Diagnose).

Der Kern ist die EINWILLIGUNG: ohne aktive Freigabe des Kunden darf der Support
nichts sehen. Das ist der Unterschied zwischen Support-Werkzeug und
Überwachung — entsprechend dicht getestet.
"""
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

from src.features.diagnostics.schemas import DiagnosticBatch, DiagnosticEvent
from src.features.diagnostics.service import DiagnosticsService, _clean_path


def _db() -> MagicMock:
    return MagicMock(name="supabase")


def _session_row(**over) -> dict:  # noqa: ANN003
    jetzt = datetime.now(UTC)
    base = {
        "id": "s1",
        "user_id": "u1",
        "guest_id": None,
        "tenant_id": "t1",
        "ticket_id": None,
        "started_at": (jetzt - timedelta(hours=1)).isoformat(),
        "expires_at": (jetzt + timedelta(hours=1)).isoformat(),
        "ended_at": None,
        "note": None,
    }
    base.update(over)
    return base


# --- Einwilligung: ohne Freigabe keine Einsicht ------------------------------


def test_ohne_freigabe_keine_ereignisse() -> None:
    """Unbekannte Sitzung → leere Liste, nicht etwa alle Daten."""
    db = _db()
    kette = db.table.return_value.select.return_value.eq.return_value.limit.return_value
    kette.execute.return_value.data = []
    res = DiagnosticsService(db=db).events_for_session("gibtsnicht")
    assert res.items == []
    assert res.total == 0


def test_abgelaufene_freigabe_liefert_nichts() -> None:
    """Nach Ablauf endet die Einsicht — fail-closed."""
    db = _db()
    jetzt = datetime.now(UTC)
    kette = db.table.return_value.select.return_value.eq.return_value.limit.return_value
    kette.execute.return_value.data = [
        _session_row(
            started_at=(jetzt - timedelta(hours=5)).isoformat(),
            expires_at=(jetzt - timedelta(hours=1)).isoformat(),
        )
    ]
    res = DiagnosticsService(db=db).events_for_session("s1")
    assert res.items == []


def test_widerrufene_freigabe_liefert_nichts() -> None:
    """Widerruf (ended_at gesetzt) wirkt sofort."""
    db = _db()
    kette = db.table.return_value.select.return_value.eq.return_value.limit.return_value
    kette.execute.return_value.data = [
        _session_row(ended_at=datetime.now(UTC).isoformat())
    ]
    res = DiagnosticsService(db=db).events_for_session("s1")
    assert res.items == []


def test_aktive_freigabe_begrenzt_auf_zeitfenster() -> None:
    """Der Support sieht Freigabefenster + kurzen Rückblick — nicht die Historie.

    Der Rückblick ist nötig, weil der zu meldende Fehler zwangsläufig VOR dem
    Support-Kontakt passiert. Er ist eng begrenzt (_RUECKBLICK_STUNDEN), damit
    daraus keine Verlaufshistorie wird.
    """
    db = _db()
    zeile = _session_row()

    sessions = MagicMock()
    s_kette = sessions.select.return_value.eq.return_value.limit.return_value
    s_kette.execute.return_value.data = [zeile]

    diagnostics = MagicMock()
    kette = (
        diagnostics.select.return_value.gte.return_value.lte.return_value
        .order.return_value.eq.return_value
    )
    kette.limit.return_value.execute.return_value.data = []
    kette.limit.return_value.execute.return_value.count = 0

    db.table.side_effect = (
        lambda n: sessions if n == "support_debug_sessions" else diagnostics
    )
    DiagnosticsService(db=db).events_for_session("s1")

    # Beginn = Freigabe minus Rückblick, Ende = Ablauf der Freigabe.
    from src.features.diagnostics.service import _RUECKBLICK_STUNDEN, _parse

    gesetzt = _parse(diagnostics.select.return_value.gte.call_args[0][1])
    erwartet = _parse(zeile["started_at"]) - timedelta(hours=_RUECKBLICK_STUNDEN)
    assert abs((gesetzt - erwartet).total_seconds()) < 1

    gte = diagnostics.select.return_value.gte.return_value
    assert gte.lte.call_args[0] == ("created_at", zeile["expires_at"])


# --- Datensparsamkeit --------------------------------------------------------


def test_query_string_wird_entfernt() -> None:
    """Im Query-String stehen Suchbegriffe/IDs — die gehören nicht ins Log."""
    assert _clean_path("/objekte?suche=Meier&token=abc") == "/objekte"
    assert _clean_path("/buchungen") == "/buchungen"
    assert _clean_path(None) is None


def test_unbekannte_app_wird_normalisiert() -> None:
    """Ungeprüfter Client-Text landet nicht in der Spalte."""
    db = _db()
    batch = DiagnosticBatch(
        events=[DiagnosticEvent(app="<script>", kind="error", message="x")]
    )
    DiagnosticsService(db=db).record(
        batch, user_id="u1", guest_id=None, tenant_id="t1"
    )
    zeilen = db.table.return_value.insert.call_args[0][0]
    assert zeilen[0]["app"] == "unbekannt"


def test_schreiben_kippt_nie() -> None:
    """Diagnose darf den Client nie ausbremsen — Fehler werden geschluckt."""
    db = _db()
    db.table.side_effect = RuntimeError("DB weg")
    batch = DiagnosticBatch(
        events=[DiagnosticEvent(app="gastgeber", kind="error", message="x")]
    )
    n = DiagnosticsService(db=db).record(
        batch, user_id="u1", guest_id=None, tenant_id="t1"
    )
    assert n == 0


def test_message_wird_gekuerzt() -> None:
    """Überlange Meldungen werden beschnitten (kein unbegrenztes Feld)."""
    db = _db()
    batch = DiagnosticBatch(
        events=[DiagnosticEvent(app="web", kind="error", message="x" * 500)]
    )
    DiagnosticsService(db=db).record(
        batch, user_id="u1", guest_id=None, tenant_id=None
    )
    zeilen = db.table.return_value.insert.call_args[0][0]
    assert len(zeilen[0]["message"]) <= 500


# --- Freigabe-Steuerung ------------------------------------------------------


def test_end_session_ohne_identitaet_macht_nichts() -> None:
    """Ohne Identität würde ein Update ALLE Sitzungen beenden."""
    db = _db()
    DiagnosticsService(db=db).end_session(user_id=None, guest_id=None)
    db.table.return_value.update.return_value.eq.assert_not_called()


def test_my_sessions_ohne_identitaet_ist_leer() -> None:
    db = _db()
    assert DiagnosticsService(db=db).my_sessions(user_id=None, guest_id=None) == []


# --- Aktivitätsdaten nur mit Freigabe ---------------------------------------


def _record_db(hat_freigabe: bool) -> MagicMock:
    """Client, dessen Freigabe-Prüfung `hat_freigabe` liefert."""
    db = MagicMock(name="supabase")
    sessions = MagicMock()
    # Kette: select → is_ → gt → eq(identität) → limit → execute
    kette = (
        sessions.select.return_value.is_.return_value.gt.return_value
        .eq.return_value.limit.return_value
    )
    kette.execute.return_value.data = [{"id": "s1"}] if hat_freigabe else []
    diagnostics = MagicMock()
    db.table.side_effect = (
        lambda n: sessions if n == "support_debug_sessions" else diagnostics
    )
    return db


def test_aktivitaet_ohne_freigabe_wird_verworfen() -> None:
    """Ohne aktive Freigabe darf KEIN Seitenwechsel gespeichert werden.

    Der Client könnte solche Ereignisse sonst einfach mitschicken und die
    Einwilligung umgehen (Wurzel 3: der Anfrage nicht vertrauen).
    """
    db = _record_db(hat_freigabe=False)
    batch = DiagnosticBatch(
        events=[
            DiagnosticEvent(app="gastgeber", kind="navigation", message="Seite"),
            DiagnosticEvent(app="gastgeber", kind="aktion", message="Klick"),
        ]
    )
    n = DiagnosticsService(db=db).record(
        batch, user_id="u1", guest_id=None, tenant_id="t1"
    )
    assert n == 0


def test_fehler_werden_auch_ohne_freigabe_gespeichert() -> None:
    """Technische Fehler laufen dauerhaft — sie sind nicht einwilligungspflichtig."""
    db = _record_db(hat_freigabe=False)
    batch = DiagnosticBatch(
        events=[DiagnosticEvent(app="gastgeber", kind="error", message="Boom")]
    )
    n = DiagnosticsService(db=db).record(
        batch, user_id="u1", guest_id=None, tenant_id="t1"
    )
    assert n == 1


def test_gemischter_batch_wird_gefiltert() -> None:
    """Ohne Freigabe bleibt der Fehler, die Aktivität fliegt raus."""
    db = _record_db(hat_freigabe=False)
    batch = DiagnosticBatch(
        events=[
            DiagnosticEvent(app="gastgeber", kind="error", message="Boom"),
            DiagnosticEvent(app="gastgeber", kind="navigation", message="Seite"),
        ]
    )
    n = DiagnosticsService(db=db).record(
        batch, user_id="u1", guest_id=None, tenant_id="t1"
    )
    assert n == 1


def test_aktivitaet_mit_freigabe_wird_gespeichert() -> None:
    """Mit aktiver Freigabe wird der komplette Ablauf erfasst."""
    db = _record_db(hat_freigabe=True)
    batch = DiagnosticBatch(
        events=[
            DiagnosticEvent(app="gastgeber", kind="navigation", message="Seite"),
            DiagnosticEvent(app="gastgeber", kind="aktion", message="Speichern"),
        ]
    )
    n = DiagnosticsService(db=db).record(
        batch, user_id="u1", guest_id=None, tenant_id="t1"
    )
    assert n == 2
