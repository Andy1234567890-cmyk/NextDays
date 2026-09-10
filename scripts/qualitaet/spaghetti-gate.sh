#!/usr/bin/env bash
# spaghetti-gate.sh — prueft, dass keine NEUE Komplexitaet dazugekommen ist.
#
# Zwei Ratchets, ein Aufruf:
#   1. Backend  — scripts/qualitaet/komplexitaet-ratchet.py (ruff, Baseline
#      je Datei+Regel in komplexitaet-basis.json)
#   2. Frontend — ESLints native Bulk Suppressions je App
#      (eslint-suppressions.json, ab ESLint 9.24; hier laeuft 10.8)
#
# Der Altbestand ist eingefroren und bricht NICHT. Nur was neu dazukommt,
# faellt auf. Wird eine Stelle entwirrt, zieht das Backend-Ratchet die
# Baseline automatisch nach; im Frontend raeumt `--prune-suppressions` auf.
#
# AUFRUF
#   bash scripts/qualitaet/spaghetti-gate.sh          # pruefen (CI + lokal)
#   bash scripts/qualitaet/spaghetti-gate.sh --neu    # Baselines neu setzen
#
# Nach einer Entwirrung: `--neu` laufen lassen, damit die Verbesserung
# festgeschrieben wird und nicht wieder verspielt werden kann.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

# `packages` und `storybook` gehoeren dazu: sie haben eine eigene
# eslint.config.mjs und fielen im CI mit 16 bzw. 3 Verstoessen, waehrend das
# Gate hier gruen meldete. Ein Gate, das weniger prueft als die CI, ist eine
# Zusage, die nicht gilt (10.09.2026).
APPS=(web plattform gastgeber marketing builder admin partner packages storybook)
MODUS="${1:-pruefen}"
FEHLER=0

if [ "$MODUS" = "--neu" ]; then
  echo "→ Backend-Baseline neu"
  python3 scripts/qualitaet/komplexitaet-ratchet.py --neu
  for app in "${APPS[@]}"; do
    [ -f "$app/eslint.config.mjs" ] || continue
    echo "→ $app: Baseline neu"
    (cd "$app" && npx eslint . \
        --suppress-rule complexity --suppress-rule max-lines-per-function \
        --suppress-rule max-depth --suppress-rule max-params \
        --suppress-rule max-nested-callbacks >/dev/null 2>&1)
  done
  echo "Baselines gesetzt."
  exit 0
fi

echo "→ Backend (ruff-Ratchet)"
python3 scripts/qualitaet/komplexitaet-ratchet.py || FEHLER=1

for app in "${APPS[@]}"; do
  [ -f "$app/eslint.config.mjs" ] || continue
  # --pass-on-unpruned-suppressions: eine entwirrte Stelle laesst ihren
  # Baseline-Eintrag ungenutzt zurueck. Das ist eine VERBESSERUNG und darf
  # den Lauf nicht brechen — aufgeraeumt wird mit --neu.
  # Exit-Code statt Textsuche: `grep "[0-9]+ error"` trifft auch auf
  # „0 errors, 292 warnings" und meldet dann jede saubere App als Fehler.
  ausgabe="$(cd "$app" && npx eslint . --pass-on-unpruned-suppressions 2>&1)"
  if [ $? -ne 0 ]; then
    echo "✗ $app"
    printf '%s\n' "$ausgabe" | grep -E "error" | head -20
    FEHLER=1
  else
    echo "✓ $app"
  fi
done

if [ "$FEHLER" -ne 0 ]; then
  echo
  echo "Neue Komplexitaet abgelehnt. Entwirren statt einfrieren —"
  echo "die Baseline mit --neu zu ueberschreiben macht den Befund nur unsichtbar."
  exit 1
fi
echo "OK — keine neue Komplexitaet."
