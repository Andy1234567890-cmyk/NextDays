#!/usr/bin/env bash
# ============================================================================
# beta-tester-verwalten.sh — Tester der Android-Beta pflegen
# ----------------------------------------------------------------------------
# Die Verteilung laeuft ueber Firebase App Distribution an eine Gruppe PRO APP.
# Der Build ist auch mit LEERER Gruppe gruen — er verteilt dann an niemanden.
# Genau das ist die Falle: „Lauf gruen" heisst nicht „Team hat die App".
#
# DREI APPS, DREI GRUPPEN (ADR-0019/0022) — die Gruppe ist das erste Argument,
# nicht mehr nur eine Umgebungsvariable. Wer sie vergisst, bekommt seit dem
# 03.09.2026 eine Rueckfrage statt stillschweigend die PMS-Gruppe: eine
# Eigentuemer-Adresse in `beta-tester` bekommt die VERWALTUNGS-App auf das
# Telefon, und das faellt niemandem auf, weil beide „myNextDays" heissen.
#
#   App              Gruppe                 Workflow
#   mobile-nextdays  beta-tester            mobile-release.yml
#   mobile-owner     beta-tester-owner      mobile-release-owner.yml
#
# Aufruf:
#   bash scripts/mobile/beta-tester-verwalten.sh <app> liste
#   bash scripts/mobile/beta-tester-verwalten.sh <app> hinzu anna@firma.de bo@firma.de
#   bash scripts/mobile/beta-tester-verwalten.sh <app> entfernen anna@firma.de
#
# <app> ist mobile-nextdays | mobile-owner.
#
# Voraussetzung: firebase-tools angemeldet (`firebase login`) mit einem Konto,
# das im Projekt Rechte hat.
# ============================================================================
set -euo pipefail

PROJEKT="${FIREBASE_PROJEKT-project-460d8aaf-4b7d-4d13-b3a}"

# Die App MUSS genannt werden. Kein Default: ein stiller Rueckfall auf die
# PMS-Gruppe war die eigentliche Gefahr an diesem Skript (fail-closed statt
# plausibler Ersatzwert, CLAUDE.md Wurzel 4/5).
app="${1-}"
case "$app" in
  mobile-nextdays) GRUPPE="beta-tester" ;;
  mobile-owner)    GRUPPE="beta-tester-owner" ;;
  *)
    echo "Erstes Argument muss die App sein: mobile-nextdays | mobile-owner" >&2
    echo "Beispiel: bash $0 mobile-owner liste" >&2
    exit 2
    ;;
esac
shift
# Ausnahme fuer Sonderfaelle (eine zusaetzliche Gruppe im selben Projekt):
# ausdruecklich setzen, nie raten.
GRUPPE="${BETA_GRUPPE-$GRUPPE}"

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
    # `testers:list` nimmt die Gruppe als ARGUMENT (nicht als Flag) und zeigt
    # dann nur deren Mitglieder — genau die, die eine Verteilung erreicht.
    firebase appdistribution:testers:list "$GRUPPE" --project "$PROJEKT"
    ;;
  hinzu)
    [ "$#" -gt 0 ] || { echo "Mindestens eine Mailadresse angeben." >&2; exit 1; }
    # EIN Aufruf: `testers:add` legt im Projekt an UND ordnet der Gruppe zu.
    # Es gibt kein `group:add` (firebase-tools 14.x) — die Zuordnung laeuft
    # ausschliesslich ueber --group-alias. Ohne das Flag landen die Adressen im
    # Projekt, aber in KEINER Gruppe, und der Verteil-Schritt erreicht sie nicht.
    firebase appdistribution:testers:add "$@" \
      --group-alias "$GRUPPE" --project "$PROJEKT"
    echo "✓ $# Adresse(n) in $GRUPPE. Die Einladung geht beim NAECHSTEN Build raus;"
    echo "  fuer den letzten Build: Firebase Console → App Distribution → Release → Testers."
    ;;
  entfernen)
    [ "$#" -gt 0 ] || { echo "Mindestens eine Mailadresse angeben." >&2; exit 1; }
    firebase appdistribution:testers:remove "$@" \
      --group-alias "$GRUPPE" --project "$PROJEKT"
    echo "✓ aus $GRUPPE entfernt (bleibt als Tester im Projekt)."
    ;;
  *)
    echo "Unbekannt: $befehl — erlaubt sind liste | hinzu | entfernen" >&2
    exit 1
    ;;
esac
