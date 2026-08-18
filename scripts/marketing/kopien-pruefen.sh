#!/usr/bin/env bash
# Prüft die bewussten KOPIEN der Marketing-App gegen ihre Quelle.
#
# Warum es diese Kopien gibt: marketing baut isoliert (Coolify
# base_directory /marketing, eigenes bun.lock, Dockerfile ohne Root-Kontext).
# Ein `workspace:*`-Eintrag lässt dort `bun install --frozen-lockfile`
# scheitern — die App kann geteilte Pakete also nicht importieren. Statt eine
# zweite, frei driftende Fassung zu pflegen, liegt der Code als Kopie mit
# SCHWESTERDATEI-Kopf vor und dieser Job hält ihn gleich (dasselbe Muster wie
# `mobile-konsistenz` für die zwei Apps, ADR-0019 Stufe 1).
#
# Was Drift anrichten würde: `tarif.ts` rechnet die Objekt-Staffel. Läuft die
# Kopie auseinander, zeigt die öffentliche Preisseite einen ANDEREN Preis als
# der Tarifrechner im Konto — beide Zahlen sehen plausibel aus, niemand erkennt
# es als Bug (Wurzel 4). `currency.ts` entscheidet, ob ein Betrag mit dem
# richtigen Währungssymbol erscheint.
#
# Aufruf: bash scripts/marketing/kopien-pruefen.sh
set -euo pipefail

# Zeilenzahl des SCHWESTERDATEI-Kopfs in den Kopien (endet mit der ---Zeile).
# Wird aus der Datei selbst bestimmt, damit ein Kopf-Umbau hier nichts bricht.
paare=(
  "packages/tarif/src/index.ts:marketing/lib/tarif.ts"
  "packages/currency/src/index.ts:marketing/lib/currency.ts"
)

fehler=0
for paar in "${paare[@]}"; do
  quelle="${paar%%:*}"
  kopie="${paar##*:}"

  if [[ ! -f "$quelle" || ! -f "$kopie" ]]; then
    echo "FEHLT: $quelle oder $kopie" >&2
    fehler=1
    continue
  fi

  kopfzeilen=$(grep -n -m1 '^// -\{10,\}$' "$kopie" | cut -d: -f1 || true)
  if [[ -z "$kopfzeilen" ]]; then
    echo "KEIN SCHWESTERDATEI-Kopf in $kopie (Trennzeile '// ---' fehlt)" >&2
    fehler=1
    continue
  fi

  if ! diff -u "$quelle" <(tail -n "+$((kopfzeilen + 1))" "$kopie"); then
    echo "DRIFT: $kopie weicht von $quelle ab (Änderung in die Quelle, dann kopieren)" >&2
    fehler=1
  else
    echo "✓ $kopie == $quelle"
  fi
done

exit "$fehler"
