"""Benachrichtigungen des Personalbereichs (0541) — fünf Kategorien, je
Empfänger eine (Katalog `notification_settings/katalog.py`).

Alle Meldungen sind Nebenpfade: ein Fehler beim Zustellen darf den Plan, den
Antrag oder die Stempelung nicht kippen (`# noqa: BLE001`, Wurzel 5). Jede
Meldung trägt einen `dedup_key`, damit ein doppelter Aufruf (Retry,
Doppelklick) nicht zweimal klingelt (Wurzel 2).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.mail_sprache import FALLBACK
from src.core.mail_texte import text as mail_text
from src.features.notification_settings.dispatcher import Katalogwert, NotificationDispatcher

log = get_logger("nextdays.personal.benachrichtigungen")

KAT_DIENSTPLAN = "dienstplan"
KAT_ABWESENHEIT_ANTRAG = "abwesenheit_antrag"
KAT_ABWESENHEIT_ENTSCHEIDUNG = "abwesenheit_entscheidung"
KAT_SCHICHT_OFFEN = "schicht_offen"
KAT_ZEIT_HINWEIS = "zeit_hinweis"

_PLANBAR = ("staff", "cleaner", "shift_lead")


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


def melde_dienstplan(
    db: Client, *, tenant_id: str, user_id: str, woche_start: date, geaendert: bool
) -> None:
    """„Dein Dienstplan ist da" bzw. „… hat sich geändert" an EINE Person."""
    try:
        key = (
            "personal.dienstplan.geaendert.betreff" if geaendert else "personal.dienstplan.betreff"
        )
        woche = woche_start.isoformat()
        _dispatcher(db).sende(
            user_id=user_id,
            schluessel=KAT_DIENSTPLAN,
            betreff=mail_text(key, FALLBACK, woche=woche),
            betreff_key=key,
            betreff_werte={"woche": woche},
            text=mail_text("personal.dienstplan.text", FALLBACK),
            text_key="personal.dienstplan.text",
            tenant_id=tenant_id,
            # Kein Sprungziel: Mitarbeitende haben im Web keine eigene Flaeche; der
            # Deep-Link kommt mit der Mitarbeiter-App (ADR-0023). Ein Link ins Leere
            # waere schlimmer als keiner (memory: mail-sprungziele-brauchen-route).
            ziel_pfad=None,
            # Eine Änderung nach der Veröffentlichung ist ein NEUES Ereignis —
            # der Schlüssel trägt den Zeitpunkt, sonst verschluckt die offene
            # Erstmeldung jede Folgeänderung derselben Woche.
            dedup_key=(
                f"dienstplan:{woche}:{user_id}:{datetime.now().strftime('%Y%m%d%H%M')}"
                if geaendert
                else f"dienstplan:{woche}:{user_id}"
            ),
            # EINMALIG (0617): Beide Zweige beschreiben ein Ereignis. Die
            # Veroeffentlichung einer Woche passiert genau einmal, und eine
            # AENDERUNG traegt den Zeitpunkt im Schluessel — sie bekommt also
            # ohnehin ihren eigenen Riegel. Was allein der partielle Index
            # nicht verhinderte: derselbe Veroeffentlichungslauf nach dem Lesen
            # erneut, also „Dein Dienstplan ist da" zweimal per Mail fuer
            # dieselbe unveraenderte Woche.
            einmalig=True,
        )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad
        log.warning(
            "personal_meldung_dienstplan_fehlgeschlagen", user_id=user_id, error=str(exc)[:200]
        )


def melde_schicht_offen(db: Client, *, tenant_id: str, schicht: dict[str, Any]) -> None:
    """Offene Schicht an alle Mitarbeitenden, denen das Objekt freigegeben ist."""
    try:
        property_id = schicht.get("property_id")
        if not property_id:
            return
        zuweisungen = (
            db.table("staff_property_assignments")
            .select("user_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", str(property_id))
            .execute()
        ).data or []
        kandidaten = {str(z["user_id"]) for z in zuweisungen}
        if not kandidaten:
            return
        users = (
            db.table("users")
            .select("id, role, deactivated_at")
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(kandidaten))
            .execute()
        ).data or []
        objekt = (
            db.table("properties")
            .select("title")
            .eq("id", str(property_id))
            .limit(1)
            .execute()
            .data
            or []
        )
        titel = str((objekt[0].get("title") if objekt else None) or "")
        werte = {
            "datum": _d(schicht.get("datum")),
            "zeit": f"{_zeit(schicht.get('start_at'))}–{_zeit(schicht.get('end_at'))}",
            "objekt": f" · {titel}" if titel else "",
        }
        d = _dispatcher(db)
        for u in users:
            if str(u.get("role")) not in _PLANBAR or u.get("deactivated_at") is not None:
                continue
            d.sende(
                user_id=str(u["id"]),
                schluessel=KAT_SCHICHT_OFFEN,
                betreff=mail_text("personal.schicht_offen.betreff", FALLBACK, **werte),
                betreff_key="personal.schicht_offen.betreff",
                betreff_werte=werte,
                text=mail_text("personal.schicht_offen.text", FALLBACK, **werte),
                text_key="personal.schicht_offen.text",
                text_werte=werte,
                tenant_id=tenant_id,
                ziel_pfad=None,
                property_id=str(property_id),
                dedup_key=f"schicht_offen:{schicht.get('id')}:{u['id']}",
                # WIEDERHOLBAR (0617): „diese Schicht ist unbesetzt" ist ein
                # ZUSTAND. Wird sie besetzt und spaeter wieder frei (Krankheit,
                # zuruecknahme), ist derselbe Ruf an dieselben Kandidaten ein
                # neuer Bedarf — und eine unbesetzte Schicht ist genau die
                # Meldung, die nicht verstummen darf.
                einmalig=False,
            )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad
        log.warning(
            "personal_meldung_schicht_offen_fehlgeschlagen",
            schicht_id=schicht.get("id"),
            error=str(exc)[:200],
        )


def melde_abwesenheit_antrag(
    db: Client, *, tenant_id: str, antrag: dict[str, Any], leitung_ids: set[str]
) -> None:
    try:
        name = _name(db, str(antrag["user_id"]))
        werte: dict[str, object] = {
            "name": name,
            "art": Katalogwert(f"personal.art.{antrag['art']}"),
            "von": _d(antrag.get("von")),
            "bis": _d(antrag.get("bis")),
            "tage": str(antrag.get("tage_berechnet") or "0"),
        }
        d = _dispatcher(db)
        for uid in sorted(leitung_ids):
            d.sende(
                user_id=uid,
                schluessel=KAT_ABWESENHEIT_ANTRAG,
                betreff=mail_text(
                    "personal.abwesenheit_antrag.betreff",
                    FALLBACK,
                    **{**werte, "art": mail_text(f"personal.art.{antrag['art']}", FALLBACK)},
                ),
                betreff_key="personal.abwesenheit_antrag.betreff",
                betreff_werte=werte,
                text=mail_text(
                    "personal.abwesenheit_antrag.text",
                    FALLBACK,
                    **{**werte, "art": mail_text(f"personal.art.{antrag['art']}", FALLBACK)},
                ),
                text_key="personal.abwesenheit_antrag.text",
                text_werte=werte,
                tenant_id=tenant_id,
                ziel_pfad="/hr/abwesenheit",
                dedup_key=f"abwesenheit_antrag:{antrag['id']}:{uid}",
                # EINMALIG (0617): Ein Antrag wird genau einmal gestellt; der
                # Schluessel traegt Antrags-ID UND Empfaenger, beschreibt also
                # das Ereignis vollstaendig. Ein zweiter Speichervorgang
                # derselben Zeile (Doppelklick, Retry) ist eine Wiederholung,
                # kein neuer Antrag — bisher aber nur, solange die Leitung die
                # erste Meldung nicht gelesen hatte.
                einmalig=True,
            )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad
        log.warning(
            "personal_meldung_antrag_fehlgeschlagen",
            antrag_id=antrag.get("id"),
            error=str(exc)[:200],
        )


def melde_abwesenheit_entschieden(
    db: Client, *, tenant_id: str, antrag: dict[str, Any], entscheider_id: str
) -> None:
    try:
        genehmigt = antrag.get("status") == "genehmigt"
        key = (
            "personal.abwesenheit_genehmigt.betreff"
            if genehmigt
            else "personal.abwesenheit_abgelehnt.betreff"
        )
        werte: dict[str, object] = {
            "art": Katalogwert(f"personal.art.{antrag['art']}"),
            "von": _d(antrag.get("von")),
            "bis": _d(antrag.get("bis")),
        }
        text_werte: dict[str, object] = {
            "entscheider": _name(db, entscheider_id),
            "kommentar": str(antrag.get("kommentar_entscheidung") or ""),
        }
        art_en = mail_text(f"personal.art.{antrag['art']}", FALLBACK)
        _dispatcher(db).sende(
            user_id=str(antrag["user_id"]),
            schluessel=KAT_ABWESENHEIT_ENTSCHEIDUNG,
            betreff=mail_text(key, FALLBACK, **{**werte, "art": art_en}),
            betreff_key=key,
            betreff_werte=werte,
            text=mail_text("personal.abwesenheit_entscheidung.text", FALLBACK, **text_werte),
            text_key="personal.abwesenheit_entscheidung.text",
            text_werte=text_werte,
            tenant_id=tenant_id,
            ziel_pfad=None,
            dedup_key=f"abwesenheit_entscheidung:{antrag['id']}:{antrag.get('status')}",
            # EINMALIG (0617): Der Schluessel traegt den STATUS, also die
            # Entscheidung selbst. „Antrag 42 ist genehmigt" ist ein Ereignis;
            # eine spaetere Korrektur hat einen anderen Status und damit einen
            # eigenen Riegel. Ohne dieses Kennzeichen verschickte ein zweiter
            # Aufruf derselben Genehmigung nach dem Lesen eine zweite Mail an
            # den Mitarbeitenden.
            einmalig=True,
        )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad
        log.warning(
            "personal_meldung_entscheidung_fehlgeschlagen",
            antrag_id=antrag.get("id"),
            error=str(exc)[:200],
        )


def melde_zeit_hinweis(  # noqa: PLR0913 — Hinweis mit allen Bezügen
    db: Client,
    *,
    tenant_id: str,
    leitung_ids: set[str],
    betroffen_id: str,
    art: str,
    werte: dict[str, object],
    dedup: str,
) -> None:
    """„Offene Stempelung seit X Stunden" / „Zeit weicht vom Plan ab" an die Leitung."""
    try:
        name = _name(db, betroffen_id)
        alle = {**werte, "name": name}
        d = _dispatcher(db)
        for uid in sorted(leitung_ids):
            d.sende(
                user_id=uid,
                schluessel=KAT_ZEIT_HINWEIS,
                betreff=mail_text(f"personal.zeit_{art}.betreff", FALLBACK, **alle),
                betreff_key=f"personal.zeit_{art}.betreff",
                betreff_werte=alle,
                text=mail_text(f"personal.zeit_{art}.text", FALLBACK, **alle),
                text_key=f"personal.zeit_{art}.text",
                text_werte=alle,
                tenant_id=tenant_id,
                ziel_pfad="/hr/zeiterfassung",
                dedup_key=f"zeit_{art}:{dedup}:{uid}",
                # WIEDERHOLBAR (0617): Das sind laufende ZUSTAENDE — eine
                # offene Stempelung, ein ablaufendes Dokument. Der `dedup`
                # kommt vom Aufrufer und traegt bei `offen` bereits das Datum
                # (`tick.py`), daempft also den stuendlichen Tick innerhalb des
                # Tages; am naechsten Tag MUSS derselbe Fall wieder melden,
                # solange er besteht.
                einmalig=False,
            )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad
        log.warning("personal_meldung_zeit_fehlgeschlagen", art=art, error=str(exc)[:200])
