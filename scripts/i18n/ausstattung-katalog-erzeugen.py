# -*- coding: utf-8 -*-
"""Erzeugt apps/api/src/features/booking_engine/ausstattung_texte.py — die
Ausstattungs-Bezeichnungen in den 24 EU-Amtssprachen, für den Renderer.

DER BEFUND (0474)
=================
Die Objektseite der Kunden-Website zeigte die rohen Codes: „nd_parking_included",
„first_aid_kit_available", „smoke_alarms". Sichtbar geworden in der Vorschau der
Buchungsstrecke — der Ausstattungs-Baustein rendert, was das Backend liefert,
und das Backend lieferte Slugs.

Die Labels gab es längst, nur an der falschen Stelle: in ``web/messages/*.json``
unter ``amenities`` (301), ``eigeneAusstattung`` (99) und ``roomAmenities``
(191). Das ist der Katalog des DASHBOARDS. Der Renderer ist eine eigene App mit
eigenem Textkatalog (``builder/lib/texte.ts``) und kommt dort nicht heran.

WARUM DER SERVER SIE LIEFERT UND NICHT DER RENDERER SIE NACHSCHLÄGT
==================================================================
Die naheliegende Lösung wäre, die 591 Einträge nach ``builder/lib/texte.ts`` zu
kopieren. Dagegen sprechen zwei Dinge:

1. Es wäre eine zweite Wahrheit über dieselben Labels. Ein Merkmal, das im
   Dashboard „Parkmöglichkeit inklusive" heißt und auf der Website anders, ist
   genau der Drift, den Wurzel 2 verbietet.
2. Der Renderer ist nicht der einzige Verbraucher. Dieselben Labels braucht die
   Gast-Mail, das Gast-Portal und der Marktplatz. Jede App mit eigener Kopie
   wäre eine weitere Stelle, die beim nächsten neuen Merkmal vergessen wird.

Der Server hat die Objektdaten ohnehin in der Hand und kennt die Sprache der
Website. Er liefert die Bezeichnung mit — der Renderer zeigt, was er bekommt.

WARUM GENERIERT UND NICHT VON HAND GEPFLEGT
===========================================
``web/messages`` bleibt die QUELLE: dort pflegt das Übersetzungs-Werkzeug
(``uebersetzen.py``), dort greifen die bestehenden i18n-Gates. Diese Datei ist
ein Abzug davon. Von Hand gepflegt wären es zwei Kataloge, die auseinanderlaufen
— und zwar still, weil ein fehlendes Label nur ein Slug in der Anzeige ist.

Deckungsgleich gehalten von ``scripts/i18n/ausstattung-katalog-pruefen.mjs``.

AUFRUF
======
    python3 scripts/i18n/ausstattung-katalog-erzeugen.py
"""

from __future__ import annotations

import json
import pathlib

WURZEL = pathlib.Path(__file__).resolve().parents[2]
NACHRICHTEN = WURZEL / "web" / "messages"
ZIEL = (
    WURZEL
    / "apps"
    / "api"
    / "src"
    / "features"
    / "booking_engine"
    / "ausstattung_texte.py"
)

#: Die Namensräume in der Reihenfolge, in der sie GEWINNEN.
#:
#: Dieselbe Reihenfolge wie ``web/lib/use-amenity-labels.ts``: der
#: Portal-Katalog (``amenities``) schlägt die eigenen Merkmale. 31 Codes stehen
#: in ``amenities`` UND ``roomAmenities``, teils mit abweichendem Text
#: („Kindersicherheitsgitter" vs. „Treppenschutzgitter") — ohne feste
#: Reihenfolge entschiede die Laufreihenfolge eines Dicts, welcher gilt.
#:
#: ``roomAmenities`` steht ZULETZT: es ist der Zimmer-Katalog (Channex
#: /room_facilities), und ein Objekt-Merkmal soll nicht dessen Fassung tragen.
NAMENSRAEUME = ("amenities", "eigeneAusstattung", "roomAmenities")


