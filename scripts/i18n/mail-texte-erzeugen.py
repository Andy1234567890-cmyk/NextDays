# -*- coding: utf-8 -*-
"""Erzeugt einen Fachgebiets-Teilkatalog `apps/api/src/core/mail_texte_<gebiet>.py`
aus den deutschen Sätzen in `mail_texte_<gebiet>.de.json` und der Gemini-Übersetzung.

WARUM GENERISCH UND NICHT JE GEBIET EIN SKRIPT:
Der erste Teilkatalog (Personal, 0541) hatte sein eigenes Erzeuger-Skript mit
Gebietsname, Zielpfad und Kopftext als Literale. Beim zweiten Gebiet (Angebote,
0586) wäre daraus eine Kopie geworden — und damit zwei Stellen, die auseinander
laufen, sobald sich der Kopftext oder die Sprachprüfung ändert. Das Gebiet ist
jetzt ein Argument; `mail-texte-personal-erzeugen.py` ruft nur noch hierher
durch, damit der bekannte Aufruf weiter funktioniert.

Aufruf (aus apps/api, weil `uebersetzen.py` die `.env` relativ zum cwd lädt):

    cd apps/api
    uv run python ../../scripts/i18n/uebersetzen.py \\
        ../../scripts/i18n/mail_texte_angebote.de.json --aus /tmp/angebote-mail.json
    uv run python ../../scripts/i18n/mail-texte-erzeugen.py angebote /tmp/angebote-mail.json

Die erzeugte Python-Datei ist GENERIERT — Änderungen an den Sätzen gehören in
die JSON-Quelle, sonst gehen sie beim nächsten Lauf verloren (dieselbe Lehre wie
bei `builder/lib/texte.ts`).

Nach dem Lauf muss der neue Teilkatalog in `core/mail_texte.py` per
`TEXTE.update(...)` eingehängt sein — sonst findet `text()` die Schlüssel nicht
und `test_mail_texte.py` sieht sie nicht. Das Skript prüft das und sagt es.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
KATALOG = WURZEL / "apps" / "api" / "src" / "core" / "mail_texte.py"

# Anzahl der EU-Amtssprachen, in denen JEDER Mailtext stehen muss. Als Zahl und
# nicht als Liste: die Liste ist `buchhaltung.doc_i18n.SUPPORTED` (eine Quelle,
# siehe mail_sprache.py) — hier wird nur geprüft, dass die Übersetzung
# vollständig geliefert wurde.
SPRACHEN_ERWARTET = 24

KOPF = '''"""Mailtexte {titel} ({herkunft}) — {n} EU-Amtssprachen.

Fachgebiet-Teil des Katalogs `core.mail_texte` (dort per `TEXTE.update` eingehängt).
Deutsch von Hand (scripts/i18n/mail_texte_{gebiet}.de.json), die übrigen {n_minus} über
`scripts/i18n/uebersetzen.py` (Gemini/Vertex). Regel wie im Hauptkatalog: jeder
Schlüssel in allen {n} Sprachen, Platzhalter in jeder Fassung.

GENERIERT von scripts/i18n/mail-texte-erzeugen.py — nicht von Hand ändern.
"""
# pylint: disable=line-too-long  # {n} Sprachfassungen je Satz — Umbrüche wären Rauschen
from __future__ import annotations

{konstante}: dict[str, dict[str, str]] = {{
'''

# Was der Kopf je Gebiet über sich sagt. Ein unbekanntes Gebiet bricht ab statt
# einen erfundenen Titel zu schreiben (Wurzel 4).
GEBIETE = {
    "personal": ("des Personalbereichs", "0541"),
    "angebote": ("der Buchungsangebote", "0586"),
}


def main() -> int:
    if len(sys.argv) != 3:
        print(
            "Aufruf: mail-texte-erzeugen.py <gebiet> <uebersetzung.json>",
            file=sys.stderr,
        )
        return 2
    gebiet = sys.argv[1]
    if not re.fullmatch(r"[a-z_]+", gebiet):
        print(f"Gebiet {gebiet!r}: nur Kleinbuchstaben und _", file=sys.stderr)
        return 2
    if gebiet not in GEBIETE:
        print(
            f"Gebiet {gebiet!r} ist unbekannt. Bekannt: {', '.join(sorted(GEBIETE))}. "
            "Ein neues Gebiet wird in GEBIETE eingetragen (Titel + Migration).",
            file=sys.stderr,
        )
        return 2
    titel, herkunft = GEBIETE[gebiet]
    quell_pfad = WURZEL / "scripts" / "i18n" / f"mail_texte_{gebiet}.de.json"
    ziel = WURZEL / "apps" / "api" / "src" / "core" / f"mail_texte_{gebiet}.py"
    konstante = f"TEXTE_{gebiet.upper()}"

    if not quell_pfad.exists():
        print(f"{quell_pfad.relative_to(WURZEL)} fehlt.", file=sys.stderr)
        return 1
    uebersetzung = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    quelle = json.loads(quell_pfad.read_text(encoding="utf-8"))
    keys: list[str] = uebersetzung["keys"]
    texte: dict[str, list[str]] = uebersetzung["texte"]
    if set(keys) != set(quelle):
        fehlend = set(quelle) - set(keys)
        zuviel = set(keys) - set(quelle)
        print(
            f"Schlüssel stimmen nicht: fehlend={sorted(fehlend)} zuviel={sorted(zuviel)}",
            file=sys.stderr,
        )
        return 1
    sprachen = sorted(texte)
    if len(sprachen) != SPRACHEN_ERWARTET:
        print(
            f"Erwartet {SPRACHEN_ERWARTET} Sprachen, bekommen {len(sprachen)}: {sprachen}",
            file=sys.stderr,
        )
        return 1
    zeilen = [
        KOPF.format(
            titel=titel,
            herkunft=herkunft,
            gebiet=gebiet,
            konstante=konstante,
            n=SPRACHEN_ERWARTET,
            n_minus=SPRACHEN_ERWARTET - 1,
        )
    ]
    for i, key in enumerate(keys):
        zeilen.append(f"    {json.dumps(key, ensure_ascii=False)}: {{\n")
        for sp in sprachen:
            wert = texte[sp][i] if sp != "de" else quelle[key]
            zeilen.append(
                f"        {json.dumps(sp)}: {json.dumps(wert, ensure_ascii=False)},\n"
            )
        zeilen.append("    },\n")
    zeilen.append("}\n")
    ziel.write_text("".join(zeilen), encoding="utf-8")
    print(f"{ziel.relative_to(WURZEL)}: {len(keys)} Schlüssel × {len(sprachen)} Sprachen")

    # Ein Teilkatalog, der nicht eingehängt ist, ist unsichtbar: `text()` wirft
    # MailTextFehlt und der Vollständigkeitstest prüft ihn nicht. Laut melden
    # statt still erzeugen (Wurzel 5).
    if f"TEXTE.update({konstante})" not in KATALOG.read_text(encoding="utf-8"):
        print(
            f"ACHTUNG: {konstante} ist in core/mail_texte.py nicht per "
            f"`TEXTE.update({konstante})` eingehängt — die Schlüssel sind sonst "
            "nicht auffindbar.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
