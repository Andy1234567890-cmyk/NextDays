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
#
# ZWEI WEGE, je nachdem was die Marke liefert:
#   `icons_schreiben`         leitet das Icon aus der Wortmarke ab (myBestDays).
#   `icon_vorlage_schreiben`  nutzt eine FERTIGE quadratische Icon-Vorlage aus
#                             Figma (myNextDays: mnd_appicon_dunkel.png). Wo es
#                             eine gestaltete Vorlage gibt, ist sie besser als
#                             jede Ableitung — Randabstand und Farbfläche sind
#                             dort schon entschieden.
#
# ACHTUNG SVG: ImageMagick rastert die Marken-SVGs FALSCH — sein interner
# SVG-Renderer verwirft stroke-only-Pfade, wodurch die zwei Chevrons der
# Bildmarke still fehlen (nur der Schriftzug kam durch). Vektorvorlagen laufen
# deshalb über `svg_rastern` (qlmanage/WebKit), nicht über `magick file.svg`.
set -euo pipefail

wurzel="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
arbeit="$(mktemp -d)"
trap 'rm -rf "$arbeit"' EXIT

# Optionales Argument: nur EINE Marke neu schreiben ("bestdays" | "nextdays").
# Ohne Argument laufen beide. Wichtig, weil ein Lauf sonst auch die Assets der
# nicht betroffenen App neu kodiert — die Bilder sehen gleich aus, aber jede
# Datei erscheint als geändert und verdeckt im Diff, was wirklich neu ist.
nur="${1:-alle}"
case "$nur" in
  alle | bestdays | nextdays) ;;
  *) echo "Aufruf: $(basename "$0") [bestdays|nextdays]" >&2; exit 2 ;;
esac

# Logo auf die sichtbare Bounding-Box beschneiden — die Quelldateien haben
# unterschiedlich viel Leerraum, sonst wären die Icons verschieden groß.
logo_trimmen() {
  magick "$1" -trim +repage "$2"
}

# SVG -> PNG über qlmanage (macOS/WebKit), weil ImageMagick stroke-only-Pfade
# verwirft (siehe Kopf). qlmanage liefert stets ein Quadrat der Kantenlänge
# $2, in dem die viewBox oben links eingepasst ist; wir schneiden genau den
# viewBox-Anteil heraus. Kein `-trim`: der wäre farbabhängig und die
# Negativ-Fassung (weiße Teile auf Transparenz) bekäme andere Maße als die
# normale.
# $1 svg  $2 Kantenlänge/Breite  $3 viewBox-Breite  $4 viewBox-Höhe  $5 Ziel-PNG
svg_rastern() {
  local svg="$1" breite="$2" vbw="$3" vbh="$4" ziel="$5"
  local tmp="$arbeit/ql-$(basename "$svg" .svg)-$breite"
  mkdir -p "$tmp"
  qlmanage -t -s "$breite" -o "$tmp" "$svg" >/dev/null 2>&1
  local gen="$tmp/$(basename "$svg").png"
  [ -f "$gen" ] || { echo "qlmanage lieferte kein PNG für $svg" >&2; return 1; }
  local hoehe
  hoehe=$(python3 -c "print(round($breite*$vbh/$vbw))")
  magick "$gen" -crop "${breite}x${hoehe}+0+0" +repage "$ziel"
}

# Icon-Satz aus einer FERTIGEN quadratischen Vorlage (kein Einpassen, kein
# Hintergrund-Erfinden — die Vorlage ist das Icon).
# $1 Vorlage-PNG (quadratisch)  $2 iOS-appiconset  $3 android/res
icon_vorlage_schreiben() {
  local vorlage="$1" ios="$2" res="$3"

  # Die Vorlage bringt ihre eigene Eckenrundung mit; iOS und Android runden
  # selbst nachträglich. Die transparenten Ecken werden deshalb mit der
  # Flächenfarbe der Vorlage gefüllt (Pixel 8/8 liegt innerhalb der Rundung),
  # sonst erscheint das Icon auf hellem Grund mit hellen Ecken über der
  # dunklen Fläche.
  local flaeche
  flaeche=$(magick "$vorlage" -format '%[pixel:p{8,8}]' info:)
  magick -size 1024x1024 xc:"$flaeche" \
    \( "$vorlage" -resize 1024x1024 \) -composite \
    -alpha remove -alpha off "$arbeit/icon-1024.png"

  mkdir -p "$ios"
  local groessen=(
    "AppIcon-20@2x.png 40" "AppIcon-20@3x.png 60"
    "AppIcon-29@2x.png 58" "AppIcon-29@3x.png 87"
    "AppIcon-40@2x.png 80" "AppIcon-40@3x.png 120"
    "AppIcon-60@2x.png 120" "AppIcon-60@3x.png 180"
    "AppIcon-1024.png 1024"
  )
  local eintrag
  for eintrag in "${groessen[@]}"; do
    set -- $eintrag
    magick "$arbeit/icon-1024.png" -resize "${2}x${2}" \
      -alpha remove -alpha off "$ios/$1"
  done

  local dichte
  for dichte in "mdpi 48" "hdpi 72" "xhdpi 96" "xxhdpi 144" "xxxhdpi 192"; do
    set -- $dichte
    mkdir -p "$res/mipmap-$1"
    magick "$arbeit/icon-1024.png" -resize "${2}x${2}" -alpha remove -alpha off \
      "$res/mipmap-$1/ic_launcher.png"
    magick "$arbeit/icon-1024.png" -resize "${2}x${2}" \
      \( +clone -alpha transparent -fill white -draw "circle $(( $2 / 2 )),$(( $2 / 2 )) $(( $2 / 2 )),0" \) \
      -compose copy_opacity -composite "$res/mipmap-$1/ic_launcher_round.png"
  done
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
if [ -d "$bd" ] && [ "$nur" != "nextdays" ]; then
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
if [ -d "$nd" ] && [ "$nur" != "bestdays" ]; then
  marke_nd="$wurzel/marketing/public/marketing/brand"

  # App-Icon: die gestaltete Vorlage aus Figma (dunkles abgerundetes Quadrat mit
  # den zwei Chevrons), nicht die breite Wortmarke. Bei 40 px ist ein Schriftzug
  # unlesbar, die Chevrons bleiben erkennbar.
  icon_vorlage_schreiben "$marke_nd/mnd_appicon_dunkel.png" \
    "$nd/ios/MyNextDays/Images.xcassets/AppIcon.appiconset" \
    "$nd/android/app/src/main/res"

  # Splash: die Wortmarke in der Fassung für HELLE Flächen — beide Splash-
  # Hintergründe sind hell (Android colors.xml #FFFFFF, iOS LaunchScreen
  # off-white). Quelle ist das SVG, damit auch 1600 px scharf bleiben.
  svg_rastern "$nd/assets/img/mnd_lockup.svg" 1960 245 44 "$arbeit/nd-lockup.png"
  splash_schreiben "$arbeit/nd-lockup.png" \
    "$nd/ios/MyNextDays/Images.xcassets/SplashLogo.imageset" \
    "$nd/android/app/src/main/res"
  echo "✓ myNextDays-Icons geschrieben"
fi
