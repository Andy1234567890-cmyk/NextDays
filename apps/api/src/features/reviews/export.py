"""CSV-Ausgabe der Bewertungsliste.

Warum die Spaltenwahl den Export MITSTEUERT und nicht ein eigenes Formular
bekommt: es ist eine Auswahl, kein Vorgang. Wer die Liste auf „Gast, Objekt,
Note" eingerichtet hat, will genau das exportieren — ein zweites Formular
danebenzustellen hieße, dieselbe Entscheidung zweimal zu verlangen und beim
nächsten Mal auseinanderlaufen zu lassen (Hostaway macht es an dieser Stelle
richtig, siehe docs/BEWERTUNGEN-HOSTAWAY-ANALYSE.md).

Der Export nimmt dieselben Filter wie die Liste. Was man sieht, bekommt man —
alles andere wäre eine Datei, die etwas anderes behauptet als der Bildschirm.
"""
from __future__ import annotations

import csv
import io
import re
from collections.abc import Callable
from datetime import datetime

from .schemas import UnifiedReview

# Alle exportierbaren Spalten mit ihrer Kopfzeile. Die Reihenfolge hier ist die
# Reihenfolge in der Datei — die Oberfläche kann Spalten ABWÄHLEN, aber nicht
# umsortieren: eine CSV, deren Spaltenfolge je Nutzer wechselt, ist für jede
# Weiterverarbeitung (Excel-Vorlage, Import) unbrauchbar.
SPALTEN: dict[str, str] = {
    "received_at": "Datum",
    "channel": "Kanal",
    "origin": "Herkunft",
    "author": "Gast",
    "property": "Objekt",
    "score": "Note",
    "scale": "Skala",
    "score_5": "Note (5er)",
    "text": "Bewertung",
    "reply": "Antwort",
    "replied": "Beantwortet",
    "hidden": "Verdeckt",
    "ai_sentiment": "Stimmung (KI)",
    "ai_themes": "Themen (KI)",
    "ai_summary": "Kernaussage (KI)",
}

# Ohne Auswahl: das, was die Tabelle standardmäßig zeigt.
STANDARD = (
    "received_at",
    "channel",
    "origin",
    "author",
    "property",
    "score_5",
    "text",
    "replied",
)


# Die Abschnittsmarker von Booking.com, nur am Zeilenanfang. Ein „Positive:"
# mitten im Satz eines Gastes ist Teil seines Satzes, kein Abschnittsbeginn.
_MARKER = re.compile(r"^(Headline|Positive|Negative)\s*:\s*", re.IGNORECASE)


def _lesbarer_text(roh: str | None) -> str:
    """Portal-Rohtext in einen lesbaren Absatz.

    SCHWESTERLOGIK zu ``web/lib/reviews-text.ts``. Bewusst keine gemeinsame
    Quelle: es sind zwei Sprachen und zwei Laufzeiten, und die Regel ist drei
    Zeilen lang. Wer sie hier aendert, aendert sie dort mit — steht in beiden
    Dateien so.

    Leere Abschnitte fallen WEG. Ein „Negative:" ohne Inhalt heisst „der Gast
    hat nichts Negatives geschrieben" und nicht „hier fehlt etwas".
    """
    text = (roh or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return ""
    zeilen = [z.strip() for z in text.split("\n")]
    if not any(_MARKER.match(z) for z in zeilen):
        return " ".join(z for z in zeilen if z)

    teile: dict[str, list[str]] = {
        "headline": [], "positive": [], "negative": [],
    }
    aktuell = "positive"
    for zeile in zeilen:
        treffer = _MARKER.match(zeile)
        if treffer:
            aktuell = treffer.group(1).lower()
            rest = _MARKER.sub("", zeile).strip()
            if rest:
                teile[aktuell].append(rest)
            continue
        if zeile:
            teile[aktuell].append(zeile)

    stuecke = []
    if teile["headline"]:
        stuecke.append(" ".join(teile["headline"]))
    if teile["positive"]:
        stuecke.append("+ " + " ".join(teile["positive"]))
    if teile["negative"]:
        stuecke.append("- " + " ".join(teile["negative"]))
    return " | ".join(stuecke)


def _ja_nein(wert: bool) -> str:
    return "ja" if wert else "nein"


# Wie eine Spalte zu ihrer Zelle kommt. Als TABELLE und nicht als Kette von
# if-Zweigen: es ist eine Zuordnung, keine Ablauflogik — und mit fünfzehn
# Spalten war die Kette eine Funktion mit siebzehn Ausgängen, in der ein
# vergessener Zweig still "" ergibt.
#
# Fehlende Werte bleiben LEER — nie "0", nie "–". Eine 0 in der Notenspalte
# wäre eine Bewertung mit null Sternen, und genau das steht bei einer
# verdeckten Bewertung nicht fest (Wurzel 4). In einer Tabellenkalkulation ist
# die leere Zelle das einzige, was „unbekannt" heißt.
_ZELLE: dict[str, Callable[[UnifiedReview], str]] = {
    "received_at": lambda r: (
        r.received_at.strftime("%Y-%m-%d")
        if isinstance(r.received_at, datetime)
        else ""
    ),
    "channel": lambda r: r.channel_code,
    # Wer bewertet hat. Hostaway führt das als eigene Spalte statt nur als
    # Zeilenfarbe — richtig so: nach einer Farbe lässt sich weder filtern noch
    # exportieren.
    "origin": lambda _: "Gast",
    "author": lambda r: r.author,
    "property": lambda r: r.property_title or "",
    "score": lambda r: "" if r.score is None else str(r.score),
    "scale": lambda r: r.scale.value,
    "score_5": lambda r: "" if r.score_5 is None else f"{r.score_5:.2f}",
    "text": lambda r: _lesbarer_text(r.text),
    "reply": lambda r: r.reply or "",
    "replied": lambda r: _ja_nein(r.is_replied),
    "hidden": lambda r: _ja_nein(r.is_hidden),
    "ai_sentiment": lambda r: r.ai.stimmung.value if r.ai else "",
    "ai_themes": lambda r: (
        "; ".join(f"{t.thema.value}:{t.richtung.value}" for t in r.ai.themen)
        if r.ai
        else ""
    ),
    "ai_summary": lambda r: (r.ai.kernaussage or "") if r.ai else "",
}


def als_csv(reviews: list[UnifiedReview], spalten: list[str] | None = None) -> str:
    """Die Liste als CSV-Text.

    Semikolon als Trenner und BOM voran: das ist die Kombination, mit der
    Excel eine UTF-8-CSV in Europa ohne Import-Assistenten korrekt öffnet.
    Mit Komma und ohne BOM landen Umlaute als Mojibake und alles in einer
    Spalte — und der Nutzer hält die Datei für kaputt, nicht Excel.
    """
    gewaehlt = [s for s in SPALTEN if s in set(spalten or STANDARD)]
    if not gewaehlt:
        gewaehlt = list(STANDARD)

    puffer = io.StringIO()
    schreiber = csv.writer(puffer, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    schreiber.writerow([SPALTEN[s] for s in gewaehlt])
    for review in reviews:
        schreiber.writerow([_ZELLE[s](review) for s in gewaehlt])
    return "﻿" + puffer.getvalue()
