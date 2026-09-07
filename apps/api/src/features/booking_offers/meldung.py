"""Benachrichtigung des Betriebs über die Antwort des Gastes (0586).

WARUM HIER UND NICHT IN `notification_settings/ereignisse.py`:
Dort liegen die 15 bestehenden `melde_*`-Funktionen, und genau dorthin gehörte
diese ursprünglich. Mit ihr riss die Datei die pylint-Grenze von 1500 Zeilen
(1517) — und der Modul-Docstring dort sagt selbst, wie dann geteilt wird:
nach FACHGEBIET, nie nach Zeilen. Das Fachgebiet dieser Meldung ist das
Buchungsangebot, also steht sie im Angebots-Slice.

Sie benutzt vom Benachrichtigungs-Slice nur dessen ÖFFENTLICHE Schnittstelle:
`system_warnungs_empfaenger` (wer im Betrieb System-Meldungen erhält) und den
`NotificationDispatcher`. Keine privaten Helfer — sonst wäre die Trennung nur
eine Dateigrenze.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.core.mail_sprache import FALLBACK
from src.core.mail_texte import text as mail_text

log = get_logger(__name__)

# Die Glocke steht in der Sprache des Betriebs; bis die Empfängersprache je
# Nutzer aufgelöst wird, ist das der Rückfall (wie in `ereignisse.py`).
_GLOCKEN_SPRACHE = FALLBACK

# Die Katalog-Kategorie (notification_settings/katalog.py). Als Konstante,
# damit ein Tippfehler nicht erst im Dispatcher als ValueError auffällt.
SCHLUESSEL_ANGEBOT_ANTWORT = "angebot_antwort"

# Die beiden erlaubten Antworten. Der Wert wählt den Textschlüssel, deshalb
# wird er geprüft statt eingesetzt: ein unbekannter Wert wäre sonst ein
# MailTextFehlt mitten im Zusage-Pfad des Gastes.
ANTWORTEN = ("angenommen", "abgelehnt")


def melde_angebots_antwort(
    db: Client,
    *,
    tenant_id: str,
    offer_id: str,
    guest_name: str,
    property_id: str | None,
    antwort: str,
) -> None:
    """„Der Gast hat auf das Angebot geantwortet." — an die Betriebsleitung.

    WOZU: Zwischen Zusage und Zahlung liegen Minuten bis Stunden, in denen der
    Zeitraum noch frei verkäuflich ist (das Angebot reserviert nichts, 0586).
    Ohne diese Meldung erfährt der Betrieb von der Zusage erst, wenn die Buchung
    plötzlich im Kalender steht — oder gar nicht, wenn der Gast abgelehnt hat
    und der Betrieb weiter auf Antwort wartet.

    EMPFÄNGER ist die Leitung (`RECEIVE_SYSTEM_ALERTS`, §4.1) und nicht der
    Ersteller des Angebots: wer heute Dienst hat, muss reagieren können, auch
    wenn das Angebot ein Kollege verschickt hat.

    Entdoppelt über Angebot + Antwort (Wurzel 2): eine Wiederholung erzeugt
    keine zweite Glocke, eine SPÄTERE andere Antwort aber schon.

    Best effort: Die Zusage des Gastes darf nicht daran scheitern, dass eine
    interne Meldung nicht rausgeht — der Zustand steht in der Angebotsliste,
    die live aktualisiert.
    """
    try:
        if antwort not in ANTWORTEN:
            log.warning(
                "angebot_meldung_unbekannte_antwort",
                offer_id=offer_id,
                antwort=antwort,
            )
            return
        from src.features.notification_settings.dispatcher import (  # noqa: PLC0415
            NotificationDispatcher,
        )
        from src.features.notification_settings.ereignisse import (  # noqa: PLC0415
            system_warnungs_empfaenger,
        )

        empfaenger = system_warnungs_empfaenger(db, tenant_id)
        if not empfaenger:
            log.info("angebot_meldung_ohne_empfaenger", tenant_id=tenant_id)
            return
        text_key = f"benachrichtigung.angebot_{antwort}"
        werte: dict[str, object] = {
            "gast": guest_name,
            "objekt": _objekt_titel(db, tenant_id, property_id),
        }
        dispatcher = NotificationDispatcher(db)
        for user_id in sorted(empfaenger):
            dispatcher.sende(
                user_id=user_id,
                schluessel=SCHLUESSEL_ANGEBOT_ANTWORT,
                betreff=mail_text(text_key, _GLOCKEN_SPRACHE, **werte),
                betreff_key=text_key,
                betreff_werte=werte,
                text="",
                tenant_id=tenant_id,
                property_id=property_id,
                ziel_pfad="/reservierungen/angebote",
                dedup_key=f"angebot:{antwort}:{offer_id}",
            )
        log.info(
            "angebot_antwort_gemeldet",
            tenant_id=tenant_id,
            offer_id=offer_id,
            antwort=antwort,
            empfaenger=len(empfaenger),
        )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, kippt die Zusage nie
        log.warning(
            "angebot_meldung_fehlgeschlagen",
            offer_id=offer_id,
            error=str(exc)[:200],
        )


def _objekt_titel(db: Client, tenant_id: str, property_id: str | None) -> str:
    """Objekttitel für die Meldung — leer, wenn es keinen gibt.

    Kein erfundener Name (Wurzel 4): fehlt das Objekt, bleibt der Platzhalter
    leer, und der Link in der Glocke führt zum Angebot, wo alles steht.
    """
    if not property_id:
        return ""
    zeilen = (
        db.table("properties")
        .select("title")
        .eq("id", property_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    return str(zeilen[0]["title"] or "") if zeilen else ""