def sammle() -> tuple[list[str], dict[str, list[str]]]:
    """Alle Codes und ihre Labels je Sprache.

    Gibt ``(codes, {sprache: [label je code]})`` zurück — Codes und Labels über
    die POSITION verbunden, wie in ``renderer-texte-erzeugen.py``. Das hält die
    erzeugte Datei klein: 24 Listen statt 24 Dicts mit je 500 Schlüsseln.
    """
    dateien = sorted(NACHRICHTEN.glob("*.json"))
    if not dateien:
        raise SystemExit(f"Keine Sprachdateien in {NACHRICHTEN}")

    # Die Code-Liste kommt aus DEUTSCH und nicht aus der Vereinigung aller
    # Sprachen: eine Sprache mit einem überzähligen Schlüssel würde sonst die
    # Liste verlängern, und alle anderen bekämen dort einen leeren Wert.
    de = json.loads((NACHRICHTEN / "de.json").read_text(encoding="utf-8"))
    codes: list[str] = []
    gesehen: set[str] = set()
    for ns in NAMENSRAEUME:
        for code in de.get(ns, {}):
            if code not in gesehen:
                gesehen.add(code)
                codes.append(code)

    texte: dict[str, list[str]] = {}
    for datei in dateien:
        sprache = datei.stem
        daten = json.loads(datei.read_text(encoding="utf-8"))
        werte = []
        for code in codes:
            label = ""
            for ns in NAMENSRAEUME:
                wert = daten.get(ns, {}).get(code)
                if isinstance(wert, str) and wert.strip():
                    label = wert
                    break
            # Leer bleibt leer. KEIN Rückfall auf Deutsch: ein deutsches Label
            # in der griechischen Fassung wäre ein deutscher Restwert, den das
            # Gate `deutsche-restwerte-pruefen.mjs` zu Recht meldet. Der
            # Nachschlag im Server fällt bei leer auf Englisch zurück, und wenn
            # auch das fehlt, gibt er den Code aus (das ist ehrlicher als ein
            # Wort in der falschen Sprache).
            werte.append(label)
        texte[sprache] = werte
    return codes, texte


#: Die Zeilenlaenge, die `ruff` in diesem Projekt erlaubt (pyproject: E501).
_MAX = 100
#: Einrueckung der Labelzeilen im erzeugten Modul.
_EIN = " " * 8


def _label_zeilen(sicher: str) -> list[str]:
    """Ein Label als eine oder mehrere Quelltextzeilen unter `_MAX` Zeichen.

    WARUM UEBERHAUPT UMBRECHEN
    ==========================
    24 Labels sind laenger als 100 Zeichen — der bulgarische Satz ueber
    Einweg-Toilettenartikel misst 112. Sie standen als eine Zeile im erzeugten
    Modul, und `ruff check` meldete 24x E501. Das ist kein Schoenheitsfehler:
    das Qualitaetsgate verlangt einen sauberen `ruff`-Lauf, und wer davor 24
    bekannte Fehler stehen sieht, liest den 25. — den echten — nicht mehr.

    Von Hand ist die Datei nicht zu reparieren: sie wird ERZEUGT, der naechste
    Lauf haette die langen Zeilen zurueckgeschrieben. Der Umbruch gehoert
    deshalb hierher, nicht in die Ausgabe.

    WIE
    ===
    Implizite String-Verkettung ueber mehrere Zeilen (`"a " "b"`) — Python
    fuegt sie zur Uebersetzungszeit zusammen, ohne Laufzeitkosten und ohne
    dass sich der Wert aendert. Getrennt wird an LEERZEICHEN, und das
    Leerzeichen bleibt am Ende des vorderen Stuecks stehen; sonst verschwaende
    es im Umbruch und aus zwei Woertern wuerde eines.

    Ein einzelnes Wort, das allein schon zu lang ist, bleibt zu lang: es
    mittendrin zu trennen wuerde den Text veraendern. Das kommt in keiner der
    24 Sprachen vor und waere ein Datenfehler, kein Formatproblem.
    """
    voll = f'{_EIN}"{sicher}",\n'
    if len(voll.rstrip("\n")) <= _MAX:
        return [voll]

    # Nutzlaenge je Zeile: ohne Einrueckung und die beiden Anfuehrungszeichen.
    platz = _MAX - len(_EIN) - 2
    teile: list[str] = []
    rest = sicher
    while len(rest) > platz:
        schnitt = rest.rfind(" ", 0, platz)
        if schnitt <= 0:
            break
        teile.append(rest[: schnitt + 1])
        rest = rest[schnitt + 1 :]
    teile.append(rest)

    # Die LETZTE Zeile traegt zusaetzlich das Komma und hat damit ein Zeichen
    # weniger Platz als die uebrigen. Ohne diese Unterscheidung blieben genau
    # die Labels bei 101 Zeichen stehen, die den Umbruch exakt ausfuellten.
    if len(teile[-1]) > platz - 1:
        schnitt = teile[-1].rfind(" ", 0, platz)
        if schnitt > 0:
            rest_teil = teile[-1]
            teile[-1] = rest_teil[: schnitt + 1]
            teile.append(rest_teil[schnitt + 1 :])

    zeilen = [f'{_EIN}"{t}"\n' for t in teile[:-1]]
    zeilen.append(f'{_EIN}"{teile[-1]}",\n')
    return zeilen


