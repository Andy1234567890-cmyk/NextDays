#!/usr/bin/env bash
# play-screenshots-aufbereiten.sh — iOS-Simulator-Aufnahmen für Google Play.
#
# WARUM ÜBERHAUPT AUFBEREITEN: Google hat eine HARTE Grenze — „The maximum
# dimension of your screenshot can't be more than twice as long as the minimum
# dimension." Ein iPhone-Simulator liefert 1206 x 2622 (Verhältnis 2,174) und
# fällt damit durch. Nicht „sieht schlecht aus", sondern: wird abgelehnt.
#
# WARUM PADDEN UND NICHT SCHNEIDEN: Zuschneiden auf 9:16 nähme unten rund 430
# Pixel weg — genau dort sitzt die Tab-Leiste. Ein Screenshot ohne Navigation
# zeigt die App nicht, wie sie ist. Gepaddet bleibt der ganze Bildschirm
# sichtbar, und die Ränder tragen die Flächenfarbe der App.
#
# WARUM iOS-SIMULATOR UND NICHT ANDROID-EMULATOR: Der Simulator teilt den Kernel
# mit macOS; der Android-Emulator virtualisiert eine ganze ARM-Maschine und
# belegt auf diesem 8-GB-Rechner über 3 GB (CLAUDE.md). Für Play ist das
# Betriebssystem der Aufnahme egal — verlangt sind Bilder DER APP, nicht
# Android-Aufnahmen.
#
# WERKZEUG: ImageMagick (`magick`) — schon Voraussetzung von
# `scripts/diagnose/app-icons-pruefen.py`, also nichts Neues. Der naheliegende
# Weg über `sips` (bringt macOS mit) scheitert am letzten Schritt: `sips -p`
# setzt beim Padden einen ALPHAKANAL, und Play verlangt PNG OHNE Alpha —
# `sips --setProperty hasAlpha no` gibt es nicht („Cannot do --setProperty
# hasAlpha on file", nachgemessen am 09.09.2026). Ein Bild mit Alphakanal wäre
# genau die stille Ablehnung, die dieses Skript verhindern soll.
#
# AUFNEHMEN (macht der Nutzer, Simulator und Metro laufen bei ihm):
#   xcrun simctl list devices available          # laufendes Gerät finden
#   xcrun simctl io booted screenshot roh/01-start.png
# `screencapture` geht hier NICHT (keine Aufnahmeberechtigung, CLAUDE.md);
# `simctl io` schreibt die Datei direkt aus dem Simulator und braucht keine.
#
# AUFRUF:
#   bash scripts/mobile/play-screenshots-aufbereiten.sh <roh-ordner> <ziel-ordner>
set -euo pipefail

QUELLE="${1:?Aufruf: play-screenshots-aufbereiten.sh <roh-ordner> <ziel-ordner>}"
ZIEL="${2:?Aufruf: play-screenshots-aufbereiten.sh <roh-ordner> <ziel-ordner>}"

# Flächenfarbe der App (theme/tokens.ts, lightPalette.bg). KEIN Grau und kein
# Schwarz: der Rand soll als Fortsetzung der Fläche lesen, nicht als Rahmen.
PADFARBE="FFFFFF"

mkdir -p "$ZIEL"
gefunden=0

for datei in "$QUELLE"/*.png; do
  [ -e "$datei" ] || continue
  gefunden=$((gefunden + 1))
  name="$(basename "$datei")"

  breite="$(magick identify -format '%w' "$datei")"
  hoehe="$( magick identify -format '%h' "$datei")"

  # 9:16 aus der HÖHE gerechnet, nie aus der Breite: so wird nur ergänzt und
  # nie skaliert — die Aufnahme behält ihre echten Pixel, und die Schrift
  # bleibt so scharf, wie der Simulator sie gezeichnet hat.
  zielbreite=$(( (hoehe * 9 + 8) / 16 ))
  if [ "$zielbreite" -lt "$breite" ]; then
    echo "::warn:: $name ist breiter als 9:16 ($breite x $hoehe) — bitte prüfen." >&2
    zielbreite="$breite"
  fi

  # Googles harte Grenzen, hier NACHGERECHNET statt vorausgesetzt: Mindestkante
  # 320, Höchstkante 3840, längere Seite höchstens doppelt so lang wie die
  # kürzere. Ein Bild, das durchfällt, soll HIER auffallen und nicht im
  # Store-Formular.
  if [ "$hoehe" -gt 3840 ] || [ "$zielbreite" -lt 320 ]; then
    echo "::error:: $name: $zielbreite x $hoehe verletzt Googles Grenzen." >&2
    exit 1
  fi

  # `-extent` mit zentrierter Schwerkraft ergänzt links und rechts, ohne zu
  # skalieren. `-alpha off` und `PNG24:` erzwingen das alphafreie PNG, das Play
  # verlangt — beides, weil `-alpha off` allein den Kanal nur ignoriert und
  # ImageMagick ihn je nach Quelle trotzdem schreibt.
  magick "$datei" -background "#$PADFARBE" -gravity center \
         -extent "${zielbreite}x${hoehe}" -alpha off "PNG24:$ZIEL/$name"

  if [ "$(magick identify -format '%A' "$ZIEL/$name")" != "Undefined" ]; then
    echo "::error:: $name traegt noch einen Alphakanal." >&2
    exit 1
  fi

  echo "$name  $breite x $hoehe  ->  $zielbreite x $hoehe"
done

if [ "$gefunden" -eq 0 ]; then
  echo "::error:: Keine PNG in $QUELLE." >&2
  exit 1
fi

# Googles Empfehlungsformate verlangen MINDESTENS vier Bilder mit einer
# Mindestkante von 1080. Weniger ist nicht verboten, kostet aber die Aufnahme
# in die Empfehlungslisten — und das fällt niemandem auf.
if [ "$gefunden" -lt 4 ]; then
  echo "::warn:: nur $gefunden Bilder — Google empfiehlt mindestens vier." >&2
fi
echo "$gefunden Bilder aufbereitet in $ZIEL"
