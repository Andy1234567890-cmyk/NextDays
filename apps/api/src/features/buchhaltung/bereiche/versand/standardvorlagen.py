"""Standard-Textvorlagen eines Betriebs (Kopf-/Fußtext für Angebot und Rechnung).

Der Editor bietet im Kopf- und Fußtext ein Menü „Textvorlage". Bis zum
14.09.2026 war ``POST /text-templates/{company}/initialize`` ein No-Op und die
Tabelle blieb leer — das Menü zeigte „Keine Textvorlagen verfügbar", obwohl
der Bestand Standardvorlagen versprach. Hier entstehen sie: je Belegart ein
Kopf- und ein Fußtext in der Standardsprache des Betriebs (``tenants.
default_language``); Deutsch, Englisch und Dänisch ausformuliert, jede andere
Sprache bekommt Englisch. Nur Platzhalter, die der Editor kennt
(``[%VOLLEANREDE%]`` … ``[%KONTAKTPERSON%]``, web/services/TextTemplateService.ts).

Idempotent: gibt es schon Vorlagen, wird nichts angelegt.
"""

from __future__ import annotations

from src.core.logging import get_logger
from src.core.mail_empfaenger import betriebs_sprache
from src.core.security import AuthContext

from .schemas import TextTemplateCreate
from .service import VersandService

log = get_logger("nextdays.buchhaltung.versand.standardvorlagen")

_TEXTE: dict[str, dict[str, dict[str, str]]] = {
    "de": {
        "QUOTE": {
            "name_head": "Angebot – Anschreiben",
            "head": (
                "[%VOLLEANREDE%],<br/><br/>vielen Dank für Ihre Anfrage. Gerne unterbreiten "
                "wir Ihnen unser Angebot für Ihren Aufenthalt."
            ),
            "name_foot": "Angebot – Schlusstext",
            "foot": (
                "Dieses Angebot ist gültig bis [%GUELTIG_BIS%]. Zusagen und bezahlen können Sie "
                "über den Link in unserer E-Mail; mit dem Zahlungseingang ist die Buchung "
                "verbindlich.<br/><br/>Mit freundlichen Grüßen<br/>[%KONTAKTPERSON%]"
            ),
        },
        "INVOICE": {
            "name_head": "Rechnung – Anschreiben",
            "head": (
                "[%VOLLEANREDE%],<br/><br/>vielen Dank für Ihren Aufenthalt. Wir stellen Ihnen "
                "folgende Leistungen in Rechnung."
            ),
            "name_foot": "Rechnung – Zahlungshinweis",
            "foot": (
                "Bitte überweisen Sie den Betrag von [%BETRAG%] bis zum [%ZAHLUNGSZIEL%] unter "
                "Angabe der Rechnungsnummer [%RECHNUNGSNUMMER%].<br/><br/>Mit freundlichen "
                "Grüßen<br/>[%KONTAKTPERSON%]"
            ),
        },
    },
    "en": {
        "QUOTE": {
            "name_head": "Offer – cover text",
            "head": (
                "[%VOLLEANREDE%],<br/><br/>thank you for your enquiry. We are pleased to submit "
                "our offer for your stay."
            ),
            "name_foot": "Offer – closing text",
            "foot": (
                "This offer is valid until [%GUELTIG_BIS%]. You can accept and pay via the link "
                "in our e-mail; the booking becomes binding once payment is received.<br/><br/>"
                "Kind regards<br/>[%KONTAKTPERSON%]"
            ),
        },
        "INVOICE": {
            "name_head": "Invoice – cover text",
            "head": (
                "[%VOLLEANREDE%],<br/><br/>thank you for your stay. We invoice the following "
                "services."
            ),
            "name_foot": "Invoice – payment note",
            "foot": (
                "Please transfer [%BETRAG%] by [%ZAHLUNGSZIEL%] quoting invoice number "
                "[%RECHNUNGSNUMMER%].<br/><br/>Kind regards<br/>[%KONTAKTPERSON%]"
            ),
        },
    },
    "da": {
        "QUOTE": {
            "name_head": "Tilbud – indledning",
            "head": (
                "[%VOLLEANREDE%],<br/><br/>tak for din forespørgsel. Vi fremsender hermed vores "
                "tilbud på dit ophold."
            ),
            "name_foot": "Tilbud – afslutning",
            "foot": (
                "Tilbuddet gælder til [%GUELTIG_BIS%]. Du kan acceptere og betale via linket i "
                "vores e-mail; bookingen er bindende, når betalingen er modtaget.<br/><br/>"
                "Med venlig hilsen<br/>[%KONTAKTPERSON%]"
            ),
        },
        "INVOICE": {
            "name_head": "Faktura – indledning",
            "head": (
                "[%VOLLEANREDE%],<br/><br/>tak for dit ophold. Vi fakturerer følgende ydelser."
            ),
            "name_foot": "Faktura – betalingsoplysning",
            "foot": (
                "Overfør venligst [%BETRAG%] senest [%ZAHLUNGSZIEL%] med angivelse af "
                "fakturanummer [%RECHNUNGSNUMMER%].<br/><br/>Med venlig hilsen<br/>"
                "[%KONTAKTPERSON%]"
            ),
        },
    },
}


def standardvorlagen_anlegen(svc: VersandService, ctx: AuthContext) -> int:
    """Legt die Standardvorlagen an, wenn der Betrieb noch keine hat. Gibt die
    Zahl der angelegten Vorlagen zurück (0 = es gab schon welche)."""
    if svc.list_text_templates(ctx, limit=1):
        return 0
    tenant_id = ctx.tenant_id or ""
    # Betriebssprache; ohne Eintrag oder ohne Fassung → Englisch (kein Deutsch
    # für einen dänischen Betrieb, Wurzel 4).
    sprache = (betriebs_sprache(svc.db, tenant_id) or "en").lower()[:2]
    texte = _TEXTE.get(sprache) or _TEXTE["en"]
    sprache = sprache if sprache in _TEXTE else "en"
    angelegt = 0
    for object_type, t in texte.items():
        for text_type, name, text in (
            ("HEAD", t["name_head"], t["head"]),
            ("FOOT", t["name_foot"], t["foot"]),
        ):
            svc.create_text_template(
                ctx,
                TextTemplateCreate(
                    name=name,
                    category="DOCUMENT",
                    object_type=object_type,  # type: ignore[arg-type]
                    text_type=text_type,  # type: ignore[arg-type]
                    text=text,
                    language=sprache,
                    is_default=True,
                    is_private=False,
                ),
            )
            angelegt += 1
    log.info("standardvorlagen_angelegt", tenant_id=tenant_id, sprache=sprache, anzahl=angelegt)
    return angelegt
