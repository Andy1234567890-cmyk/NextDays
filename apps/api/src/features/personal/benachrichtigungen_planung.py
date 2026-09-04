"""Meldungen des Schichttauschs (0544, Kategorie `schicht_tausch`).

Vier Ereignisse, drei Empfängerkreise:
  * Anfrage      → die angefragte Person („Kollegin bietet dir ihre Schicht an")
  * Angenommen   → die Leitung („Freigabe nötig")
  * Freigegeben  → BEIDE Personen (die Schicht hat gewechselt)
  * Verworfen    → BEIDE Personen (abgelehnt, zurückgezogen, Schicht begonnen)

Wie in `benachrichtigungen.py` sind alle Meldungen Nebenpfade: ein Fehler beim
Zustellen darf den Tausch nicht kippen (`# noqa: BLE001`, Wurzel 5). Jede
Meldung trägt einen `dedup_key` aus Tausch-Kennung, Ereignis und Empfänger, damit
ein Retry oder Doppelklick nicht zweimal klingelt (Wurzel 2).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.mail_sprache import FALLBACK
from src.core.mail_texte import text as mail_text
from src.features.notification_settings.dispatcher import NotificationDispatcher

log = get_logger("nextdays.personal.benachrichtigungen_planung")

KAT_SCHICHT_TAUSCH = "schicht_tausch"


def _name(db: Client, user_id: str) -> str:
    rows = db.table("users").select("full_name").eq("id", user_id).limit(1).execute().data or []
    return str((rows[0].get("full_name") if rows else None) or "—")


def _d(wert: object) -> str:
    if isinstance(wert, date):
        return wert.isoformat()
    return str(wert or "")[:10]


def _zeit(wert: object) -> str:
    if isinstance(wert, datetime):
        return wert.strftime("%H:%M")
    s = str(wert or "")
    return s[11:16] if len(s) >= 16 else s

# Ereignis → Mailschlüssel-Rumpf (Vertrag §1.8).
_SCHLUESSEL = {
    "anfrage": "personal.tausch_anfrage",
    "angenommen": "personal.tausch_angenommen",
    "freigegeben": "personal.tausch_freigegeben",
    "verworfen": "personal.tausch_verworfen",
}


def _werte(db: Client, tausch: dict[str, Any], schicht: dict[str, Any]) -> dict[str, object]:
    """Die drei Platzhalter des Vertrags: `{name}`, `{datum}`, `{zeit}`.

    `{name}` ist immer die GEBENDE Person — sie ist die, um deren Schicht es
    geht, in jedem der vier Ereignisse.
    """
    return {
        "name": _name(db, str(tausch["von_user_id"])),
        "datum": _d(schicht.get("datum")),
        "zeit": f"{_zeit(schicht.get('start_at'))}–{_zeit(schicht.get('end_at'))}",
    }


def melde_tausch(  # noqa: PLR0913 — Ereignis, Bezug und Empfängerkreis
    db: Client,
    *,
    tenant_id: str,
    tausch: dict[str, Any],
    schicht: dict[str, Any],
    ereignis: str,
    empfaenger: set[str],
    woche_start: str | None = None,
) -> None:
    """Eine Tausch-Meldung an jeden Empfänger; Sprungziel ist der Dienstplan."""
    try:
        schluessel = _SCHLUESSEL.get(ereignis)
        if schluessel is None:
            # Ein unbekanntes Ereignis ist ein Programmierfehler, kein stiller
            # Ausfall — es bleibt im Log sichtbar (Wurzel 5).
            log.warning("personal_tausch_meldung_unbekannt", ereignis=ereignis)
            return
        werte = _werte(db, tausch, schicht)
        ziel = f"/hr/schichtplan?woche={woche_start}" if woche_start else "/hr/schichtplan"
        d = NotificationDispatcher(db)
        for uid in sorted(empfaenger):
            d.sende(
                user_id=uid,
                schluessel=KAT_SCHICHT_TAUSCH,
                betreff=mail_text(f"{schluessel}.betreff", FALLBACK, **werte),
                betreff_key=f"{schluessel}.betreff",
                betreff_werte=werte,
                text=mail_text(f"{schluessel}.text", FALLBACK, **werte),
                text_key=f"{schluessel}.text",
                text_werte=werte,
                tenant_id=tenant_id,
                ziel_pfad=ziel,
                dedup_key=f"tausch:{tausch.get('id')}:{ereignis}:{uid}",
            )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad
        log.warning(
            "personal_meldung_tausch_fehlgeschlagen",
            tausch_id=tausch.get("id"),
            ereignis=ereignis,
            error=str(exc)[:200],
        )
