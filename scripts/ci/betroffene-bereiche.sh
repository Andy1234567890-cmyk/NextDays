#!/usr/bin/env bash
# Ermittelt, welche PRÜF-Bereiche der CI ein Push/PR berührt.
#
# Aufruf:  betroffene-bereiche.sh <basis-commit> <head-commit>
# Ausgabe: nach $GITHUB_OUTPUT (bzw. stdout, wenn nicht gesetzt), je Bereich
#          eine Zeile:  api=true
#                       mobile-android=false
#
# Schwester von `betroffene-apps.sh`: dieselbe Basis, dieselbe Diff-Quelle,
# dieselbe fail-closed-Regel. Die Basis wird ABSICHTLICH als Argument
# hereingegeben und nicht hier neu berechnet — liefen beide Skripte gegen
# verschiedene Basen, würde der Image-Build eine andere Menge annehmen als die
# Prüfjobs, und genau diese Divergenz soll die geteilte Liste verhindern.
#
# FAIL-CLOSED (Wurzel 5): Bei jeder Unklarheit gilt ALLES als betroffen. Ein
# Filter, der im Zweifel überspringt, ist kein Filter, sondern ein Loch — er
# lässt eine ungeprüfte Änderung durch, und der Lauf ist grün.
set -euo pipefail

basis="${1:-}"
head="${2:-HEAD}"
hier="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
regeln="$hier/bereiche.txt"

[ -f "$regeln" ] || { echo "::error::$regeln fehlt"; exit 1; }

# Pfade, die JEDEN Bereich auslösen. Wer die Pipeline selbst, die
# Workspace-Wurzel oder die CI-Skripte ändert, kann jeden Job beeinflussen —
# hier zu filtern wäre die Wette, dass man alle Wirkungen überblickt.
# Ausnahme: ein Bereich mit `!` vor dem Namen in bereiche.txt folgt diesem
# Schwenk NICHT (siehe Schleife unten).
INFRA='^(\.github/workflows/|package\.json$|bun\.lock$|bunfig\.toml$|scripts/ci/)'

alles="nein"
if [ -z "$basis" ] || [ "$basis" = "0000000000000000000000000000000000000000" ] \
   || ! git cat-file -e "${basis}^{commit}" 2>/dev/null; then
  echo "Kein gültiger Basis-Commit ('$basis') → alle Bereiche als betroffen behandeln."
  alles="ja"
  geaendert="$(git ls-files)"
else
  geaendert="$(git diff --name-only "$basis" "$head")"
fi

if [ "$alles" = "nein" ] && printf '%s\n' "$geaendert" | grep -qE "$INFRA"; then
  echo "Infrastruktur berührt (Workflow/Workspace/CI-Skripte) → alle Bereiche."
  alles="ja"
fi

echo "Geänderte Dateien:"
printf '%s\n' "$geaendert" | sed 's/^/  /'

ziel="${GITHUB_OUTPUT:-/dev/stdout}"
aktiv=()

while IFS='|' read -r bereich pfade; do
  case "${bereich# }" in ''|\#*) continue ;; esac
  [ -n "${pfade:-}" ] || { echo "::error::Bereich '$bereich' ohne Pfade"; exit 1; }

  # Ein `!` vor dem Namen nimmt den Bereich vom Infra-Schwenk aus: er folgt
  # dann NUR seinen eigenen Pfaden. Gedacht fuer Jobs, deren Ausgang von der
  # Pipeline nachweislich unabhaengig ist und die zu teuer sind, um sie
  # vorsichtshalber mitlaufen zu lassen (mobile-android: JDK + Android-SDK +
  # Gradle, ~10 Minuten, haengt an Keystore und Firebase-App).
  eigenwillig="nein"
  case "$bereich" in
    '!'*) eigenwillig="ja"; bereich="${bereich#!}" ;;
  esac

  treffer="false"
  if [ "$alles" = "ja" ] && [ "$eigenwillig" = "nein" ]; then
    treffer="true"
  else
    for p in $pfade; do
      if printf '%s\n' "$geaendert" | grep -q "^$p"; then
        treffer="true"
        break
      fi
    done
  fi

  echo "$bereich=$treffer" >> "$ziel"
  [ "$treffer" = "true" ] && aktiv+=("$bereich")
done < "$regeln"

echo "Betroffene Bereiche: ${aktiv[*]:-（keine）}"
