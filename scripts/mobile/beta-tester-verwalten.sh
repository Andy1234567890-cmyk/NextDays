#!/usr/bin/env bash
# ============================================================================
# beta-tester-verwalten.sh — Tester der Android-Beta pflegen
# ----------------------------------------------------------------------------
# Die Verteilung laeuft ueber Firebase App Distribution an die Gruppe
# `beta-tester` (siehe .github/workflows/mobile-release.yml). Der Build ist
# auch mit LEERER Gruppe gruen — er verteilt dann an niemanden. Genau das ist
# die Falle: „Lauf gruen" heisst nicht „Team hat die App".
#
# Aufruf:
#   bash scripts/mobile/beta-tester-verwalten.sh liste
#   bash scripts/mobile/beta-tester-verwalten.sh hinzu anna@firma.de bo@firma.de
#   bash scripts/mobile/beta-tester-verwalten.sh entfernen anna@firma.de
#
# Voraussetzung: firebase-tools angemeldet (`firebase login`) mit einem Konto,
# das im Projekt Rechte hat.
# ============================================================================
set -euo pipefail

PROJEKT="${FIREBASE_PROJEKT-project-460d8aaf-4b7d-4d13-b3a}"
GRUPPE="${BETA_GRUPPE-beta-tester}"

if ! command -v firebase >/dev/null 2>&1; then
  echo "firebase-tools fehlt. Einmalig: npm i -g firebase-tools && firebase login" >&2
  exit 1
fi

befehl="${1-liste}"
shift || true

case "$befehl" in
  liste)
    firebase appdistribution:group:list --project "$PROJEKT"
    echo
    echo "Tester der Gruppe $GRUPPE:"
    # Es gibt keinen `tester:list --group`; die Gruppenliste oben zeigt die
    # Anzahl. Steht dort 0, bekommt niemand eine Einladung.
    firebase appdistribution:testers:list --project "$PROJEKT" 2>/dev/null \
      || echo "  (Einzelauflistung nicht verfuegbar — Anzahl siehe Tabelle)"
    ;;
  hinzu)
    [ "$#" -gt 0 ] || { echo "Mindestens eine Mailadresse angeben." >&2; exit 1; }
    # Erst als Tester im Projekt anlegen, dann der Gruppe zuordnen. Der zweite
    # Schritt allein genuegt nicht fuer unbekannte Adressen.
    firebase appdistribution:testers:add "$@" --project "$PROJEKT"
    firebase appdistribution:group:add "$GRUPPE" "$@" --project "$PROJEKT"
    echo "✓ $# Adresse(n) in $GRUPPE. Die Einladung geht beim NAECHSTEN Build raus;"
    echo "  fuer den letzten Build: Firebase Console → App Distribution → Release → Testers."
    ;;
  entfernen)
    [ "$#" -gt 0 ] || { echo "Mindestens eine Mailadresse angeben." >&2; exit 1; }
    firebase appdistribution:group:remove "$GRUPPE" "$@" --project "$PROJEKT"
    echo "✓ aus $GRUPPE entfernt (bleibt als Tester im Projekt)."
    ;;
  *)
    echo "Unbekannt: $befehl — erlaubt sind liste | hinzu | entfernen" >&2
    exit 1
    ;;
esac
