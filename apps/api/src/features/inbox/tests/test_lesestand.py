"""Lesestand im Posteingang: was ist wirklich ungelesen?

Der Anlass (live, 07.08.2026): In der Liste trug JEDE Zeile ein rotes „Neu" —
das war der BUCHUNGS-Status (`channex_booking.status`, bei allen 22 `new`),
nicht der Lesestand. Gleichzeitig standen alle 22 Threads auf
`is_read = true`. Die Anzeige unterschied also nichts.

`is_read` allein trägt die Frage auch nicht: es ist ein Handflag, das beim
Öffnen gesetzt wird und dann stehen bleibt. Schreibt der Gast danach erneut,
bliebe der Thread „gelesen".
"""

from __future__ import annotations

from src.features.inbox.service import InboxService

gelesen = InboxService._ist_gelesen  # noqa: SLF001 — reine Funktion, absichtlich


def test_ungelesenes_flag_bleibt_ungelesen():
    assert gelesen({"is_read": False, "read_at": "2026-08-01T10:00:00Z"}, None) is False


def test_gelesen_ohne_gastnachricht():
    """Nichts Neues seit dem Lesen → bleibt gelesen."""
    assert gelesen({"is_read": True, "read_at": "2026-08-01T10:00:00Z"}, None) is True


def test_neue_gastnachricht_macht_wieder_ungelesen():
    """Der Kern: nach dem Lesen kam eine Gastnachricht."""
    zeile = {"is_read": True, "read_at": "2026-08-01T10:00:00Z"}
    assert gelesen(zeile, "2026-08-02T09:00:00Z") is False


def test_aeltere_gastnachricht_aendert_nichts():
    """Die Nachricht lag VOR dem Lesen — sie wurde also mitgelesen."""
    zeile = {"is_read": True, "read_at": "2026-08-03T10:00:00Z"}
    assert gelesen(zeile, "2026-08-01T09:00:00Z") is True


def test_gleicher_zeitpunkt_gilt_als_gelesen():
    """Grenzfall: Lesen und Nachricht auf dieselbe Sekunde. Kein Sprung auf
    ungelesen — sonst wäre ein gerade geöffneter Thread sofort wieder neu."""
    zeile = {"is_read": True, "read_at": "2026-08-01T10:00:00Z"}
    assert gelesen(zeile, "2026-08-01T10:00:00Z") is True


def test_ohne_lesezeitpunkt_zaehlt_allein_das_flag():
    """Altbestand ohne `read_at` (Spalte kam mit 0302): kein erfundener
    Vergleichswert, das Flag gilt unverändert (Wurzel 4)."""
    assert gelesen({"is_read": True}, "2026-08-02T09:00:00Z") is True
    assert gelesen({"is_read": True, "read_at": None}, "2026-08-02T09:00:00Z") is True


def test_fehlendes_flag_gilt_als_gelesen():
    """Default wie in der Spalte: kein Flag → kein ungelesener Zustand."""
    assert gelesen({}, None) is True
