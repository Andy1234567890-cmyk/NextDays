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

from .client import WhatsAppClient, WhatsAppError, WhatsAppRateLimitError
from .vorlagen_felder import nach_meta

log = get_logger("nextdays.whatsapp.templates")

FOOTER = "Diese Nachricht wurde automatisch gesendet."


def _body(text: str, beispiel: list[str]) -> list[dict[str, Any]]:
    return [
        {"type": "BODY", "text": text, "example": {"body_text": [beispiel]}},
        {"type": "FOOTER", "text": FOOTER},
    ]


# name -> {sprachcode: text}. Der Name ist je WABA eindeutig und über alle
# Sprachen derselbe — Meta führt Übersetzungen unter einem Namen.
#
# Die Texte stehen in UNSERER Schreibweise, mit den benannten Feldern aus
# ``inbox.felder``. Metas positionelle Form ({{1}}) und die Beispielwerte, die
# er zu jedem Platzhalter verlangt, entstehen erst beim Ausrollen
# (``vorlagen_felder.nach_meta``). Vorher standen hier Metas Positionen und die
# Beispiele von Hand — zwei Schreibweisen für dieselbe Sache, und beim
# Bearbeiten in der Oberfläche sah der Betrieb „{{1}}" statt des Feldnamens.
TEMPLATE_SATZ: dict[str, dict[str, str]] = {
    "buchung_bestaetigt": {
        "de": (
            "Hallo {{guest_name}}, vielen Dank für Ihre Buchung. Ihr Aufenthalt "
            "in {{property_name}} ist bestätigt: Anreise am {{check_in}}, "
            "Abreise am {{check_out}}, Buchungsnummer {{reservation_code}}. "
            "Wir freuen uns auf Ihren Besuch und melden uns vor der Anreise mit "
            "allen Details."
        ),
        "en": (
            "Hello {{guest_name}}, thank you for your booking. Your stay at "
            "{{property_name}} is confirmed: arrival on {{check_in}}, departure "
            "on {{check_out}}, booking number {{reservation_code}}. We look "
            "forward to welcoming you and will send all details before you "
            "arrive."
        ),
    },
    "checkin_information": {
        "de": (
            "Hallo {{guest_name}}, morgen ist Ihre Anreise in "
            "{{property_name}}. Der Check-in ist ab {{checkin_time}} möglich, "
            "die Adresse lautet {{property_address}}. Bei Fragen antworten Sie "
            "einfach auf diese Nachricht."
        ),
        "en": (
            "Hello {{guest_name}}, your arrival at {{property_name}} is "
            "tomorrow. Check-in is possible from {{checkin_time}} and the "
            "address is {{property_address}}. If you have any questions, simply "
            "reply to this message."
        ),
    },
    "zahlungserinnerung": {
        "de": (
            "Hallo {{guest_name}}, für Ihre Buchung {{reservation_code}} ist "
            "noch ein Betrag von {{amount_due}} offen. Bitte begleichen Sie ihn "
            "rechtzeitig, damit Ihre Buchung erhalten bleibt."
        ),
        "en": (
            "Hello {{guest_name}}, an amount of {{amount_due}} is still "
            "outstanding for your booking {{reservation_code}}. Please settle "
            "it in time so that your booking remains valid."
        ),
    },
    "buchung_storniert": {
        "de": (
            "Hallo {{guest_name}}, Ihre Buchung {{reservation_code}} für "
            "{{property_name}} wurde storniert. Bei Fragen antworten Sie "
            "einfach auf diese Nachricht."
        ),
        "en": (
            "Hello {{guest_name}}, your booking {{reservation_code}} for "
            "{{property_name}} has been cancelled. If you have any questions, "
            "simply reply to this message."
        ),
    },
    "rechnung_bezahlt": {
        "de": (
            "Hallo {{guest_name}}, wir haben Ihre Zahlung über "
            "{{paid_amount}} für die Buchung {{reservation_code}} erhalten. "
            "Vielen Dank!"
        ),
        "en": (
            "Hello {{guest_name}}, we have received your payment of "
            "{{paid_amount}} for booking {{reservation_code}}. Thank you!"
        ),
    },
}


