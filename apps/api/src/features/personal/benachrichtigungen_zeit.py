"""Benachrichtigungen des Zeit-Pakets (0548, Vertrag §3.5).

Drei Kategorien, je Empfänger eine:
  * `ueberstunden_antrag`       → Leitung: ein Antrag ist eingegangen
  * `ueberstunden_entscheidung` → Antragsteller: genehmigt oder abgelehnt
  * `verspaetung`               → Leitung: Schicht hat begonnen, niemand hat
                                  gestempelt (Regel `verspaetung_melden_min`)

Wie in `benachrichtigungen.py`: jede Meldung ist ein NEBENPFAD. Ein Fehler beim
Zustellen darf den Antrag, die Entscheidung oder den Worker-Lauf nicht kippen
(`# noqa: BLE001`, Wurzel 5), und jede trägt einen `dedup_key`, damit ein
Retry nicht zweimal klingelt (Wurzel 2).

Die Kategorien selbst trägt der Integrator in
`notification_settings/katalog.py` ein — die Spalten aus 0548 sind da, der
Katalog-Test prüft sie gegen die Migration.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.mail_sprache import FALLBACK
from src.core.mail_texte import text as mail_text
from src.features.notification_settings.dispatcher import NotificationDispatcher

log = get_logger("nextdays.personal.benachrichtigungen_zeit")

KAT_UEBERSTUNDEN_ANTRAG = "ueberstunden_antrag"
KAT_UEBERSTUNDEN_ENTSCHEIDUNG = "ueberstunden_entscheidung"
KAT_VERSPAETUNG = "verspaetung"


def _dispatcher(db: Client) -> NotificationDispatcher:
    return NotificationDispatcher(db)


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


def _stunden(minuten: object) -> str:
    """Minuten als `h:mm` — die Mail zeigt Stunden, nicht 315."""
    try:
        m = int(minuten)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return "0:00"
    return f"{m // 60}:{m % 60:02d}"


def melde_ueberstunden_antrag(
    db: Client, *, tenant_id: str, antrag: dict[str, Any], leitung_ids: set[str]
) -> None:
    """„{name} beantragt {stunden} Überstunden am {datum}" an die Leitung."""
    try:
        werte: dict[str, object] = {
            "name": _name(db, str(antrag["user_id"])),
            "datum": _d(antrag.get("datum")),
            "stunden": _stunden(antrag.get("minuten")),
            "grund": str(antrag.get("grund") or ""),
        }
        d = _dispatcher(db)
        for uid in sorted(leitung_ids):
            d.sende(
                user_id=uid,
                schluessel=KAT_UEBERSTUNDEN_ANTRAG,
                betreff=mail_text("personal.ueberstunden_antrag.betreff", FALLBACK, **werte),
                betreff_key="personal.ueberstunden_antrag.betreff",
                betreff_werte=werte,
                text=mail_text("personal.ueberstunden_antrag.text", FALLBACK, **werte),
                text_key="personal.ueberstunden_antrag.text",
                text_werte=werte,
                tenant_id=tenant_id,
                ziel_pfad="/hr/zeiterfassung",
                dedup_key=f"ueberstunden_antrag:{antrag['id']}:{uid}",
                # EINMALIG (0617): wie beim Abwesenheitsantrag — ein Antrag
                # wird einmal gestellt, der Schluessel traegt Antrag und
                # Empfaenger. Eine Wiederholung ist ein Retry, kein Vorgang.
                einmalig=True,
            )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad
        log.warning(
            "personal_meldung_ueberstunden_antrag_fehlgeschlagen",
            antrag_id=antrag.get("id"),
            error=str(exc)[:200],
        )


