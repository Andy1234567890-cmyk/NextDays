#!/usr/bin/env bash
# Qualitätsgate für die Übersetzungen einer App.
#
# Läuft alle Prüfungen, die vor dem Ausliefern grün sein müssen, und bricht
# beim ersten Fehler ab. Gedacht für den Aufruf vor Commit/Deploy und in CI.
#
# Aufruf: scripts/i18n/gate.sh web
set -euo pipefail

APP="${1:-web}"
WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$WURZEL"

echo "── Qualitätsgate i18n: $APP ──"

echo
echo "1/7  Locale-Liste und Dateien deckungsgleich?"
node scripts/i18n/pruefe-locales-vollstaendig.mjs "$APP"

echo
echo "2/7  Alle Sprachdateien vollständig und platzhaltertreu?"
node scripts/i18n/pruefe-uebersetzungen.mjs "$APP"

echo
echo "3/7  Kanal-Enums deckungsgleich mit dem Backend?"
# App-unabhängig (prüft web + mobile-nextdays gegen die Pydantic-Enums), läuft
# aber hier mit: ein neuer Kanalwert ist immer auch ein fehlendes Label.
node scripts/i18n/kanal-enums-pruefen.mjs
node scripts/i18n/rollen-pruefen.mjs

echo
echo "4/7  Platzhalter-Etiketten vollständig?"
# Gegen den BACKEND-Katalog, nicht die Sprachen untereinander: ein Feld, das
# in allen 24 Dateien fehlt, ist für Schritt 2 deckungsgleich und fällt dort
# nie auf — im Picker steht dann sein roher Schlüssel.
node scripts/i18n/pruefe-feld-labels.mjs

echo
echo "5/7  Provisionssaetze nur aus der API?"
# Der Satz und der Monatsdeckel gehoeren der Abrechnung. Steht die Zahl
# zusaetzlich im Fliesstext, driftet sie stumm — kein tsc, kein ESLint, kein
# Test sieht einen String, der „8 %" enthaelt.
node scripts/i18n/provisionssaetze-pruefen.mjs

echo
echo "6/7  TypeScript"
(cd "$APP" && npx tsc --noEmit)
echo "✓ tsc sauber"

echo
echo "7/7  ESLint"
# KEIN `next build` hier. Der Build läuft AUSSCHLIESSLICH bei Coolify beim
# Deploy — lokal hat er dreimal Schaden angerichtet: ohne --distDir löscht er
# das .next des laufenden Dev-Servers (jede Seite 500), mit --distDir landeten
# 1,6 GB im Quellbaum und `lint` meldete 57 813 Fremdfehler. Wer dieses Gate
# aufruft, will Übersetzungen prüfen und rechnet nicht mit 400 MB Build-Ausgabe.
# ESLint findet stattdessen, was tsc nicht sieht (toter Code, Hook-Deps,
# verschluckte Fehler); Next.js-Direktiven-Fehler fängt der Deploy-Build.
(cd "$APP" && npx eslint . --max-warnings=-1)
echo "✓ ESLint sauber"

echo
echo "── Gate bestanden ──"
echo "Hinweis: der Produktionsbuild ist bewusst NICHT Teil dieses Gates."
