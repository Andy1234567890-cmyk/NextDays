#!/usr/bin/env bash
# Qualitätsgate für die Übersetzungen einer App.
#
# Läuft alle Prüfungen, die vor dem Ausliefern grün sein müssen, und bricht
# beim ersten Fehler ab. Gedacht für den Aufruf vor Commit/Deploy und in CI.
#
# Aufruf: scripts/i18n/gate.sh gastgeber
set -euo pipefail

APP="${1:-gastgeber}"
WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$WURZEL"

echo "── Qualitätsgate i18n: $APP ──"

echo
echo "1/6  Locale-Liste und Dateien deckungsgleich?"
node scripts/i18n/pruefe-locales-vollstaendig.mjs "$APP"

echo
echo "2/6  Alle Sprachdateien vollständig und platzhaltertreu?"
node scripts/i18n/pruefe-uebersetzungen.mjs "$APP"

echo
echo "3/6  Kanal-Enums deckungsgleich mit dem Backend?"
# App-unabhängig (prüft web + mobile-nextdays gegen die Pydantic-Enums), läuft
# aber hier mit: ein neuer Kanalwert ist immer auch ein fehlendes Label.
node scripts/i18n/kanal-enums-pruefen.mjs

echo
echo "4/6  Platzhalter-Etiketten vollständig?"
# Gegen den BACKEND-Katalog, nicht die Sprachen untereinander: ein Feld, das
# in allen 24 Dateien fehlt, ist für Schritt 2 deckungsgleich und fällt dort
# nie auf — im Picker steht dann sein roher Schlüssel.
node scripts/i18n/pruefe-feld-labels.mjs

echo
echo "5/6  TypeScript"
(cd "$APP" && npx tsc --noEmit)
echo "✓ tsc sauber"

echo
echo "6/6  Produktionsbuild"
(cd "$APP" && npx next build --no-lint >/tmp/i18n-gate-build.log 2>&1) || {
  echo "✗ Build fehlgeschlagen — Log: /tmp/i18n-gate-build.log"
  tail -20 /tmp/i18n-gate-build.log
  exit 1
}
echo "✓ Build erfolgreich"

echo
echo "── Gate bestanden ──"