def melde_ueberstunden_entscheidung(
    db: Client, *, tenant_id: str, antrag: dict[str, Any], entscheider_id: str
) -> None:
    """Genehmigt oder abgelehnt — an den Antragsteller.

    Der dedup_key trägt den STATUS: eine Ablehnung nach einer Genehmigung
    (Korrektur) ist ein neues Ereignis und darf nicht am Schlüssel der ersten
    Meldung hängen bleiben.
    """
    try:
        genehmigt = antrag.get("status") == "genehmigt"
        key = (
            "personal.ueberstunden_genehmigt.betreff"
            if genehmigt
            else "personal.ueberstunden_abgelehnt.betreff"
        )
        werte: dict[str, object] = {
            "datum": _d(antrag.get("datum")),
            "stunden": _stunden(antrag.get("minuten")),
        }
        text_werte: dict[str, object] = {
            **werte,
            "entscheider": _name(db, entscheider_id),
            "kommentar": str(antrag.get("kommentar") or ""),
        }
        _dispatcher(db).sende(
            user_id=str(antrag["user_id"]),
            schluessel=KAT_UEBERSTUNDEN_ENTSCHEIDUNG,
            betreff=mail_text(key, FALLBACK, **werte),
            betreff_key=key,
            betreff_werte=werte,
            text=mail_text("personal.ueberstunden_entscheidung.text", FALLBACK, **text_werte),
            text_key="personal.ueberstunden_entscheidung.text",
            text_werte=text_werte,
            tenant_id=tenant_id,
            ziel_pfad=None,
            dedup_key=f"ueberstunden_entscheidung:{antrag['id']}:{antrag.get('status')}",
            # EINMALIG (0617): Der Schluessel traegt den STATUS (siehe
            # Docstring) — eine Korrektur nach der Genehmigung hat ihren
            # eigenen Riegel, dieselbe Entscheidung dagegen nie zweimal.
            einmalig=True,
        )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad
        log.warning(
            "personal_meldung_ueberstunden_entscheidung_fehlgeschlagen",
            antrag_id=antrag.get("id"),
            error=str(exc)[:200],
        )


def melde_verspaetung(
    db: Client, *, tenant_id: str, schicht: dict[str, Any], leitung_ids: set[str], dedup: str
) -> None:
    """„{name} hat um {zeit} nicht gestempelt" an die Leitung.

    Mail UND Push, weil es JETZT jemanden braucht (0548): eine Schicht, die
    unbesetzt anläuft, ist in einer Stunde nicht mehr zu retten.
    """
    try:
        werte: dict[str, object] = {
            "name": _name(db, str(schicht["user_id"])),
            "datum": _d(schicht.get("datum")),
            "zeit": _zeit(schicht.get("start_at")),
            "minuten": str(schicht.get("verspaetung_min") or ""),
        }
        d = _dispatcher(db)
        for uid in sorted(leitung_ids):
            d.sende(
                user_id=uid,
                schluessel=KAT_VERSPAETUNG,
                betreff=mail_text("personal.verspaetung.betreff", FALLBACK, **werte),
                betreff_key="personal.verspaetung.betreff",
                betreff_werte=werte,
                text=mail_text("personal.verspaetung.text", FALLBACK, **werte),
                text_key="personal.verspaetung.text",
                text_werte=werte,
                tenant_id=tenant_id,
                ziel_pfad="/hr/zeiterfassung",
                property_id=(
                    str(schicht["property_id"]) if schicht.get("property_id") else None
                ),
                # WIEDERHOLBAR (0617): Eine Verspaetung ist ein ZUSTAND, der
                # sofort jemanden braucht (0548, Push). Der `dedup` je Schicht
                # daempft den stuendlichen Tick; verspaetet sich dieselbe
                # Person bei der naechsten Schicht erneut, MUSS es wieder
                # klingeln — hier stumm zu werden hiesse, eine leere Rezeption
                # nicht zu melden.
                einmalig=False,
                dedup_key=f"{dedup}:{uid}",
            )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad
        log.warning(
            "personal_meldung_verspaetung_fehlgeschlagen",
            schicht_id=schicht.get("id"),
            error=str(exc)[:200],
        )