def schreibe(codes: list[str], texte: dict[str, list[str]]) -> None:
    zeilen: list[str] = []
    zeilen.append('"""Ausstattungs-Bezeichnungen in den 24 EU-Amtssprachen.\n')
    zeilen.append("ERZEUGT von scripts/i18n/ausstattung-katalog-erzeugen.py —\n")
    zeilen.append("NICHT von Hand bearbeiten. Die Quelle sind die Namensräume\n")
    zeilen.append("`amenities`, `eigeneAusstattung` und `roomAmenities` in\n")
    zeilen.append("`web/messages/<sprache>.json`; dort wird gepflegt.\n\n")
    zeilen.append("Warum der Server diese Labels führt und nicht der Renderer:\n")
    zeilen.append("siehe den Kopf des Generators. Kurz: der Renderer, die\n")
    zeilen.append("Gast-Mail und der Marktplatz brauchen dieselben Texte, und\n")
    zeilen.append("jede App mit eigener Kopie ist eine Stelle, die beim\n")
    zeilen.append('nächsten neuen Merkmal vergessen wird.\n"""\n\n')
    # Ein Katalog aus 24 Sprachen × rund 580 Merkmalen ist eine Tabelle, keine
    # Logik — pylints Modulgrenze (1500 Zeilen) misst hier nichts Sinnvolles.
    # Der Schalter steht im GENERATOR, weil die Datei bei jedem Lauf neu
    # geschrieben wird; von Hand eingetragen wäre er beim nächsten Mal weg.
    zeilen.append("# pylint: disable=too-many-lines\n\n")
    zeilen.append("from __future__ import annotations\n\n")

    zeilen.append("#: Die Codes in der Reihenfolge, in der die Labels stehen.\n")
    zeilen.append("CODES: tuple[str, ...] = (\n")
    for code in codes:
        zeilen.append(f'    "{code}",\n')
    zeilen.append(")\n\n")

    zeilen.append("#: Sprache -> Labels, über die POSITION zu CODES verbunden.\n")
    zeilen.append("_LABELS: dict[str, tuple[str, ...]] = {\n")
    for sprache in sorted(texte):
        zeilen.append(f'    "{sprache}": (\n')
        for wert in texte[sprache]:
            sicher = wert.replace("\\", "\\\\").replace('"', '\\"')
            zeilen.extend(_label_zeilen(sicher))
        zeilen.append("    ),\n")
    zeilen.append("}\n\n")

    zeilen.append('''#: Code -> Position, damit der Nachschlag O(1) ist. Bei 591 Codes und einem
#: Objekt mit 70 Merkmalen wären es sonst 41 000 Vergleiche je Seitenaufruf.
_POSITION: dict[str, int] = {code: i for i, code in enumerate(CODES)}


def bezeichnung(code: str, sprache: str) -> str:
    """Das Label eines Codes, oder der CODE selbst.

    Der Code als Rückfall ist Absicht: ein unbekanntes Merkmal (Altbestand, ein
    neuer Channex-Katalogeintrag) soll sichtbar bleiben, damit es auffällt und
    nachgetragen wird. Es stillschweigend zu verschlucken hieße, dass ein Objekt
    Ausstattung verliert, ohne dass jemand den Grund sieht (Wurzel 5).

    Fehlt das Label in DIESER Sprache, gilt Englisch — nicht Deutsch: die
    Website eines dänischen Betriebs soll im Zweifel Englisch zeigen, und 27
    Länder verstehen davon mehr.
    """
    pos = _POSITION.get(code)
    if pos is None:
        return code
    for kandidat in (sprache, "en"):
        werte = _LABELS.get(kandidat)
        if werte is not None:
            wert = werte[pos]
            if wert:
                return wert
    return code


def bezeichnungen(codes: list[str] | tuple[str, ...], sprache: str) -> list[str]:
    """Labels einer ganzen Liste, in unveränderter Reihenfolge.

    Die Reihenfolge kommt aus dem Objekt und wird NICHT sortiert: sie ist die,
    die der Betrieb gepflegt hat.
    """
    return [bezeichnung(c, sprache) for c in codes]
''')

    ZIEL.write_text("".join(zeilen), encoding="utf-8")


def main() -> None:
    codes, texte = sammle()
    schreibe(codes, texte)
    print(f"{ZIEL.relative_to(WURZEL)}: {len(texte)} Sprachen x {len(codes)} Codes")


if __name__ == "__main__":
    main()
