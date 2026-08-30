"""Fakten aus gesendeten Nachrichten lernen — still im Hintergrund.

Jede Antwort, die ein MENSCH an einen Gast sendet, wird ausgewertet. Findet das
Modell darin einen Fakt, der noch nicht in der Wissensdatenbank steht, legt es
ihn an — mit Quelle ``Nachrichten``. Ohne Rückfrage, ohne zusätzlichen Klick.

Der Betrieb macht damit einfach das, was er ohnehin tut: den Gästen antworten.

WAS NICHT AUSGEWERTET WIRD, und das ist kein Detail:

    quelle='ki'          eigene KI-Antworten — sonst lernt sie von sich selbst
    quelle='automation'  Automails — Vorlagentext, kein Wissen
    eingehende           das ist die Frage, nicht die Antwort

Ohne den ersten Ausschluss schriebe die KI ihre eigenen Formulierungen als
„Fakten" fort und verstärkte jeden Fehler, den sie einmal gemacht hat. Aus einer
einzigen falschen Antwort würde binnen Wochen ein Bestand falscher Fakten, die
alle richtig aussehen.

BEST EFFORT: Schlägt die Auswertung fehl, ist die Nachricht trotzdem beim Gast
— sie ist das Wichtigere. Der Fehler wird geloggt, nicht geworfen.

DIE KONTROLLE SITZT DANACH, nicht davor: Objektliste nach „Geändert" sortieren,
oben stehen die Objekte mit den neuesten Fakten; der Filter „Quelle =
Nachrichten" zeigt gezielt die gelernten. Das ist derselbe Weg, den die Vorlage
empfiehlt.
"""
from __future__ import annotations

import json
import re

from supabase import Client

from src.core.ki import KiError, VertexClient
from src.core.logging import get_logger
from src.features.site_config.ki_nutzung import buchen, deckel_pruefen

from .ki_wissen import KATEGORIEN

log = get_logger("nextdays.inbox.ki_lernen")

FUNKTION = "wissen_lernen"

# Nur aus Nachrichten von Menschen. Die Menge steht hier und nicht als
# Negativliste („alles ausser ki"), damit eine NEUE Quelle nicht versehentlich
# mitlernt: wer `quelle='newsletter'` einführt, muss sie hier bewusst zulassen.
QUELLEN_ZUM_LERNEN = frozenset({"manuell"})

# Kürzer als das ist keine Antwort mit Wissen darin, sondern „Gerne!".
MIN_ZEICHEN = 60
MAX_ZEICHEN = 4_000

# Wurzel 8: aus einer Nachricht werden höchstens so viele Fakten. Eine lange
# Antwort auf fünf Fragen trägt vielleicht fünf Fakten, nicht dreissig.
MAX_JE_NACHRICHT = 5

# Wie viele bestehende Fakten für die Dublettenprüfung geladen werden.
MAX_BESTAND = 200

MAX_ANTWORT_TOKENS = 800

_SYSTEM = (
    "Du liest EINE Nachricht, die ein Gastgeber an einen Gast geschickt hat, "
    "und ziehst daraus Fakten über die Unterkunft oder den Betrieb.\n"
    "Ein Fakt darf nur mit, wenn er AUCH FÜR DEN NÄCHSTEN GAST gilt.\n"
    "Nimm NICHT mit:\n"
    "- Absprachen mit diesem einen Gast („Ich lege Ihnen den Schlüssel unter "
    "die Matte“, „Sie dürfen ausnahmsweise später abreisen“)\n"
    "- Begrüssungen, Dank, Höflichkeitsfloskeln\n"
    "- Terminzusagen und Bezüge auf dieses Datum („morgen um 15 Uhr“)\n"
    "- Angaben über diesen Gast (Name, Personenzahl, Buchungsnummer)\n"
    "Nimm mit, was dauerhaft gilt: Zugangswege, Ausstattung, Hausregeln, "
    "Öffnungszeiten, Empfehlungen in der Umgebung, Abläufe.\n"
    "Steht nichts Dauerhaftes darin, antworte mit einem leeren Array.\n"
    f"Höchstens {MAX_JE_NACHRICHT} Fakten.\n"
    "Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne Rahmentext und ohne "
    'Markdown-Zaun. Jedes Element: {"titel": "…", "text": "…", '
    '"kategorie": "…"}. '
    f"Erlaubte Kategorien: {', '.join(KATEGORIEN)}."
)

_WORT = re.compile(r"[^\W\d_]+", re.UNICODE)


def _kern(text: str) -> frozenset[str]:
    """Die bedeutungstragenden Wörter eines Fakts, kleingeschrieben.

    Grundlage der Dublettenprüfung. Absichtlich grob: eine echte
    Ähnlichkeitsmessung (Embeddings) wäre hier ein zweiter Vertex-Aufruf je
    Nachricht — für eine Entscheidung, bei der ein Fehler billig ist (ein Fakt
    zu viel oder zu wenig)."""
    return frozenset(w.lower() for w in _WORT.findall(text or "") if len(w) > 3)


def _ist_dublette(neu: str, bestand: list[str]) -> bool:
    """Sagt der neue Fakt dasselbe wie ein vorhandener?

    Ohne diese Prüfung stünde das WLAN-Passwort nach zwanzig Antworten
    zwanzigmal in der Wissensdatenbank — jedes Mal etwas anders formuliert, und
    keines davon löschbar, ohne alle zu lesen."""
    kern_neu = _kern(neu)
    if not kern_neu:
        return True  # Ein Fakt ohne Wörter ist keiner.
    for alt in bestand:
        kern_alt = _kern(alt)
        if not kern_alt:
            continue
        gemeinsam = len(kern_neu & kern_alt)
        # 70 % der Wörter des NEUEN Fakts stehen schon da → nichts Neues.
        if gemeinsam / len(kern_neu) >= 0.7:
            return True
    return False


