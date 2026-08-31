"""Lesestand der Verlaeufe ohne `channex_booking`-Zeile.

WARUM ES DIESE TESTS GIBT: Buchungsanfragen (`anfrage:`), Marktplatz (`mb:`),
Uebernahmen (`ue:`) und WhatsApp (`wa:`) leiteten ihren Lesestand aus dem
Verlauf ab — bei Anfragen aus „hat zuletzt der Betrieb geschrieben?". Eine
Ableitung, die kein Oeffnen kennt: solange der Gast der Letzte war, stand der
Verlauf DAUERHAFT auf ungelesen, egal wie oft ihn jemand las. Das Markieren lief
zusaetzlich ins Leere (`update_thread_flags` warf fuer diese IDs 404).

Live gemeldet am 31.08.2026: zwei Anfragen, Zaehler blieb bei 2.
"""
from __future__ import annotations

from pathlib import Path

_SLICE = Path(__file__).resolve().parent.parent


def test_schreibpfad_nimmt_nebenquellen_an() -> None:
    """`update_thread_flags` darf fuer `anfrage:` & Co. nicht mehr 404 werfen."""
    quelle = (_SLICE / "service.py").read_text(encoding="utf-8")
    assert "_nebenquelle_lesestand_setzen" in quelle
    # Der Zweig MUSS INNERHALB von `update_thread_flags` vor dem Scope-Load
    # stehen — dort entsteht der 404.
    rumpf = quelle.split("def update_thread_flags(")[1]
    # Auf den AUFRUF trennen, nicht auf das Wort: der erklaerende Kommentar
    # darueber nennt `_load_thread_scoped` ebenfalls.
    vor_load = rumpf.split("self._load_thread_scoped(")[0]
    assert "_nebenquelle_lesestand_setzen" in vor_load, (
        "Der Nebenquellen-Zweig steht hinter dem Scope-Load und wird nie "
        "erreicht — genau der 404, um den es geht."
    )


def test_leseseite_wendet_den_stand_an() -> None:
    """Die Liste zieht den gespeicherten Lesestand ueber die Ableitung."""
    quelle = (_SLICE / "service.py").read_text(encoding="utf-8")
    spiegel = (_SLICE / "spiegel.py").read_text(encoding="utf-8")
    assert "_nebenquellen_lesestand_anwenden(" in quelle
    assert "nebenquellen_lesestaende(" in spiegel
    # Nur in EINE Richtung: gespeichert „gelesen" darf die Ableitung
    # ueberstimmen, nie umgekehrt — sonst verschwaende eine neue Gastnachricht.
    assert "if not t.is_read and gelesen_am:" in spiegel


def test_neue_gastnachricht_macht_wieder_ungelesen() -> None:
    """Der gespeicherte Zeitpunkt gilt nur BIS zur naechsten Gastnachricht.

    Ohne diese Grenze waere das Problem nur umgedreht: einmal gelesen, nie
    wieder gemeldet — und eine echte neue Frage des Gastes fiele niemandem auf.
    """
    from src.features.inbox.service import _als_zeitpunkt

    gelesen = "2026-08-31T08:52:50+00:00"
    alt = "2026-08-29T13:19:47+00:00"
    neu = "2026-08-31T09:30:00+00:00"
    assert _als_zeitpunkt(alt) <= _als_zeitpunkt(gelesen)      # bleibt gelesen
    assert not _als_zeitpunkt(neu) <= _als_zeitpunkt(gelesen)  # wieder ungelesen


def test_ungelesen_loescht_den_stand() -> None:
    """`is_read=False` entfernt die Zeile, statt einen alten Zeitpunkt zu lassen.

    Bliebe er stehen, spraenge der Verlauf beim naechsten Laden wieder auf
    gelesen — Wurzel 1, der Gegenzustand gehoert gepflegt.
    """
    # Die Lesestand-Logik liegt in `spiegel.py` (Mixin derselben Klasse) —
    # `service.py` stand sonst ueber seiner 1500-Zeilen-Grenze.
    quelle = (_SLICE / "spiegel.py").read_text(encoding="utf-8")
    rumpf = quelle.split("def _nebenquelle_lesestand_setzen(")[1]
    rumpf = rumpf.split("\n    def ")[0]
    assert ".delete()" in rumpf, "kein Loeschzweig fuer is_read=False"


def test_tabelle_ist_gegen_direktzugriff_gesperrt() -> None:
    """Wurzel 6: lesen ja, schreiben nur der Server.

    „Hat das schon jemand bearbeitet" ist in einem Betrieb mit mehreren
    Mitarbeitern eine Aussage, die stimmen muss.
    """
    sql = (
        _SLICE.parents[4] / "supabase" / "migrations"
        / "0509_nebenquellen_lesestand.sql"
    ).read_text(encoding="utf-8")
    assert "enable row level security" in sql
    assert (
        "revoke insert, update, delete on public.inbox_nebenquelle_lesestand"
        in sql
    )
    assert "as restrictive for all" in sql
    # Ein Zeitpunkt, kein Flag — sonst gilt „gelesen" fuer immer.
    assert "read_at    timestamptz not null" in sql


def test_alle_vier_praefixe_sind_abgedeckt() -> None:
    """Nicht nur Anfragen: dieselbe Luecke haben mb:/ue:/wa:."""
    from src.features.inbox.service import _NEBENQUELLEN_PRAEFIXE

    assert set(_NEBENQUELLEN_PRAEFIXE) == {"anfrage:", "mb:", "ue:", "wa:"}
