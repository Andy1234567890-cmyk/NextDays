#!/usr/bin/env python3
"""Prueft, dass jeder Eintrag in `core/mail_texte.py` alle Sprachen traegt.

WARUM ES DIESES SKRIPT GIBT
---------------------------
Der Katalog ist ein Python-Dict; eine fehlende Sprache ist kein Syntaxfehler und
kein Testfehler. Sie faellt erst dem Empfaenger auf — und zwar als Mail in einer
FREMDEN Sprache, denn `mail_text` faellt auf den Fallback zurueck. Live am
24.08.2026: ein daenischer Betrieb bekam „Neue Nachricht von Andreas Knudsen"
ueber einer englischen Gastnachricht, weil die sieben Betreffzeilen ueberhaupt
nicht im Katalog standen, sondern als deutsche Zeichenketten im Quelltext.

Die Soll-Sprachliste wird nicht hart gesetzt, sondern aus dem VOLLSTAENDIGSTEN
Eintrag abgeleitet. Damit wandert sie automatisch mit, wenn eine 25. Sprache
dazukommt — und ein neuer Eintrag mit nur `de`/`en` faellt sofort auf.

Gelesen wird per AST und nicht per Import: das Skript soll auch dann etwas
sagen koennen, wenn ringsum etwas nicht importierbar ist.

Aufruf: python3 scripts/i18n/mail-texte-pruefen.py
"""
from __future__ import annotations

import ast
import pathlib
import sys

DATEI = pathlib.Path(__file__).resolve().parents[2] / (
    "apps/api/src/core/mail_texte.py"
)


def katalog() -> dict[str, set[str]]:
    """Schluessel -> vorhandene Sprachcodes."""
    baum = ast.parse(DATEI.read_text(encoding="utf-8"))
    texte = None
    for knoten in baum.body:
        if not isinstance(knoten, ast.AnnAssign | ast.Assign):
            continue
        ziele = (
            [knoten.target] if isinstance(knoten, ast.AnnAssign) else knoten.targets
        )
        if any(isinstance(t, ast.Name) and t.id == "TEXTE" for t in ziele):
            texte = knoten.value
    if not isinstance(texte, ast.Dict):
        sys.exit(f"TEXTE in {DATEI} nicht gefunden")
    return {
        s.value: {k.value for k in w.keys if isinstance(k, ast.Constant)}
        for s, w in zip(texte.keys, texte.values, strict=True)
        if isinstance(s, ast.Constant) and isinstance(w, ast.Dict)
    }


def main() -> int:
    alle = katalog()
    if not alle:
        sys.exit("Katalog ist leer")
    soll = max(alle.values(), key=len)
    fehlt = {k: sorted(soll - v) for k, v in alle.items() if soll - v}
    for schluessel, sprachen in sorted(fehlt.items()):
        print(f"  {schluessel}: fehlt {', '.join(sprachen)}")
    if fehlt:
        print(
            f"\n{len(fehlt)} Eintrag/Eintraege unvollstaendig. Eine fehlende "
            "Sprache wird zur Mail im Fallback — der Empfaenger liest sie in "
            "einer Sprache, die er nicht gewaehlt hat."
        )
        return 1
    print(
        f"✓ Alle {len(alle)} Mailtexte tragen alle {len(soll)} Sprachen."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