def _json_liste(roh: str) -> list[dict]:
    text = (roh or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    try:
        daten = json.loads(text)
    except json.JSONDecodeError:
        # Hier bewusst STILL: das Lernen ist best effort und läuft im
        # Hintergrund. Eine Ausnahme würde den Versandpfad kippen, und der ist
        # das Wichtigere. Geloggt wird es beim Aufrufer.
        return []
    if isinstance(daten, dict):
        for wert in daten.values():
            if isinstance(wert, list):
                daten = wert
                break
    return [d for d in daten if isinstance(d, dict)] if isinstance(daten, list) else []


def aus_nachricht_lernen(
    db: Client,
    tenant_id: str,
    *,
    text: str,
    property_id: str | None,
    thread_id: str,
    quelle: str,
    client: VertexClient | None = None,
) -> int:
    """Eine gesendete Nachricht auswerten. Gibt die Zahl neuer Fakten zurück.

    Wirft NICHT: der Aufrufer steht direkt hinter einem erfolgreichen Versand,
    und eine Ausnahme hier würde eine bereits zugestellte Nachricht als Fehler
    aussehen lassen.
    """
    if quelle not in QUELLEN_ZUM_LERNEN:
        return 0
    inhalt = (text or "").strip()
    if len(inhalt) < MIN_ZEICHEN:
        return 0
    inhalt = inhalt[:MAX_ZEICHEN]

    try:
        return _lernen(db, tenant_id, inhalt, property_id, thread_id, client)
    except (KiError, ValueError, KeyError, TypeError) as exc:
        # Eng gefangen und LAUT geloggt (Wurzel 5): stumm bliebe es für immer
        # unbemerkt, dass die Wissensdatenbank nicht mehr wächst.
        log.warning(
            "ki_lernen_fehlgeschlagen",
            tenant_id=tenant_id,
            thread_id=thread_id,
            grund=type(exc).__name__,
            fehler=str(exc)[:200],
        )
        return 0


def _lernen(
    db: Client,
    tenant_id: str,
    inhalt: str,
    property_id: str | None,
    thread_id: str,
    client: VertexClient | None,
) -> int:
    deckel_pruefen(db, tenant_id)
    ki = client or VertexClient()
    antwort = ki.erzeuge(
        system=_SYSTEM,
        user=f"Nachricht des Gastgebers:\n\n{inhalt}",
        temperature=0.1,
        max_tokens=MAX_ANTWORT_TOKENS,
    )
    buchen(db, tenant_id, user_id=None, funktion=FUNKTION, antwort=antwort)

    vorschlaege = _json_liste(antwort.text)[:MAX_JE_NACHRICHT]
    if not vorschlaege:
        return 0

    bestand = _bestand_laden(db, tenant_id, property_id)
    quelle_id = _quelle_anlegen(db, tenant_id, property_id, thread_id)

    zeilen = []
    for v in vorschlaege:
        fakt = str(v.get("text") or "").strip()[:2000]
        if len(fakt) < 15 or _ist_dublette(fakt, bestand):
            continue
        kategorie = str(v.get("kategorie") or "sonstiges").strip()
        zeilen.append(
            {
                "tenant_id": tenant_id,
                "property_id": property_id,
                "titel": str(v.get("titel") or "").strip()[:200] or None,
                "fact": fakt,
                "kategorie": kategorie if kategorie in KATEGORIEN else "sonstiges",
                "source": "message",
                "source_ref": thread_id,
                "quelle_id": quelle_id,
            }
        )
        # Der frisch angelegte Fakt zählt für die nächste Prüfung MIT: sonst
        # legte eine Nachricht mit zwei ähnlichen Sätzen beide an.
        bestand.append(fakt)

    if not zeilen:
        return 0
    eingefuegt = db.table("inbox_knowledge_fact").insert(zeilen).execute().data or []
    log.info(
        "ki_gelernt",
        tenant_id=tenant_id,
        thread_id=thread_id,
        property_id=property_id,
        neue_fakten=len(eingefuegt),
        vorschlaege=len(vorschlaege),
    )
    return len(eingefuegt)


def _bestand_laden(
    db: Client, tenant_id: str, property_id: str | None
) -> list[str]:
    q = (
        db.table("inbox_knowledge_fact")
        .select("fact")
        .eq("tenant_id", tenant_id)
    )
    q = (
        q.or_(f"property_id.eq.{property_id},property_id.is.null")
        if property_id
        else q.is_("property_id", "null")
    )
    zeilen = q.limit(MAX_BESTAND).execute().data or []
    return [str(z.get("fact") or "") for z in zeilen]


def _quelle_anlegen(
    db: Client, tenant_id: str, property_id: str | None, thread_id: str
) -> str | None:
    """Die Herkunftszeile. Ohne sie stünde später nicht mehr fest, AUS WELCHEM
    Gespräch ein Fakt stammt — und ein zweifelhafter Fakt wäre nicht
    überprüfbar."""
    zeilen = (
        db.table("ki_wissen_quelle")
        .insert(
            {
                "tenant_id": tenant_id,
                "property_id": property_id,
                "art": "nachricht",
                "thread_id": thread_id,
            }
        )
        .execute()
    ).data or []
    return str(zeilen[0]["id"]) if zeilen else None
