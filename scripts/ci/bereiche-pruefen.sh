#!/usr/bin/env bash
# Hält `bereiche.txt` und `ci.yml` deckungsgleich.
#
# WARUM DAS EXISTIERT — die gefährlichste Einzelstelle des Pfadfilters:
# Ein Job liest seine Bedingung als `needs.betroffen.outputs.<bereich>`. Ist der
# Name verdreht, liefert GitHub einen LEEREN String — die Bedingung ist dann
# falsch, der Job wird übersprungen, und der Lauf ist GRÜN. Eine ungeprüfte
# Änderung geht durch, ohne dass irgendwo etwas rot wird. Deshalb ist eine
# Abweichung hier ein FEHLER, kein Hinweis (fail-closed, Wurzel 5).
#
# Zusätzlich geprüft: dass jede App, die ein @nextdays/*-Paket im Quellcode
# konsumiert, `packages/` in ihrer Bereichszeile hat. `packages/ui` exportiert
# rohes .tsx, `tsc --noEmit` kompiliert es also mit — fehlt der Eintrag, bricht
# eine Paket-Änderung die App-Typprüfung, ohne dass diese läuft.
set -euo pipefail

wurzel="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
regeln="$wurzel/scripts/ci/bereiche.txt"
ci="$wurzel/.github/workflows/ci.yml"
fehler=0

[ -f "$regeln" ] || { echo "::error::$regeln fehlt"; exit 1; }
[ -f "$ci" ] || { echo "::error::$ci fehlt"; exit 1; }

bereiche="$(grep -vE '^\s*(#|$)' "$regeln" | cut -d'|' -f1 | sort -u)"

# 1) Jeder in ci.yml gelesene Output muss in bereiche.txt stehen.
gelesen="$(grep -oE 'needs\.betroffen\.outputs\.[a-z0-9-]+' "$ci" \
           | sed 's/.*outputs\.//' | grep -v '^apps$' | sort -u || true)"
for g in $gelesen; do
  if ! printf '%s\n' "$bereiche" | grep -qx "$g"; then
    echo "::error::ci.yml liest '$g', aber bereiche.txt kennt es nicht — der Job würde still übersprungen."
    fehler=1
  fi
done

# 2) Jeder Bereich muss in ci.yml als OUTPUT deklariert sein. Bewusst gegen die
#    outputs-Deklaration und nicht per freiem grep: ein Bereichsname wie `web`
#    oder `api` kommt in ci.yml in Pfaden und Kommentaren dutzendfach vor, ein
#    freies grep wäre also immer grün und würde nichts prüfen (erst gebaut,
#    sofort gemerkt: es meldete "deckungsgleich", bevor ci.yml umgebaut war).
deklariert="$(sed -n '/^    outputs:/,/^    steps:/p' "$ci" \
              | grep -oE '^      [a-z0-9-]+:' | tr -d ' :' | sort -u || true)"
for b in $bereiche; do
  if ! printf '%s\n' "$deklariert" | grep -qx "$b"; then
    echo "::error::bereiche.txt kennt '$b', aber ci.yml deklariert keinen Output dafür."
    fehler=1
  fi
done

# 3) Konsumiert eine App @nextdays/*-Quellcode, braucht ihre Zeile `packages/`.
#    eslint-config zählt nicht: sie wird nur von der Lint-Konfiguration geladen,
#    nicht mitkompiliert (deshalb stehen marketing/storybook bewusst ohne
#    `packages/` in der Liste).
for pkgjson in "$wurzel"/*/package.json; do
  app="$(basename "$(dirname "$pkgjson")")"
  printf '%s\n' "$bereiche" | grep -qx "$app" || continue
  if grep -oE '"@nextdays/[a-z-]+"' "$pkgjson" | grep -qv 'eslint-config'; then
    zeile="$(grep -E "^$app\|" "$regeln" || true)"
    if ! printf '%s' "$zeile" | grep -q 'packages/'; then
      echo "::error::$app konsumiert @nextdays/*-Quellcode, aber '$app' hat kein 'packages/' in bereiche.txt."
      fehler=1
    fi
  fi
done

if [ "$fehler" -ne 0 ]; then
  echo "::error::bereiche.txt und ci.yml sind nicht deckungsgleich."
  exit 1
fi
echo "bereiche.txt ↔ ci.yml deckungsgleich ($(printf '%s\n' "$bereiche" | wc -l | tr -d ' ') Bereiche)."
