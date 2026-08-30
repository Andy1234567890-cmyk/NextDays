# -*- coding: utf-8 -*-
"""Deutsche Oberflächentexte in die 23 übrigen EU-Amtssprachen übersetzen — mit
Gemini über Vertex AI.

WARUM DIESES WERKZEUG EXISTIERT
===============================
Bis heute liefen Übersetzungen über Claude-Sub-Agenten. Gemessen am 25.08.2026:

    Gemini    40 Schlüssel × 24 Sprachen →   22 001 Token
    Agenten   40 Schlüssel × 24 Sprachen →  319 368 Token  (15× mehr)

Der Faktor 15 ist der kleinere Teil. Der größere: die Google-Token belasten das
Wochenkontingent von Claude **gar nicht**. Am 25.08.2026 sind sieben Bau-Agenten
an diesem Limit gestorben, davon vier reine Übersetzungs-Agenten — Arbeit, die
hier in einer Minute erledigt ist.

WO DIE GRENZE LIEGT
===================
Dieses Werkzeug ist für OBERFLÄCHENTEXTE: Beschriftungen, Leer-Zustände,
Knöpfe, kurze Hinweise. Für die gilt maschinelle Übersetzung als tauglich — sie
sind kurz, sachlich und haben kein Register, das man verfehlen kann.

NICHT dafür gedacht sind:
  * Rechtstexte (AGB, Datenschutz, Widerruf) — dort hängt Haftung an der
    Formulierung, und eine schiefe Übersetzung fällt niemandem auf, bis sie
    jemandem zum Nachteil gereicht.
  * Marketing-Fließtext — er soll überzeugen, nicht nur stimmen.
  * Alles, was ein Mensch als „Stimme des Betriebs" liest.

VORAUSSETZUNG
=============
Die Vertex-Anbindung muss eingerichtet sein (``VERTEX_SERVICE_ACCOUNT_B64``,
``VERTEX_PROJECT_ID``). Fehlt sie, bricht das Werkzeug LAUT ab statt still
nichts zu tun.

AUFRUF
======
    # 1. Deutsche Texte als JSON ablegen (Schlüssel → Text)
    #    { "meinKnopf": "Jetzt buchen", "meinLeer": "Noch nichts da." }
    #
    # 2. Übersetzen; Ergebnis nach stdout oder in eine Datei
    uv run python scripts/i18n/uebersetzen.py quelle.json --aus alle.json

    # 3. Direkt in die Sprachdateien schreiben (Namensraum als Pfad)
    uv run python scripts/i18n/uebersetzen.py quelle.json --ziel website.meinBereich

Das Ergebnis ist ``{"keys": [...], "texte": {"de": [...], "bg": [...], ...}}`` —
dieselbe Form, die ``renderer-texte-erzeugen.py`` erwartet.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Die 23 Zielsprachen mit ihrem deutschen Namen. Der Name geht in den Prompt:
# „Zielsprache: Maltesisch" trifft zuverlässiger als ein Kürzel.
ZIELSPRACHEN: dict[str, str] = {
    "bg": "Bulgarisch",
    "cs": "Tschechisch",
    "da": "Dänisch",
    "el": "Griechisch",
    "en": "Englisch",
    "es": "Spanisch",
    "et": "Estnisch",
    "fi": "Finnisch",
    "fr": "Französisch",
    "ga": "Irisch",
    "hr": "Kroatisch",
    "hu": "Ungarisch",
    "it": "Italienisch",
    "lt": "Litauisch",
    "lv": "Lettisch",
    "mt": "Maltesisch",
    "nl": "Niederländisch",
    "pl": "Polnisch",
    "pt": "Portugiesisch",
    "ro": "Rumänisch",
    "sk": "Slowakisch",
    "sl": "Slowenisch",
    "sv": "Schwedisch",
}

SYSTEM = (
    "Du übersetzt Oberflächentexte einer Buchungswebsite für Ferienunterkünfte. "
    "Antworte AUSSCHLIESSLICH mit einem JSON-Array von Zeichenketten — gleiche "
    "Länge und gleiche Reihenfolge wie die Eingabe. Keine Erklärung, kein "
    "Markdown, keine Code-Zäune.\n"
    "Regeln:\n"
    "· Platzhalter in geschweiften Klammern ({n}, {mb}, {netzwerk}) bleiben "
    "unverändert stehen — auch ihre Schreibweise.\n"
    "· Markennamen bleiben unverändert (myNextDays, myBestDays, WhatsApp, "
    "Facebook, Google).\n"
    "· Höflichkeitsform (Siezen), sachlicher Ton, keine Ausrufezeichen.\n"
    "· Beschriftungen kurz halten: sie stehen in schmalen Feldern."
)

#: Wie viele Schlüssel je Aufruf. Mehr wäre billiger, aber ein Aufruf, der
#: mitten in einer langen Liste abbricht, kostet die ganze Liste — und das
#: Zurückordnen über die Position ist dann nicht mehr überprüfbar.
STAPEL = 40

# Zusätzliche Grenze je Aufruf in ZEICHEN der deutschen Eingabe. 3000 ist
# konservativ gewählt: mit dem Faktor aus `_ausgabebudget` (1,4 Token/Zeichen)
# bleibt die Antwort selbst bei den teuersten Schriften klar unter dem, was ein
# Aufruf ausgeben darf. Lieber ein Aufruf mehr als eine abgeschnittene Antwort —
# ein halb übersetzter Rechtstext ist schlimmer als ein langsamerer Lauf.
STAPEL_ZEICHEN = 3000


def _client():  # noqa: ANN202 — der Typ kommt aus dem Slice
    """Den Vertex-Client holen. Bricht LAUT ab, wenn er nicht eingerichtet ist."""
    wurzel = Path(__file__).resolve().parents[2] / "apps" / "api"
    sys.path.insert(0, str(wurzel))
    from src.core.ki import VertexClient  # noqa: PLC0415

    c = VertexClient()
    if not c.is_configured:
        raise SystemExit(
            "Vertex AI ist nicht eingerichtet: VERTEX_SERVICE_ACCOUNT_B64 und "
            "VERTEX_PROJECT_ID fehlen. Ohne sie gibt es keine Übersetzung — "
            "und eine halbe wäre schlimmer als keine."
        )
    return c


def _stapel(de: list[str]) -> list[list[str]]:
    """Die Texte in Aufrufe aufteilen — nach ZEICHEN, nicht nur nach Anzahl.

    ``STAPEL`` allein (40 Stück) reicht als Grenze nicht: 27 Rechtsabsätze sind
    „unter 40 Stück" und trotzdem über 12 000 Zeichen. Griechisch und Bulgarisch
    brauchen dafür mehr Ausgabe-Token, als ein Aufruf liefern darf — die Antwort
    kam mitten im Wort abgeschnitten zurück (26.08.2026). Deshalb bricht ein
    Stapel jetzt bei ``STAPEL`` Stück ODER ``STAPEL_ZEICHEN`` Zeichen, was
    zuerst eintritt.

    Ein einzelner Text, der die Zeichengrenze allein überschreitet, bleibt
    bewusst sein eigener Stapel: kürzen dürfen wir ihn nicht (es ist der zu
    übersetzende Inhalt), und ein eigener Aufruf mit vollem Budget trägt ihn.
    """
    stapel: list[list[str]] = []
    laufend: list[str] = []
    zeichen = 0
    for text in de:
        if laufend and (
            len(laufend) >= STAPEL or zeichen + len(text) > STAPEL_ZEICHEN
        ):
            stapel.append(laufend)
            laufend, zeichen = [], 0
        laufend.append(text)
        zeichen += len(text)
    if laufend:
        stapel.append(laufend)
    return stapel


def _ausgabebudget(teil: list[str]) -> int:
    """Token-Obergrenze für die Antwort, bemessen an der LÄNGE der Eingabe.

    Vorher stand hier ``200 + 60 * len(teil)`` — gerechnet nach ANZAHL der
    Texte. Für Oberflächenbeschriftungen ("Jetzt buchen") trägt das; für lange
    Absätze bricht es. Live erlebt am 26.08.2026 beim Übersetzen der
    Rechtstexte: ein einzelner Absatz von ~1200 Zeichen bekam 260 Token, Gemini
    stoppte mit ``MAX_TOKENS`` mitten im Wort, und das Ergebnis war abgeschnittenes
    JSON — gemeldet als "Antwort ist kein JSON", was die Ursache verschleiert.

    Der Faktor 1,4 Token je Zeichen ist die reale Obergrenze für die teuersten
    Schriften: Griechisch, Bulgarisch und Maltesisch brauchen im Gemini-Tokenizer
    deutlich mehr Token pro Zeichen als Deutsch, weil sie außerhalb des
    lateinischen Grundbereichs liegen. Wer hier knapp rechnet, bekommt genau bei
    diesen Sprachen die abgeschnittene Antwort.

    Der Aufschlag von 200 deckt das JSON-Gerüst (Klammern, Anführungszeichen,
    Kommas). Ein zu großzügiges Budget kostet nichts: abgerechnet wird, was das
    Modell wirklich ausgibt, nicht das Limit.
    """
    zeichen = sum(len(t) for t in teil)
    return 200 + int(zeichen * 1.4) + 60 * len(teil)


def _auswerten(roh: str, teil: list[str], sprache: str, client):  # noqa: ANN001, ANN202
    """Die Antwort in eine Liste verwandeln — mit EINEM zweiten Versuch.

    Warum überhaupt ein zweiter Versuch: das Modell hält sich fast immer an
    „nur ein JSON-Array", aber nicht immer. Beobachtet am 25.08.2026: ein
    unmaskiertes Anführungszeichen mitten in einem Text, und der ganze Lauf
    über 24 Sprachen war verloren. Ein Wiederholen kostet Sekunden, ein
    verlorener Lauf kostet alles davor.

    Der zweite Versuch bekommt die Regel NOCHMAL und ausdrücklicher — nicht
    denselben Prompt erneut. Wer zweimal dasselbe fragt, bekommt zweimal
    dieselbe Antwort.
    """
    for versuch in (1, 2):
        text = roh.strip()
        if text.startswith("```"):
            # Manche Antworten kommen trotz Anweisung in Code-Zäunen.
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        try:
            werte = json.loads(text)
        except json.JSONDecodeError as exc:
            if versuch == 2:
                raise SystemExit(
                    f"{sprache}: Antwort ist kein JSON ({exc}). "
                    f"Anfang: {text[:200]!r}"
                ) from exc
            antwort = client.erzeuge(
                system=(
                    SYSTEM
                    + "\nWICHTIG: Die letzte Antwort war kein gültiges JSON. "
                    "Maskiere Anführungszeichen im Text als \\\" und gib "
                    "AUSSCHLIESSLICH das Array zurück."
                ),
                user=(
                    f"Zielsprache: {ZIELSPRACHEN[sprache]}.\n"
                    f"Eingabe:\n{json.dumps(teil, ensure_ascii=False)}"
                ),
                temperature=0.0,
                max_tokens=_ausgabebudget(teil),
            )
            roh = antwort.text
            continue
        if not isinstance(werte, list):
            raise SystemExit(f"{sprache}: Antwort ist kein Array.")
        return [str(w) for w in werte]
    raise SystemExit(f"{sprache}: unerreichbar")


def uebersetze(de: list[str], sprache: str, client) -> list[str]:  # noqa: ANN001
    """Eine Liste deutscher Texte in EINE Sprache übersetzen.

    Die Zuordnung läuft über die POSITION, nicht über Namen — deshalb wird die
    Länge geprüft. Eine Antwort mit einem Eintrag zu wenig würde sonst alle
    Texte darunter um eins verschieben, und das fällt erst dem Kunden auf.
    """
    ergebnis: list[str] = []
    for teil in _stapel(de):
        antwort = client.erzeuge(
            system=SYSTEM,
            user=(
                f"Zielsprache: {ZIELSPRACHEN[sprache]}.\n"
                f"Eingabe:\n{json.dumps(teil, ensure_ascii=False)}"
            ),
            temperature=0.1,
            max_tokens=_ausgabebudget(teil),
        )
        werte = _auswerten(antwort.text, teil, sprache, client)
        if len(werte) != len(teil):
            raise SystemExit(
                f"{sprache}: {len(werte)} Texte zurück, {len(teil)} erwartet. "
                "Abgebrochen — eine verschobene Liste ist schlimmer als keine."
            )
        ergebnis.extend(str(w) for w in werte)
    return ergebnis


def _in_sprachdateien(ziel: str, keys: list[str], texte: dict[str, list[str]]) -> None:
    """Das Ergebnis in ``web/messages/<code>.json`` schreiben.

    ``ziel`` ist der Namensraum als Punktpfad (``website.meinBereich``). Er wird
    angelegt, falls er fehlt. Bestehende Werte werden ÜBERSCHRIEBEN — wer das
    nicht will, prüft vorher; ein stilles Auslassen wäre die schlechtere
    Überraschung.
    """
    import collections  # noqa: PLC0415

    wurzel = Path(__file__).resolve().parents[2] / "web" / "messages"
    pfad = ziel.split(".")
    for code, werte in texte.items():
        datei = wurzel / f"{code}.json"
        if not datei.exists():
            raise SystemExit(f"{datei} fehlt.")
        daten = json.loads(
            datei.read_text(encoding="utf-8"),
            object_pairs_hook=collections.OrderedDict,
        )
        knoten = daten
        for teil in pfad:
            knoten = knoten.setdefault(teil, collections.OrderedDict())
        for k, w in zip(keys, werte, strict=True):
            knoten[k] = w
        datei.write_text(
            json.dumps(daten, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    print(f"{len(texte)} Sprachdateien aktualisiert ({ziel})", file=sys.stderr)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("quelle", help="JSON mit deutschen Texten (Schlüssel → Text)")
    p.add_argument(
        "--ziel",
        help="Namensraum als Punktpfad — dann direkt in web/messages/ schreiben",
    )
    p.add_argument(
        "--aus",
        help=(
            "Ausgabedatei für das JSON. NÖTIG, wenn nicht `--ziel` verwendet "
            "wird: der Vertex-Client protokolliert jeden Aufruf nach stdout, "
            "und ein Log mitten im JSON macht es unlesbar. Statt den Logger "
            "umzubiegen — er gehört dem Slice, nicht diesem Werkzeug — "
            "schreiben wir in eine Datei."
        ),
    )
    args = p.parse_args()

    quelle = json.loads(Path(args.quelle).read_text(encoding="utf-8"))
    keys = list(quelle)
    de = [quelle[k] for k in keys]
    if not keys:
        raise SystemExit("Die Quelldatei ist leer.")

    client = _client()
    texte = {"de": de}
    for code in ZIELSPRACHEN:
        texte[code] = uebersetze(de, code, client)
        print(f"  {code} ✓", file=sys.stderr)

    if args.ziel:
        _in_sprachdateien(args.ziel, keys, texte)
    if args.aus:
        Path(args.aus).write_text(
            json.dumps({"keys": keys, "texte": texte}, ensure_ascii=False, indent=1)
            + "\n",
            encoding="utf-8",
        )
        print(f"geschrieben: {args.aus}", file=sys.stderr)
    if not args.ziel and not args.aus:
        raise SystemExit(
            "Weder --ziel noch --aus angegeben. Ein Lauf ohne Ziel wäre "
            "verbrauchte Rechenzeit ohne Ergebnis."
        )


if __name__ == "__main__":
    main()
