"""Der ZWEITE Versandweg des Posteingangs: E-Mail statt Portal-Chat.

WOZU: `service.send_message` kannte genau einen Weg — die Channex-Messaging-API.
Der setzt eine Buchung BEIM AGGREGATOR voraus. Eine Direktbuchung, eine
Website-Buchung und eine Buchung auf unserem eigenen Marktplatz haben keine;
ihre Automails waren damit unzustellbar. Bei myBestDays war das besonders
absurd: seit `thread_spiegel` bekommt jede Buchung einen Thread, die Regel
plante brav — und der Versand lief gegen eine Channex-Buchungs-ID, hinter der
nichts steht.

Der Kanal des Gastes ist hier die E-Mail-Adresse aus der Buchung. Fehlt sie,
wird NICHT ersatzweise irgendwohin geschickt und auch nicht so getan, als sei
die Nachricht raus: 422, fail-closed (Wurzel 5). Der Aufrufer haelt den Grund
an der geplanten Zeile fest.

KEIN hart deutscher Text: Betreff und Rumpf stehen in der Sprache des GASTES.
Der Betreff kommt aus der Regel (`message_automation_text.subject` in der
Gastsprache, sonst `message_automation.subject`); hat die Regel keinen, greift
der Katalog-Betreff `automation.mail.betreff` aus `core.mail_texte` — in 24
Sprachen, nicht auf Deutsch (Wurzel 4).
"""
from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from supabase import Client

from src.core.logging import get_logger
from src.core.mail import MailError, MailService, OutboundMessage
from src.core.mail_empfaenger import sprache_fuer_gast
from src.core.mail_layout import MailInhalt, mail_rendern
from src.core.mail_texte import text as mail_text

from .errors import InboxError
from .schemas import InboxMessage
from .sprachen import fassung_waehlen, standardsprache

log = get_logger("nextdays.inbox")

# Fallback-Betreff, wenn die Regel keinen eigenen traegt.
BETREFF_KEY = "automation.mail.betreff"


def dienst(vorhanden: MailService | None) -> MailService:
    """Der Mailversand — erst beim ersten Bedarf gebaut.

    `MailService()` liest die SMTP-Einstellungen. Im Konstruktor des
    Posteingangs zu ziehen hieße: jeder Listenaufruf zahlt dafür, und jeder
    Test müsste eine Mailumgebung stellen, um einen Thread zu lesen.
    """
    return vorhanden or MailService()


# Die `quelle` des Spiegels (0400/0495) bleibt auf diesem Weg der AUSLÖSER
# (manuell|automation|ki) und wird NICHT auf „email" gesetzt. Sie beantwortet
# „wer hat geschrieben", nicht „worüber ging es raus" — genau die
# Unterscheidung, für die 0400 die Spalte angelegt hat und an der die Kennzahl
# „per Automation gesendet" hängt. Ein eigener Wert für den Versandweg hätte
# sie zerstört; der Weg ist ohnehin am Thread ablesbar
# (`thread_spiegel.ist_eigener_thread`).


def gast_mail(customer: dict) -> str:
    """Die Mailadresse des Gastes aus den Thread-Gastdaten (leer = keine).

    Zwei Schluessel, weil zwei Bestaende zusammenlaufen: die OTA-Payload nennt
    das Feld `mail`, unsere eigenen Spiegel-Zeilen ebenfalls — `email` ist der
    Name, den einzelne Kanaele mitbringen. Geraten wird nichts: was hier leer
    bleibt, ist ein Datenfehler und kein Grund fuer einen Ersatzwert.
    """
    for schluessel in ("mail", "email"):
        wert = str(customer.get(schluessel) or "").strip()
        if wert:
            return wert
    return ""


