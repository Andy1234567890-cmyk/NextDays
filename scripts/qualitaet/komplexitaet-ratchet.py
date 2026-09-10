#!/usr/bin/env python3
"""Komplexitaets-Ratchet fuer apps/api — „darf nur sinken".

WARUM DIESES SKRIPT EXISTIERT
Die ruff-Auswahl in apps/api/pyproject.toml enthielt jahrelang KEIN `C90` und
kein `PLR`: die Komplexitaetsregeln waren nie scharf geschaltet. So wuchsen
536 Verstoesse unbemerkt, darunter eine Funktion mit 797 Zeilen. Eine harte
Schwelle einzuschalten geht nicht — sie waere am Tag 1 rot und wuerde
abgeschaltet. Also: strenge Schwellen setzen, den Altbestand EINMAL einfrieren
und ab sofort jede Verschlechterung ablehnen.

Kein `# noqa`-Massenlauf (`ruff check --add-noqa`): der schreibt in jede
betroffene Zeile, zerstoert `git blame` und maskiert die Funktion DAUERHAFT —
auch wenn sie spaeter von 200 auf 400 Zeilen waechst. Das waere ein still
verschlucktes Kontrollsignal, also genau Wurzel 5. Die Baseline hier zaehlt je
Datei und Regel; waechst eine Zahl, bricht der Lauf.

Die Baseline zaehlt PRO DATEI, nicht global: eine reine Gesamtsumme liesse sich
austricksen, indem man Komplexitaet von einer Datei in die naechste schiebt.

AUFRUF
    python3 scripts/qualitaet/komplexitaet-ratchet.py            # pruefen
    python3 scripts/qualitaet/komplexitaet-ratchet.py --neu      # Baseline neu
    python3 scripts/qualitaet/komplexitaet-ratchet.py --bericht  # schlimmste
"""

from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
ZIEL = WURZEL / "apps/api/src"
BASIS_DATEI = Path(__file__).parent / "komplexitaet-basis.json"

# Schwellen bewusst STRENGER als der Bestand: der Ratchet faengt den Altbestand
# ab, die Schwelle gilt fuer alles Neue. Werte nach SonarSource/McCabe-Praxis
# (CC > 15 = schwer testbar), nicht am Bestand ausgerichtet.
REGELN = {
    "C901": "lint.mccabe.max-complexity=15",
    "PLR0912": "lint.pylint.max-branches=15",
    "PLR0915": "lint.pylint.max-statements=60",
    "PLR0913": "lint.pylint.max-args=8",
    "PLR0911": "lint.pylint.max-returns=8",
}


def messen() -> dict[str, dict[str, int]]:
    """Verstoesse je Datei und Regel — der Ist-Stand."""
    befehl = [
        "ruff", "check", str(ZIEL),
        "--select", ",".join(REGELN),
        "--no-cache", "--output-format", "json",
    ]
    for wert in REGELN.values():
        befehl += ["--config", wert]
    roh = subprocess.run(befehl, capture_output=True, text=True, check=False)
    if roh.returncode not in (0, 1):
        print(roh.stderr, file=sys.stderr)
        raise SystemExit("ruff konnte nicht laufen")
    stand: dict[str, Counter] = {}
    for fund in json.loads(roh.stdout or "[]"):
        datei = str(Path(fund["filename"]).relative_to(WURZEL))
        stand.setdefault(datei, Counter())[fund["code"]] += 1
    return {d: dict(c) for d, c in sorted(stand.items())}


def schreiben(stand: dict[str, dict[str, int]]) -> None:
    BASIS_DATEI.write_text(
        json.dumps(stand, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    jetzt = messen()
    gesamt = sum(sum(r.values()) for r in jetzt.values())

    if arg == "--neu":
        schreiben(jetzt)
        print(f"Baseline geschrieben: {gesamt} Verstoesse in {len(jetzt)} Dateien.")
        return 0

    if arg == "--bericht":
        rang = sorted(jetzt.items(), key=lambda kv: -sum(kv[1].values()))
        print(f"{gesamt} Verstoesse in {len(jetzt)} Dateien. Schlimmste:")
        for datei, regeln in rang[:20]:
            teile = ", ".join(f"{k}×{v}" for k, v in sorted(regeln.items()))
            print(f"  {sum(regeln.values()):3d}  {datei}  ({teile})")
        return 0

    if not BASIS_DATEI.exists():
        print("Keine Baseline. Einmalig anlegen: --neu", file=sys.stderr)
        return 2

    basis = json.loads(BASIS_DATEI.read_text(encoding="utf-8"))
    schlechter: list[str] = []
    for datei, regeln in jetzt.items():
        for code, anzahl in regeln.items():
            erlaubt = basis.get(datei, {}).get(code, 0)
            if anzahl > erlaubt:
                schlechter.append(
                    f"  {datei}: {code} {erlaubt} -> {anzahl} "
                    f"(+{anzahl - erlaubt}) [{REGELN[code]}]"
                )

    if schlechter:
        print("Komplexitaet gestiegen — bitte entwirren statt einfrieren:\n")
        print("\n".join(sorted(schlechter)))
        print(
            "\nWar der Zuwachs unvermeidbar und begruendet, traegt die Stelle "
            "ein `# noqa: <code> — <Grund>` und die Baseline wird mit --neu "
            "erneuert. Ein noqa OHNE Begruendung ist keine Loesung."
        )
        return 1

    # Verbesserungen sofort festschreiben, sonst kann die Zahl wieder steigen.
    besser = sum(
        max(0, sum(basis.get(d, {}).values()) - sum(r.values()))
        for d, r in {**{k: {} for k in basis}, **jetzt}.items()
    )
    if json.dumps(jetzt, sort_keys=True) != json.dumps(basis, sort_keys=True):
        schreiben(jetzt)
        if besser:
            print(f"Besser geworden ({besser} weniger) — Baseline nachgezogen.")
        else:
            print("Baseline nachgezogen (Dateien verschoben/umbenannt).")
    print(f"OK — {gesamt} Verstoesse, keiner neu.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