def satz_feldreihenfolgen() -> dict[tuple[str, str], list[str]]:
    """Feldreihenfolge je (Name, Sprache) für den myNextDays-Satz.

    Aus dem Code abgeleitet, nicht aus der Datenbank: für unsere eigenen
    Vorlagen ist die Reihenfolge hier bekannt, auch wenn sie ausgerollt wurden,
    bevor es die Zuordnungstabelle gab. Damit zeigt die Oberfläche sofort
    ``{{guest_name}}`` statt Metas ``{{1}}`` — ohne dass jemand erst etwas
    anklicken muss.
    """
    return {
        (name, sprache): nach_meta(text)[1]
        for name, sprachen in TEMPLATE_SATZ.items()
        for sprache, text in sprachen.items()
    }


def rollout(client: WhatsAppClient) -> dict[str, object]:
    """Den Satz in die WABA des Clients ausrollen. Idempotent.

    Bereits vorhandene (Name, Sprache)-Paare werden übersprungen — Meta lehnt
    Duplikate mit einem Fehler ab, und ein zweiter Aufruf (Retry, erneutes
    Onboarding) darf nicht scheitern (Wurzel 2).

    Ein einzelner abgelehnter Text darf den Rest nicht mitreißen: der Fehler
    wird pro Vorlage gesammelt und zurückgegeben, statt die ganze Schleife
    abzubrechen. Verbindungs-/Auth-Fehler (503) sind kein Vorlagenproblem und
    werden weitergeworfen.

    Eine Drosselung bricht dagegen SOFORT ab: weiterzusenden verlängert nach
    Metas eigener Ansage die Sperre, und die zehn identischen Fehlermeldungen
    sähen für den Betrieb aus wie zehn inhaltlich abgelehnte Texte.
    """
    # `frisch=True`: an dieser Liste hängt die Idempotenz (Wurzel 2). Ein
    # Zwischenstand von vor einer Minute könnte eine gerade gelöschte Vorlage
    # noch führen — sie würde übersprungen und fehlte danach dauerhaft.
    vorhanden = {
        (t.get("name"), t.get("language"))
        for t in client.list_templates(frisch=True)
    }
    angelegt: list[str] = []
    uebersprungen: list[str] = []
    fehler: list[str] = []
    # Position -> Feld je (Name, Sprache). Der Aufrufer schreibt sie nach
    # `whatsapp_template_field`; ohne sie stuende beim Bearbeiten spaeter
    # Metas {{1}} im Editor statt des Feldnamens.
    felder: dict[str, list[str]] = {}
    for name, sprachen in TEMPLATE_SATZ.items():
        for sprache, text in sprachen.items():
            kennung = f"{name}/{sprache}"
            meta_text, reihenfolge, beispiele = nach_meta(text)
            felder[kennung] = reihenfolge
            if (name, sprache) in vorhanden:
                uebersprungen.append(kennung)
                continue
            try:
                client.create_template(
                    {
                        "name": name,
                        "category": "UTILITY",
                        "language": sprache,
                        "components": _body(meta_text, beispiele),
                    }
                )
            except WhatsAppRateLimitError:
                # Metas Best Practice: bei erreichtem Limit KEINE weiteren
                # Aufrufe — jeder zusätzliche verlängert die Sperre. Die
                # Schleife bricht deshalb ab, statt neun weitere Vorlagen
                # hinterherzuschicken. Ohne dieses eigene `except` fängt das
                # `WhatsAppError` unten die Drosselung mit und meldet sie als
                # abgelehnten Vorlagentext (Wurzel 5).
                raise
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
        # Auch fuer die uebersprungenen: sie koennen aus einem Rollout stammen,
        # der aelter ist als die Zuordnungstabelle. Genau so werden die
        # bestehenden Vorlagen nachtraeglich lesbar.
        "felder": felder,
    }
