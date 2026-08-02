"""Der myNextDays-Template-Satz für WhatsApp und dessen Ausrollen in eine WABA.

Warum das hier als Code liegt und nicht von Hand in Metas Oberfläche geklickt
wird: Templates hängen an der WABA, und im Multi-Tenant-Ausbau bekommt JEDER
Betrieb seine eigene WABA (Embedded Signup). Meta bietet keinen Bulk-Push über
mehrere WABAs — der Provider muss denselben Satz je Kunden-WABA einzeln anlegen.
Genau das macht ``rollout`` und wird beim Onboarding je neuer WABA aufgerufen.

Kategorien: alles UTILITY (transaktionsbezogen). MARKETING wäre teurer, würde
Opt-in verlangen und für Buchungsbestätigungen abgelehnt.

Variablen sind positionell (``{{1}}``, ``{{2}}`` …) mit Beispielwerten — ohne
``example`` lehnt Meta die Vorlage ab. Medien (Bild/Video/Datei) sind bewusst
nicht enthalten: sie erhöhen die Ablehnungsquote und bringen bei
Buchungsvorgängen keinen Nutzen.
"""
from __future__ import annotations

from typing import Any

from src.core.logging import get_logger

from .client import WhatsAppClient, WhatsAppError

log = get_logger("nextdays.whatsapp.templates")

FOOTER = "Diese Nachricht wurde automatisch gesendet."


def _body(text: str, beispiel: list[str]) -> list[dict[str, Any]]:
    return [
        {"type": "BODY", "text": text, "example": {"body_text": [beispiel]}},
        {"type": "FOOTER", "text": FOOTER},
    ]


# name -> {sprachcode: (text, beispielwerte)}. Der Name ist je WABA eindeutig und
# über alle Sprachen derselbe — Meta führt Übersetzungen unter einem Namen.
TEMPLATE_SATZ: dict[str, dict[str, tuple[str, list[str]]]] = {
    "buchung_bestaetigt": {
        "de": (
            "Hallo {{1}}, vielen Dank für Ihre Buchung. Ihr Aufenthalt in {{2}} "
            "ist bestätigt: Anreise am {{3}}, Abreise am {{4}}, Buchungsnummer "
            "{{5}}. Wir freuen uns auf Ihren Besuch und melden uns vor der "
            "Anreise mit allen Details.",
            ["Anna Berg", "Haus Nordlicht", "12.09.2026", "19.09.2026", "ND-24170"],
        ),
        "en": (
            "Hello {{1}}, thank you for your booking. Your stay at {{2}} is "
            "confirmed: arrival on {{3}}, departure on {{4}}, booking number "
            "{{5}}. We look forward to welcoming you and will send all details "
            "before you arrive.",
            ["Anna Berg", "Haus Nordlicht", "12/09/2026", "19/09/2026", "ND-24170"],
        ),
    },
    "checkin_information": {
        "de": (
            "Hallo {{1}}, morgen ist Ihre Anreise in {{2}}. Der Check-in ist ab "
            "{{3}} möglich, die Adresse lautet {{4}}. Bei Fragen antworten Sie "
            "einfach auf diese Nachricht.",
            ["Anna Berg", "Haus Nordlicht", "15:00", "Strandweg 4, 8300 Odder"],
        ),
        "en": (
            "Hello {{1}}, your arrival at {{2}} is tomorrow. Check-in is "
            "possible from {{3}} and the address is {{4}}. If you have any "
            "questions, simply reply to this message.",
            ["Anna Berg", "Haus Nordlicht", "3:00 PM", "Strandweg 4, 8300 Odder"],
        ),
    },
    "zahlungserinnerung": {
        "de": (
            "Hallo {{1}}, für Ihre Buchung {{2}} ist noch ein Betrag von {{3}} "
            "offen. Fällig ist er am {{4}} — bitte begleichen Sie ihn "
            "rechtzeitig, damit Ihre Buchung erhalten bleibt.",
            ["Anna Berg", "ND-24170", "248,00 EUR", "05.09.2026"],
        ),
        "en": (
            "Hello {{1}}, an amount of {{3}} is still outstanding for your "
            "booking {{2}}. It is due on {{4}} — please settle it in time so "
            "that your booking remains valid.",
            ["Anna Berg", "ND-24170", "248.00 EUR", "05/09/2026"],
        ),
    },
    "buchung_storniert": {
        "de": (
            "Hallo {{1}}, Ihre Buchung {{2}} für {{3}} wurde storniert. "
            "Bei Fragen antworten Sie einfach auf diese Nachricht.",
            ["Anna Berg", "ND-24170", "Haus Nordlicht"],
        ),
        "en": (
            "Hello {{1}}, your booking {{2}} for {{3}} has been cancelled. "
            "If you have any questions, simply reply to this message.",
            ["Anna Berg", "ND-24170", "Haus Nordlicht"],
        ),
    },
    "rechnung_bezahlt": {
        "de": (
            "Hallo {{1}}, wir haben Ihre Zahlung für Rechnung {{2}} über {{3}} "
            "erhalten. Vielen Dank!",
            ["Anna Berg", "R-2026-0042", "248,00 EUR"],
        ),
        "en": (
            "Hello {{1}}, we have received your payment of {{3}} for invoice "
            "{{2}}. Thank you!",
            ["Anna Berg", "R-2026-0042", "248.00 EUR"],
        ),
    },
}


def rollout(client: WhatsAppClient) -> dict[str, list[str]]:
    """Den Satz in die WABA des Clients ausrollen. Idempotent.

    Bereits vorhandene (Name, Sprache)-Paare werden übersprungen — Meta lehnt
    Duplikate mit einem Fehler ab, und ein zweiter Aufruf (Retry, erneutes
    Onboarding) darf nicht scheitern (Wurzel 2).

    Ein einzelner abgelehnter Text darf den Rest nicht mitreißen: der Fehler
    wird pro Vorlage gesammelt und zurückgegeben, statt die ganze Schleife
    abzubrechen. Verbindungs-/Auth-Fehler (503) sind kein Vorlagenproblem und
    werden weitergeworfen.
    """
    vorhanden = {
        (t.get("name"), t.get("language")) for t in client.list_templates()
    }
    angelegt: list[str] = []
    uebersprungen: list[str] = []
    fehler: list[str] = []
    for name, sprachen in TEMPLATE_SATZ.items():
        for sprache, (text, beispiel) in sprachen.items():
            kennung = f"{name}/{sprache}"
            if (name, sprache) in vorhanden:
                uebersprungen.append(kennung)
                continue
            try:
                client.create_template(
                    {
                        "name": name,
                        "category": "UTILITY",
                        "language": sprache,
                        "components": _body(text, beispiel),
                    }
                )
            except WhatsAppError as exc:
                if exc.status_code == 503:  # nicht konfiguriert → hart durchlassen
                    raise
                log.warning(
                    "template_abgelehnt", template=kennung, grund=exc.message
                )
                fehler.append(f"{kennung}: {exc.message}")
                continue
            angelegt.append(kennung)
    log.info(
        "template_rollout",
        angelegt=len(angelegt),
        uebersprungen=len(uebersprungen),
        fehler=len(fehler),
    )
    return {
        "angelegt": angelegt,
        "uebersprungen": uebersprungen,
        "fehler": fehler,
    }
