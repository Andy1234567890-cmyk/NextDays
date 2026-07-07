#!/bin/bash
# ---------------------------------------------------------------------------
# myNextDays — Favicon für den SOGo-Webmailer bauen & einspielen
# ---------------------------------------------------------------------------
# Ersetzt das gruene SOGo-Standard-Tab-Icon durch das myNextDays-Monogramm.
#
# Warum ein Monogramm "N" statt der Wortmarke?
# Im Repo gibt es KEIN reines Symbol-Logo, nur die breite Wortmarke
# ("myNextDays powered by AirSmil"). Eine Wortmarke ist bei 16x16 (echte
# Tab-Groesse) nur ein roter Klecks — unlesbar. Das Monogramm "N" auf
# Marken-Rot (#b82028) ist bei 16/32/64px klar erkennbar, hell wie dunkel.
#
# Erfordert ImageMagick (magick). Font-frei (reine Pfad-Geometrie), damit
# es ohne Freetype/Ghostscript laeuft.
#
# Einspielen auf dem Mailserver:
#   scp deploy/mail/mnd-favicon.ico root@MAILHOST:/opt/mailcow-dockerized/data/conf/sogo/custom-favicon.ico
#   docker compose up -d --force-recreate sogo-mailcow   # Datei-Mount -> force-recreate noetig!
#
# Das fertige mnd-favicon.ico liegt bereits versioniert daneben; dieses
# Skript dokumentiert/reproduziert nur den Bau.
# ---------------------------------------------------------------------------
set -e
OUT="${1:-mnd-favicon.ico}"
RED="#b82028"

# 128px Master: roter Roundrect + weisses "N" aus drei Balken (font-frei).
magick -size 128x128 xc:none \
  -fill "$RED" -draw "roundrectangle 0,0 127,127 28,28" \
  -fill white \
  -draw "polygon 34,34 50,34 50,94 34,94" \
  -draw "polygon 78,34 94,34 94,94 78,94" \
  -draw "polygon 34,34 50,34 94,94 78,94" \
  mnd-favicon-source.png

# Multi-Size ICO (16/32/48/64)
magick mnd-favicon-source.png -define icon:auto-resize=16,32,48,64 "$OUT"
echo "gebaut: $OUT ($(wc -c < "$OUT") Bytes)"
