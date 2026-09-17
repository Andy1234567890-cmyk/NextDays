#!/usr/bin/env bash
# Haelt die AUSLIEFERUNGS-Kette der Mobile-Apps vollstaendig.
#
# Warum eigens: `ci.yml` prueft die drei Apps (Tests, Schwesterdateien,
# Bereiche) — die VERTEILUNG prueft niemand. Eine neue App faellt dabei nicht
# auf, sie ist einfach nie ausgeliefert worden. Genau das war am 03.09.2026 der
# Stand: `mobile-owner` lief seit einem Tag durch alle Pruefungen und hatte
# weder Release-Workflow noch Keystore-Unterstuetzung noch eine Tester-Gruppe.
#
# Was hier NICHT geprueft werden kann: ob die GitHub-Secrets gesetzt sind und
# ob die Firebase-Apps existieren. Beides liegt ausserhalb des Repos. Die
# Workflows pruefen es zur Laufzeit selbst und brechen mit ::error ab — hier
# geht es um das, was im Repo stehen MUSS, damit dieser Lauf ueberhaupt
# stattfinden kann.
set -euo pipefail

wurzel="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$wurzel"

# app|workflow|tester-gruppe|secret-praefix
APPS=(
  "mobile-nextdays|.github/workflows/mobile-release.yml|beta-tester|MYNEXTDAYS"
  "mobile-owner|.github/workflows/mobile-release-owner.yml|beta-tester-owner|MYNEXTDAYSOWNER"
)

fehler=0
meld() { echo "::error::$*" >&2; fehler=1; }

# 1. Jede App im Repo braucht einen Eintrag hier. Sonst waechst eine vierte App
#    heran, und dieser Waechter schweigt ueber sie — der Fehler, den er
#    verhindern soll.
for verz in mobile-*/; do
  app="${verz%/}"
  [ -f "$app/package.json" ] || continue
  gefunden=0
  for zeile in "${APPS[@]}"; do
    [ "${zeile%%|*}" = "$app" ] && gefunden=1
  done
  [ "$gefunden" = 1 ] || meld "$app hat keinen Eintrag in release-kette-pruefen.sh — Auslieferung ungeprueft."
done

for zeile in "${APPS[@]}"; do
  IFS='|' read -r app workflow gruppe praefix <<< "$zeile"

  [ -d "$app" ] || { meld "$app aus der Liste existiert nicht mehr — Eintrag entfernen."; continue; }

  # 2. Release-Workflow vorhanden
  if [ ! -f "$workflow" ]; then
    meld "$app hat keinen Release-Workflow ($workflow) — die App ist nicht auslieferbar."
    continue
  fi

  # 3. Die EIGENE Tester-Gruppe, nicht die einer Schwester-App. Ein Eigentuemer
  #    in `beta-tester` bekaeme die Verwaltungs-App.
  #    Wortgrenze am ENDE ist Pflicht: `beta-tester` ist ein Praefix von
  #    `beta-tester-bestdays`, ein einfaches grep matcht also immer und
  #    meldete beide Schwester-Workflows falsch an (erster Lauf 03.09.2026).
  if ! grep -qE -- "--groups ${gruppe}([[:space:]]|\\\\|$)" "$workflow"; then
    meld "$workflow verteilt nicht an '$gruppe' (eigene Gruppe je App)."
  fi
  for andere in "${APPS[@]}"; do
    IFS='|' read -r a_app _ a_gruppe _ <<< "$andere"
    [ "$a_app" = "$app" ] && continue
    if grep -qE -- "--groups ${a_gruppe}([[:space:]]|\\\\|$)" "$workflow"; then
      meld "$workflow verteilt an '$a_gruppe' — das ist die Gruppe von $a_app."
    fi
  done

  # 4. Der Secret-Praefix im Workflow muss zu dem passen, den build.gradle
  #    liest. Weichen sie ab, baut der Lauf ein UNSIGNIERTES Release-APK:
  #    build.gradle ist fail-closed und signiert bei fehlenden Werten nicht.
  gradle="$app/android/app/build.gradle"
  if [ -f "$gradle" ]; then
    if ! grep -q "${praefix}_RELEASE_STORE_FILE" "$gradle"; then
      meld "$gradle liest nicht ${praefix}_RELEASE_* — Praefix weicht vom Workflow ab."
    fi
    if ! grep -q "${praefix}_RELEASE_KEYSTORE_BASE64" "$workflow"; then
      meld "$workflow nutzt nicht ${praefix}_RELEASE_KEYSTORE_BASE64."
    fi
  fi

  # 5. Das Keystore-Skript muss die App kennen — sonst gibt es keinen Weg, den
  #    Schluessel ueberhaupt zu erzeugen.
  if ! grep -q "$app" scripts/mobile/keystore-erzeugen.sh; then
    meld "scripts/mobile/keystore-erzeugen.sh kennt $app nicht."
  fi

  # 6. Wer Firebase im Build braucht, braucht google-services.json im Workflow.
  #    Umgekehrt nicht: mobile-bestdays hat kein Firebase-SDK und braucht die
  #    Datei nur zur Verteilung nicht.
  if grep -q '"@react-native-firebase/app"' "$app/package.json"; then
    if ! grep -q "google-services.json" "$workflow"; then
      meld "$app nutzt Firebase, aber $workflow legt keine google-services.json an — Push waere im Build tot."
    fi
  fi

  # 7. Signatur-Beweis: ein gebautes Artefakt ist kein signiertes Artefakt.
  grep -q "apksigner" "$workflow" \
    || meld "$workflow beweist die Signatur nicht (apksigner fehlt)."
done

[ "$fehler" = 0 ] || exit 1
echo "Release-Kette vollstaendig fuer ${#APPS[@]} Apps (Workflow, eigene Tester-Gruppe, Keystore, Signatur-Beweis)."
