#!/usr/bin/env bash
# App-Icons und Splash-Logos der beiden Mobile-Apps aus den Marken-Logos ableiten
# (ADR-0019). Braucht ImageMagick 7 (`brew install imagemagick`).
#
# Das Icon zeigt das ECHTE Marken-Logo, nicht eine daraus abgeleitete Form.
# Beide Logos sind breite Wortmarken; sie werden auf weißem Grund auf die
# Icon-Breite eingepasst (mit Rand, damit die iOS-Eckenrundung nichts abschneidet).
# Bekannter Preis dieser Vorgabe: bei kleinen Größen (Einstellungen, Spotlight)
# ist die Schrift nicht mehr lesbar — der Wiedererkennungswert kommt dort aus
# Form und Farbe.
#
# Das Splash-Logo ist dieselbe Wortmarke, nur größer und quadratisch gepolstert.
set -euo pipefail

wurzel="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
arbeit="$(mktemp -d)"
trap 'rm -rf "$arbeit"' EXIT

# Logo auf die sichtbare Bounding-Box beschneiden — die Quelldateien haben
# unterschiedlich viel Leerraum, sonst wären die Icons verschieden groß.
logo_trimmen() {
  magick "$1" -trim +repage "$2"
}

# ── Icon-Sätze schreiben ─────────────────────────────────────────────────────

# $1 getrimmtes Logo  $2 Hintergrund  $3 Breitenanteil in %  $4 iOS-appiconset  $5 android/res
icons_schreiben() {
  local mark="$1" bg="$2" anteil="$3" ios="$4" res="$5"
  local kante=1024
  local breite=$(( kante * anteil / 100 ))

  # Nur auf die BREITE einpassen (`x` ohne Höhenwert): eine Wortmarke soll die
  # Fläche ausnutzen, nicht auf ein Quadrat gestaucht werden.
  magick -size ${kante}x${kante} xc:"$bg" \
    \( "$mark" -resize ${breite}x \) -gravity center -composite \
    "$arbeit/icon-1024.png"

  mkdir -p "$ios"
  local groessen=(
    "AppIcon-20@2x.png 40" "AppIcon-20@3x.png 60"
    "AppIcon-29@2x.png 58" "AppIcon-29@3x.png 87"
    "AppIcon-40@2x.png 80" "AppIcon-40@3x.png 120"
    "AppIcon-60@2x.png 120" "AppIcon-60@3x.png 180"
    "AppIcon-1024.png 1024"
  )
  for eintrag in "${groessen[@]}"; do
    set -- $eintrag
    # iOS-App-Icons dürfen keinen Alphakanal haben (App Store lehnt sie sonst ab).
    magick "$arbeit/icon-1024.png" -resize "${2}x${2}" -background "$bg" \
      -alpha remove -alpha off "$ios/$1"
  done

  for dichte in "mdpi 48" "hdpi 72" "xhdpi 96" "xxhdpi 144" "xxxhdpi 192"; do
    set -- $dichte
    mkdir -p "$res/mipmap-$1"
    magick "$arbeit/icon-1024.png" -resize "${2}x${2}" -alpha remove -alpha off \
      "$res/mipmap-$1/ic_launcher.png"
    # Runde Variante: dieselbe Fläche, kreisförmig maskiert.
    magick "$arbeit/icon-1024.png" -resize "${2}x${2}" \
      \( +clone -alpha transparent -fill white -draw "circle $(( $2 / 2 )),$(( $2 / 2 )) $(( $2 / 2 )),0" \) \
      -compose copy_opacity -composite "$res/mipmap-$1/ic_launcher_round.png"
  done
}

# Splash-Logo — die beiden Plattformen brauchen UNTERSCHIEDLICHE Zuschnitte:
#
#   iOS      LaunchScreen.storyboard spannt einen Rahmen von 72 % Breite mit
#            Seitenverhältnis 0,273 auf und skaliert „aspect fit". Ein
#            quadratisch gepolstertes Bild passt sich darin an der HÖHE ein und
#            schrumpft zur Briefmarke — hier gehört die getrimmte Wortmarke rein.
#   Android  splash_background.xml zeichnet eine 300dp × 300dp große Bitmap mit
#            `fill_horizontal|fill_vertical` — dort ist das quadratische Bild
#            richtig, sonst wird die Wortmarke verzerrt.
splash_schreiben() {
  local logo="$1" ios_imageset="$2" res="$3"
  mkdir -p "$ios_imageset" "$res/drawable"
  magick "$logo" -trim +repage -resize 1600x "$ios_imageset/logo.png"
  magick "$logo" -trim +repage -resize 1400x1400 \
    -background none -gravity center -extent 1600x1600 "$res/drawable/splash_logo.png"
}

# ── myBestDays ───────────────────────────────────────────────────────────────
bd="$wurzel/mobile-bestdays"
if [ -d "$bd" ]; then
  logo_trimmen "$bd/assets/img/mybestdays-logo.png" "$arbeit/bd-logo.png"
  icons_schreiben "$arbeit/bd-logo.png" "#FFFFFF" 82 \
    "$bd/ios/MyBestDays/Images.xcassets/AppIcon.appiconset" \
    "$bd/android/app/src/main/res"
  splash_schreiben "$bd/assets/img/mybestdays-logo.png" \
    "$bd/ios/MyBestDays/Images.xcassets/SplashLogo.imageset" \
    "$bd/android/app/src/main/res"
  echo "✓ myBestDays-Icons geschrieben"
fi

# ── myNextDays ───────────────────────────────────────────────────────────────
nd="$wurzel/mobile-nextdays"
if [ -d "$nd" ]; then
  logo="$wurzel/marketing/public/marketing/brand/mynextdays-logo-freigestellt.png"
  logo_trimmen "$logo" "$arbeit/nd-logo.png"
  icons_schreiben "$arbeit/nd-logo.png" "#FFFFFF" 82 \
    "$nd/ios/MyNextDays/Images.xcassets/AppIcon.appiconset" \
    "$nd/android/app/src/main/res"
  splash_schreiben "$logo" \
    "$nd/ios/MyNextDays/Images.xcassets/SplashLogo.imageset" \
    "$nd/android/app/src/main/res"
  echo "✓ myNextDays-Icons geschrieben"
fi
