"""KI-Textbaustein: einen Kopf- oder Fußtext für Angebot/Rechnung erzeugen.

Buchhaltung → Textvorlagen → „Mit KI erzeugen": der Betrieb sagt in einem
Satz, was der Text leisten soll („freundlich, Anzahlung erwähnen, kurz"), das
Modell schreibt den Baustein in der gewählten Sprache — mit den Platzhaltern
des Bestands (``[%VOLLEANREDE%]`` …), damit er auf jedem Beleg passt.

Regeln wie im Website-Baukasten (site_config.ki_texte): nichts erfinden, nur
Platzhalter aus der Liste, Sprache ausdrücklich vorgegeben, Tagesdeckel und
Buchung über ``site_config.ki_nutzung`` — EIN Zähler für alle KI-Funktionen
des Betriebs, sonst umgeht ein Bereich den Deckel des anderen.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field
from supabase import Client

from src.core.ki import KiAntwort, KiError, VertexClient
from src.core.languages import sprach_name
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.site_config import ki_nutzung
from src.features.site_config.ki_profil import profil_lesen

_BR_RE = re.compile(r"<br\s*/?>|</?p>", re.IGNORECASE)

log = get_logger("nextdays.buchhaltung.versand.ki_textbaustein")

# Platzhalter, die der Editor ersetzt (web/services/TextTemplateService.ts).
# Nur diese darf das Modell verwenden — ein erfundener Platzhalter stünde
# wörtlich im Beleg.
PLATZHALTER: tuple[str, ...] = (
    "[%VOLLEANREDE%]", "[%KUNDENNAME%]", "[%KUNDENNUMMER%]", "[%BETRAG%]",
    "[%NETTOBETRAG%]", "[%STEUERBETRAG%]", "[%ANGEBOTSNUMMER%]",
    "[%RECHNUNGSNUMMER%]", "[%ZAHLUNGSZIEL%]", "[%GUELTIG_BIS%]",
    "[%ANGEBOTSDATUM%]", "[%DATUM%]", "[%FIRMENNAME%]", "[%KONTAKTPERSON%]",
)
_MAX_WUNSCH = 1_000


class KiTextbausteinRequest(BaseModel):
    object_type: str = Field(pattern="^(QUOTE|INVOICE|REMINDER|CREDIT_NOTE|CANCELLATION)$")
    text_type: str = Field(pattern="^(HEAD|FOOT)$")
    language: str = Field(min_length=2, max_length=8)
    # Was der Text leisten soll — frei formuliert; leer = Standardbaustein.
    wunsch: str = Field(default="", max_length=_MAX_WUNSCH)


class KiTextbausteinAntwort(BaseModel):
    text: str
    name: str
    verbrauch_heute: int = 0
    tageslimit: int = 0


_ART = {
    "QUOTE": "ein Angebot für einen Aufenthalt (Hotel oder Ferienobjekt)",
    "INVOICE": "eine Rechnung für einen Aufenthalt (Hotel oder Ferienobjekt)",
    "REMINDER": "eine Zahlungserinnerung",
    "CREDIT_NOTE": "eine Gutschrift",
    "CANCELLATION": "eine Stornorechnung",
}
_POSITION = {
    "HEAD": "der Kopftext (Anrede und Einleitung über den Positionen, 2–3 Sätze)",
    "FOOT": "der Fußtext (Schluss unter den Summen: Zahlung bzw. Gültigkeit, Gruß, 2–4 Sätze)",
}


def _sprache_benennen(code: str) -> str:
    name = sprach_name(code[:2].lower())
    if not name:
        raise KiError(f"Unbekannte Sprache „{code}“.", status_code=422)
    return name


def textbaustein_erzeugen(
    db: Client, client: VertexClient, ctx: AuthContext, body: KiTextbausteinRequest
) -> KiTextbausteinAntwort:
    tenant_id = ctx.tenant_id or ""
    if not client.is_configured:
        raise KiError("Der KI-Assistent ist für dieses System nicht eingerichtet.", status_code=503)
    ki_nutzung.deckel_pruefen(db, tenant_id)
    profil = profil_lesen(db, tenant_id)
    sprache = _sprache_benennen(body.language)
    system = "\n".join([
        f"Du schreibst Textbausteine für Geschäftsbelege eines Beherbergungsbetriebs. "
        f"Schreibe ausschließlich auf {sprache}.",
        "",
        "NICHTS ERFINDEN: keine Beträge, Daten, Namen, Ausstattung oder Bedingungen "
        "ausschreiben — dafür gibt es Platzhalter. Verwende AUSSCHLIESSLICH diese "
        "Platzhalter, buchstabengetreu: " + ", ".join(PLATZHALTER) + ".",
        "Beginne einen Kopftext mit [%VOLLEANREDE%], gefolgt von einem Komma.",
        "Ende einen Fußtext mit einer Grußformel und [%KONTAKTPERSON%] in einer eigenen Zeile.",
        "Nüchtern, freundlich, konkret. Keine Werbefloskeln, keine Ausrufezeichen.",
        "Gib NUR den fertigen Text zurück als reinen Text: Absätze durch eine Leerzeile "
        "getrennt, KEIN HTML (kein <br>, kein <p>), kein Markdown, "
        "keine Anführungszeichen um das Ganze, keine Erklärung.",
    ] + ([f"Tonfall des Betriebs: {profil.ton}"] if profil.ton else []))
    user = (
        f"Belegart: {_ART.get(body.object_type, body.object_type)}.\n"
        f"Gesucht ist {_POSITION[body.text_type]}.\n"
        + (f"Wunsch des Betriebs: {body.wunsch.strip()}\n" if body.wunsch.strip() else "")
    )
    try:
        antwort: KiAntwort = client.erzeuge(
            system=system, user=user, temperature=0.4, max_tokens=400
        )
    except KiError as exc:
        if exc.status_code != 429:
            ki_nutzung.fehler_buchen(
                db, tenant_id, user_id=ctx.user_id, funktion="textbaustein",
                modell=client.modell, region=client.region, grund=exc.message,
            )
        raise
    ki_nutzung.buchen(db, tenant_id, user_id=ctx.user_id, funktion="textbaustein", antwort=antwort)
    # Der Baustein wird im Dialog als reiner Text bearbeitet; HTML-Umbrüche, die das
    # Modell trotz Anweisung setzt, werden zu Zeilenumbrüchen (14.09.2026: „<br/>“ im Feld).
    text = _BR_RE.sub("\n", antwort.text).strip().strip('"').strip()
    position = "Kopftext" if body.text_type == "HEAD" else "Fußtext"
    log.info(
        "ki_textbaustein_erzeugt", tenant_id=tenant_id, object_type=body.object_type,
        text_type=body.text_type, sprache=body.language, zeichen=len(text),
    )
    return KiTextbausteinAntwort(
        text=text,
        name=f"{body.object_type.title()} – {position} (KI)",
        verbrauch_heute=ki_nutzung.verbrauch_heute(db, tenant_id),
        tageslimit=ki_nutzung.tageslimit(),
    )
