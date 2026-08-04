#!/usr/bin/env bash
# Ermittelt, welche Coolify-Apps ein Push/PR berührt.
#
# Aufruf:  betroffene-apps.sh <basis-commit> <head-commit>
# Ausgabe: nach $GITHUB_OUTPUT (bzw. stdout, wenn nicht gesetzt):
#   apps=nextdays-api nextdays-worker      # betroffene App-Namen, space-getrennt
#
# Ohne verwertbaren Basis-Commit (Erst-Push, Force-Push, beschnittene Historie)
# gilt bewusst ALLES als betroffen: lieber einmal 12 Images bauen als eine
# Änderung ungeprüft deployen (fail-closed, Wurzel 5).
set -euo pipefail

basis="${1:-}"
head="${2:-HEAD}"
hier="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
apps_datei="$hier/coolify-apps.txt"

[ -f "$apps_datei" ] || { echo "::error::$apps_datei fehlt"; exit 1; }

if [ -z "$basis" ] || [ "$basis" = "0000000000000000000000000000000000000000" ] \
   || ! git cat-file -e "${basis}^{commit}" 2>/dev/null; then
  echo "Kein gültiger Basis-Commit ('$basis') → alle Apps als betroffen behandeln."
  geaendert="$(git ls-files)"
else
  geaendert="$(git diff --name-only "$basis" "$head")"
fi

echo "Geänderte Dateien:"
echo "$geaendert" | sed 's/^/  /'

betroffen=()
while IFS='|' read -r _uuid name pfade; do
  # Kommentare und Leerzeilen der App-Liste überspringen.
  case "${_uuid# }" in ''|\#*) continue ;; esac
  [ -n "${name:-}" ] || continue
  for p in $pfade; do
    if printf '%s\n' "$geaendert" | grep -q "^$p"; then
      betroffen+=("$name")
      break
    fi
  done
done < "$apps_datei"

liste="${betroffen[*]:-}"
echo "Betroffene Apps: ${liste:-（keine）}"

ziel="${GITHUB_OUTPUT:-/dev/stdout}"
echo "apps=$liste" >> "$ziel"
