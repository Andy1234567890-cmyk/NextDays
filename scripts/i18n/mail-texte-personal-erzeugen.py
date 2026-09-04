# -*- coding: utf-8 -*-
"""Erzeugt `apps/api/src/core/mail_texte_personal.py` aus den deutschen Sätzen
in `mail_texte_personal.de.json` und der Gemini-Übersetzung.

Aufruf (aus apps/api, weil `uebersetzen.py` die `.env` relativ zum cwd lädt):

    cd apps/api
    uv run python ../../scripts/i18n/uebersetzen.py \\
        ../../scripts/i18n/mail_texte_personal.de.json --aus /tmp/personal-mail.json
    uv run python ../../scripts/i18n/mail-texte-personal-erzeugen.py /tmp/personal-mail.json

Die Python-Datei ist GENERIERT — Änderungen an den Sätzen gehören in die
JSON-Quelle, sonst gehen sie beim nächsten Lauf verloren (dieselbe Lehre wie
bei `builder/lib/texte.ts`).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
ZIEL = WURZEL / "apps" / "api" / "src" / "core" / "mail_texte_personal.py"
QUELLE = WURZEL / "scripts" / "i18n" / "mail_texte_personal.de.json"

KOPF = '''"""Mailtexte des Personalbereichs (0541) — 24 EU-Amtssprachen.

Fachgebiet-Teil des Katalogs `core.mail_texte` (dort per `TEXTE.update` eingehängt).
Deutsch von Hand (scripts/i18n/mail_texte_personal.de.json), die übrigen 23 über
`scripts/i18n/uebersetzen.py` (Gemini/Vertex). Regel wie im Hauptkatalog: jeder
Schlüssel in allen 24 Sprachen, Platzhalter in jeder Fassung.

GENERIERT von scripts/i18n/mail-texte-personal-erzeugen.py — nicht von Hand ändern.
"""
# pylint: disable=line-too-long  # 24 Sprachfassungen je Satz — Umbrüche wären Rauschen
from __future__ import annotations

TEXTE_PERSONAL: dict[str, dict[str, str]] = {
'''


def main() -> int:
    if len(sys.argv) != 2:
        print("Aufruf: mail-texte-personal-erzeugen.py <uebersetzung.json>", file=sys.stderr)
        return 2
    uebersetzung = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    quelle = json.loads(QUELLE.read_text(encoding="utf-8"))
    keys: list[str] = uebersetzung["keys"]
    texte: dict[str, list[str]] = uebersetzung["texte"]
    if set(keys) != set(quelle):
        fehlend = set(quelle) - set(keys)
        zuviel = set(keys) - set(quelle)
        print(f"Schlüssel stimmen nicht: fehlend={sorted(fehlend)} zuviel={sorted(zuviel)}", file=sys.stderr)
        return 1
    sprachen = sorted(texte)
    if len(sprachen) != 24:
        print(f"Erwartet 24 Sprachen, bekommen {len(sprachen)}: {sprachen}", file=sys.stderr)
        return 1
    zeilen = [KOPF]
    for i, key in enumerate(keys):
        zeilen.append(f"    {json.dumps(key, ensure_ascii=False)}: {{\n")
        for sp in sprachen:
            wert = texte[sp][i] if sp != "de" else quelle[key]
            zeilen.append(f"        {json.dumps(sp)}: {json.dumps(wert, ensure_ascii=False)},\n")
        zeilen.append("    },\n")
    zeilen.append("}\n")
    ZIEL.write_text("".join(zeilen), encoding="utf-8")
    print(f"{ZIEL.relative_to(WURZEL)}: {len(keys)} Schlüssel × {len(sprachen)} Sprachen")
    return 0


if __name__ == "__main__":
    sys.exit(main())
