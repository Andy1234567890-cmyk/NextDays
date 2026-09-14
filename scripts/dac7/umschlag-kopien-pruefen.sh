#!/usr/bin/env bash
# Hält die drei Kopien von `umschlag.py` byte-identisch.
#
# WARUM ES DREI KOPIEN GIBT: Die drei DAC7-Dienste teilen bewusst keinen
# Import (`apps/api`, `apps/dac7-API`, `apps/dac7-staging` — je eigenes
# Projekt, eigenes Image, eigener Server). Der Umschlag muss aber in allen
# dreien derselbe sein.
#
# WARUM DAS HIER RICHTIG IST UND BEI DEN PRÜFREGELN NICHT: Die Prüfregeln
# sind eine FACHLICHE Lesung der amtlichen Vorlage, und die muss auf beiden
# Seiten unabhängig entstehen — sonst prüft unsere Datei gegen unsere eigene
# Vorstellung von ihr (genau der Kurzschluss, der bei der
# Channex-Facility-Map schon einmal passiert ist: Der Unit-Test verglich die
# Map mit sich selbst und war grün, während bei allen Portalen die
# Ausstattung fehlte).
#
# Ein Verschlüsselungsformat ist das Gegenteil: Es MUSS auf beiden Seiten
# identisch sein, sonst geht kein Umschlag auf. Zwei unabhängige Lesungen
# desselben Formats wären hier kein Kreuztest, sondern ein Fehler.
#
# WAS DRIFT ANRICHTEN WÜRDE: Ein geänderter Nonce, ein anderes Padding oder
# ein anderer Kopf-Aufbau in nur einer Kopie — und die Empfangsstelle kann
# öffnen, was der Versand nicht mehr verschließt. Der Fehler erscheint als
# „für einen anderen Empfänger verschlüsselt" und sieht aus wie ein
# Schlüsselproblem, ist aber keins.
#
# Aufruf: bash scripts/dac7/umschlag-kopien-pruefen.sh
set -euo pipefail

quelle="apps/api/src/features/taxpayer/dac7/umschlag.py"
kopien=(
  "apps/dac7-staging/src/core/umschlag.py"
  "apps/dac7-API/src/core/umschlag.py"
)

if [ ! -f "$quelle" ]; then
  echo "FEHLT: $quelle" >&2
  exit 1
fi

soll="$(shasum -a 256 "$quelle" | cut -d' ' -f1)"
fehler=0

for kopie in "${kopien[@]}"; do
  if [ ! -f "$kopie" ]; then
    echo "FEHLT: $kopie" >&2
    fehler=1
    continue
  fi
  ist="$(shasum -a 256 "$kopie" | cut -d' ' -f1)"
  if [ "$ist" != "$soll" ]; then
    echo "ABWEICHUNG: $kopie" >&2
    echo "  Unterschied zur Quelle ($quelle):" >&2
    diff -u "$quelle" "$kopie" | head -40 >&2 || true
    fehler=1
  else
    echo "  gleich: $kopie"
  fi
done

if [ "$fehler" -ne 0 ]; then
  cat >&2 <<'HINWEIS'

Die Kopien laufen auseinander. Richtig ist: die Quelle ändern und dann
kopieren, nie umgekehrt —

  cp apps/api/src/features/taxpayer/dac7/umschlag.py \
     apps/dac7-staging/src/core/umschlag.py
  cp apps/api/src/features/taxpayer/dac7/umschlag.py \
     apps/dac7-API/src/core/umschlag.py

Ein Formatwechsel gehört zusätzlich in `FORMAT` (die Kennung im
Umschlagkopf), damit eine alte Gegenstelle den neuen Umschlag ABWEIST
statt ihn falsch zu lesen.
HINWEIS
  exit 1
fi

echo "OK — umschlag.py ist in allen drei Diensten identisch."