def betreff_fuer(
    db: Client,
    tenant_id: str,
    *,
    automation_id: str | None,
    gastsprache: str | None,
    sprache: str,
) -> str:
    """Betreff der Mail — Regel-Betreff in der Gastsprache, sonst Katalog.

    Dieselbe Rangfolge wie beim Rumpf (0363): Fassung in der Gastsprache →
    Fassung in der Standardsprache des Betriebs → Grundfassung der Regel. Erst
    wenn die Regel ueberhaupt keinen Betreff hat (oder es gar keine Regel gibt,
    weil ein Mensch geschrieben hat), kommt der Katalogsatz.

    `sprache` ist der bereits aufgeloeste Mail-Sprachcode fuer den Katalog;
    `gastsprache` ist der ROHWERT der Buchung, den `fassung_waehlen` selbst
    normiert (eine Normierung an zwei Stellen liefe auseinander).
    """
    if automation_id:
        regel = (
            db.table("message_automation")
            .select("subject")
            .eq("id", automation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        fassungen = {
            r["lang"]: (r.get("subject") or "")
            for r in (
                db.table("message_automation_text")
                .select("lang, subject")
                .eq("tenant_id", tenant_id)
                .eq("automation_id", automation_id)
                .execute()
            ).data
            or []
        }
        gewaehlt, _lang = fassung_waehlen(
            fassungen,
            (regel[0].get("subject") if regel else None),
            gastsprache=gastsprache,
            standard=standardsprache(db, tenant_id),
        )
        if gewaehlt:
            return gewaehlt
    return mail_text(BETREFF_KEY, sprache)


def per_mail_senden(
    db: Client,
    tenant_id: str,
    *,
    customer: dict,
    text: str,
    automation_id: str | None,
    mail: MailService,
) -> InboxMessage:
    """Die Nachricht als E-Mail an den Gast. Gibt die gesendete Nachricht zurueck.

    Fehler-Abbildung, damit `planung._fehlerzustand` das Richtige daraus macht:
    * keine Adresse → 422, endgueltig (`failed`) — daran aendert kein Neuversuch
      etwas, und der Betrieb sieht den Grund an der Zeile.
    * SMTP-Stoerung → 502, voruebergehend (`pending`) — eine Stoerung von
      Minuten darf die Automail nicht loeschen (Wurzel 5).

    Die zurueckgegebene Nachricht traegt eine EIGENE ID (`mail:<uuid>`) und
    unsere Uhr als Zeitpunkt. Beides ist hier richtig: das Ereignis IST unser
    Versand, es gibt kein fremdes, dessen Zeitpunkt wir ersetzen wuerden
    (Wurzel 5b). Die ID ist zugleich der Idempotenz-Schluessel des Spiegels
    (`portal_messages.message_ref`).
    """
    empfaenger = gast_mail(customer)
    if not empfaenger:
        raise InboxError(
            "Diese Buchung hat keine E-Mail-Adresse des Gastes — ohne sie gibt "
            "es keinen Weg, ihn zu erreichen. Bitte die Adresse an der Buchung "
            "nachtragen.",
            status_code=422,
        )
    sprache = sprache_fuer_gast(
        db, guest_language=customer.get("language"), tenant_id=tenant_id
    )
    betreff = betreff_fuer(
        db,
        tenant_id,
        automation_id=automation_id,
        gastsprache=customer.get("language"),
        sprache=sprache,
    )
    inhalt = mail_rendern(
        MailInhalt(
            titel=betreff,
            # Der Text der Regel ist reiner Klartext (der Portal-Chat
            # uebertraegt kein HTML). Das Layout macht die Absaetze; wer hier
            # Markup hineingibt, bekommt es escaped zurueck (Wurzel 8).
            absaetze=[
                absatz.strip()
                for absatz in text.split("\n\n")
                if absatz.strip()
            ]
            or [text],
            sprache=sprache,
        )
    )
    try:
        mail.send(
            OutboundMessage(
                to=empfaenger,
                subject=betreff,
                text=inhalt.text,
                html=inhalt.html,
            )
        )
    except MailError as exc:
        log.warning(
            "inbox_mail_versand_fehlgeschlagen",
            tenant_id=tenant_id,
            error=str(exc)[:200],
        )
        raise InboxError(
            f"Die Nachricht konnte nicht per E-Mail zugestellt werden: {exc}",
            status_code=502,
        ) from exc
    return InboxMessage(
        id=f"mail:{uuid4().hex}",
        message=text,
        sender="property",
        sent_at=datetime.now(UTC).isoformat(),
    )
