"""Findet typografische Anführungszeichen IN Python-String-Literalen.

WARUM: Ein „ oder “ in einem f-String bricht das Literal — Python meldet
`unterminated string literal` mit einer Zeilennummer, die auf das FOLGENDE
Konstrukt zeigt. In einem gewöhnlichen String ist es dagegen völlig in Ordnung
(deutsche Texte gehören so gesetzt), und in Kommentaren und Docstrings sowieso.

Genau diese Mischung macht den Fehler teuer: Er sieht aus wie ein
Einrückungsproblem, tritt nur in manchen Zeilen auf, und am 30.08.2026 ist er
in einer Sitzung VIERMAL passiert — jedes Mal beim Schreiben einer Fehlermeldung
mit einem zitierten Wert darin.

GEPRÜFT WIRD DESHALB NUR, wo es wirklich bricht: f-Strings, deren typografisches
Zeichen dieselbe Art hat wie der umschliessende Quote. Alles andere ist erlaubt
und wird nicht gemeldet — ein Prüfskript, das richtige deutsche Typografie
anmeckert, wird nach zwei Tagen abgeschaltet.

Aufruf:
    python3 scripts/diagnose/typografische-quotes-pruefen.py [pfad …]
"""
from __future__ import annotations

import io
import sys
import tokenize
from pathlib import Path

# Die Zeichen, die als STRING-BEGRENZER missverstanden werden können.
# „ und “ sind harmlos, solange der String mit " begrenzt ist — das ist der
# Normalfall und wird nicht gemeldet. Gefährlich wird es, wenn ein Werkzeug
# (oder ein Modell) sie in eine Zeile schreibt, in der ein " erwartet wird.
VERDAECHTIG = '„“”‚‘’'

WURZELN = sys.argv[1:] or ["apps/api/src", "scripts"]


def pruefe(pfad: Path) -> list[tuple[int, str]]:
    """Zeilen, in denen ein String-Literal nicht mehr aufgeht."""
    quelle = pfad.read_text(encoding="utf-8")
    try:
        list(tokenize.generate_tokens(io.StringIO(quelle).readline))
    except tokenize.TokenError as exc:
        # Der Tokenizer bricht ab — das IST der Fehler. Die Zeile daneben
        # zeigen, damit man ihn sieht statt zu suchen.
        zeile = exc.args[1][0] if len(exc.args) > 1 and exc.args[1] else 0
        zeilen = quelle.split("\n")
        text = zeilen[zeile - 1].strip() if 0 < zeile <= len(zeilen) else ""
        return [(zeile, f"{exc.args[0]} — {text[:100]}")]
    except IndentationError as exc:
        return [(exc.lineno or 0, str(exc))]
    return []


def main() -> int:
    treffer = 0
    geprueft = 0
    for wurzel in WURZELN:
        for pfad in sorted(Path(wurzel).rglob("*.py")):
            if any(t in pfad.parts for t in (".venv", "__pycache__", "node_modules")):
                continue
            geprueft += 1
            for zeile, meldung in pruefe(pfad):
                treffer += 1
                print(f"✗ {pfad}:{zeile}\n    {meldung}")

    if treffer:
        print(
            f"\n{treffer} Datei(en) mit kaputtem String-Literal.\n"
            f"Häufigste Ursache: ein typografisches Anführungszeichen "
            f"({VERDAECHTIG}) in einem f-String.\n"
            "Im String-Literal nur ASCII-Quotes verwenden — in Kommentaren und "
            "Docstrings sind die typografischen richtig.\n"
        )
        return 1
    print(f"✓ {geprueft} Python-Dateien geprüft, alle String-Literale gehen auf.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
