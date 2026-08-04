#!/usr/bin/env bash
# Hält scripts/ci/coolify-apps.txt und die images-Matrix in ci.yml deckungsgleich.
#
# Warum: images baut nur, was in coolify-apps.txt auf geänderte Pfade matcht,
# und deploy deployt genau dieselben Namen. Fehlt eine App in der Liste, wird
# sie nie gebaut UND nie deployt — ihre Änderungen gehen still nicht live.
# Fehlt sie in der Matrix, deployt der Job ein Image, das die CI nie gebaut hat.
# Beides ist ein Fehler, nicht eine Warnung (fail-closed, Wurzel 5).
set -euo pipefail

wurzel="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
liste="$wurzel/scripts/ci/coolify-apps.txt"
ci="$wurzel/.github/workflows/ci.yml"

aus_liste=$(grep -v '^\s*#' "$liste" | grep -v '^\s*$' | cut -d'|' -f2 | sort)
aus_matrix=$(grep -oE '^\s+- app: nextdays-[a-z-]+' "$ci" | awk '{print $3}' | sort -u)

if [ "$aus_liste" != "$aus_matrix" ]; then
  echo "::error::coolify-apps.txt und die images-Matrix in ci.yml weichen ab:"
  diff <(echo "$aus_liste") <(echo "$aus_matrix") \
    --label "coolify-apps.txt" --label "ci.yml images-Matrix" -u || true
  exit 1
fi

# Jede App braucht mindestens ein Pfad-Präfix, sonst wird sie nie betroffen und
# gilt für immer als "unverändert".
fehler=0
while IFS='|' read -r uuid name pfade; do
  case "${uuid# }" in ''|\#*) continue ;; esac
  [ -n "${pfade// }" ] || { echo "::error::$name hat kein Pfad-Präfix"; fehler=1; }
  [ -n "${uuid// }" ] || { echo "::error::$name hat keine UUID"; fehler=1; }
done < "$liste"
[ "$fehler" = 0 ] || exit 1

echo "coolify-apps.txt deckungsgleich mit der images-Matrix ($(echo "$aus_liste" | wc -l | tr -d ' ') Apps)."
