#!/bin/bash
# ---------------------------------------------------------------------------
# myNextDays — White-Labeling des Mailservers (SOGo + Mailcow)
# ---------------------------------------------------------------------------
# Entfernt alle KUNDENSICHTBAREN "SOGo"- und "Mailcow"-Vorkommen, damit der
# Webmailer wie ein eigenes myNextDays-System wirkt.
#
# NICHT angetastet: interne Config-SCHLUESSEL (SOGoMailComposeMessageType,
# SOGoPageTitle als Schluessel, Verzeichnis-/Container-Namen) — nur die
# angezeigten TEXTE (rechte Seite der Localizable.strings, Titel, Labels).
#
# Idempotent: patcht sichtbare Marken -> "myNextDays"; mehrfaches Ausfuehren
# ist gefahrlos (ersetzt nur noch nicht ersetzte Vorkommen).
#
# WICHTIG: Die .strings/Templates liegen IM SOGo-Container und werden bei
# einem SOGo-Update neu erzeugt. Dieses Skript nach jedem Update erneut
# ausfuehren (oder in einen Post-Start-Hook haengen).
# ---------------------------------------------------------------------------
set -e
cd /opt/mailcow-dockerized
SOGO=mailcowdockerized-sogo-mailcow-1
NGINX=mailcowdockerized-nginx-mailcow-1
BRAND="myNextDays"

echo "=== 1) SOGoPageTitle (Browser-Tab-Titel Webmailer) -> $BRAND Mail ==="
CONF=data/conf/sogo/sogo.conf
[ -f "${CONF}.wl.orig" ] || cp "$CONF" "${CONF}.wl.orig"
if grep -q 'SOGoPageTitle = "SOGo Groupware"' "$CONF"; then
  sed -i 's/SOGoPageTitle = "SOGo Groupware"/SOGoPageTitle = "myNextDays Mail"/' "$CONF"
  echo "   gesetzt: $(grep SOGoPageTitle "$CONF" | tr -d ' ')"
else
  echo "   bereits: $(grep SOGoPageTitle "$CONF" | tr -d ' ')"
fi

echo
echo "=== 2) Sichtbare SOGo-Strings in ALLEN Sprach-Bundles (.strings) neutralisieren ==="
# Nur die WERTE (nach dem =) anfassen, damit die Schluessel/Struktur intakt bleibt.
# Ersetzt "SOGo" -> "myNextDays" NUR in Zeilen, die einen sichtbaren Wert zeigen.
docker exec "$SOGO" sh -s <<'PATCHEOF'
set -e
BRAND="myNextDays"
BASE=/usr/local/lib/GNUstep/SOGo
changed=0
for f in $(grep -rlE '= "[^"]*SOGo' $BASE/*.SOGo/Resources/*.lproj/Localizable.strings 2>/dev/null); do
  # Nur den rechten Teil (Wert) patchen: 'key" = "....SOGo...."' -> myNextDays.
  # 'SOGo Groupware'/'SOGo Mailer'/'SOGo Version'/'SOGo' im Wert -> myNextDays.
  sed -i -E '
    s/(= "[^"]*)SOGo Groupware([^"]*")/\1myNextDays\2/g;
    s/(= "[^"]*)SOGo Mailer([^"]*")/\1myNextDays Mail\2/g;
    s/(= "[^"]*)SOGo Version([^"]*")/\1Version\2/g;
    s/(= "[^"]*)SOGo([^"]*")/\1myNextDays\2/g;
  ' "$f"
  changed=$((changed+1))
done
echo "   $changed .strings-Dateien gepatcht"
# Kontrolle: bleiben sichtbare SOGo-Werte uebrig?
LEFT=$(grep -rhE '= "[^"]*SOGo' $BASE/*.SOGo/Resources/German.lproj/Localizable.strings $BASE/*.SOGo/Resources/English.lproj/Localizable.strings 2>/dev/null | wc -l)
echo "   verbliebene sichtbare SOGo-Werte (DE+EN): $LEFT (Ziel 0)"
PATCHEOF

echo
echo "=== 3) 'SOGo Version'-Label im gemounteten UIxPreferences.wox -> 'Version' ==="
WOX=data/conf/sogo/templates/UIxPreferences.wox
if [ -f "$WOX" ] && grep -q 'label:value="SOGo Version"' "$WOX"; then
  sed -i 's/label:value="SOGo Version"/label:value="Version"/' "$WOX"
  echo "   Label neutralisiert"
else
  echo "   (Label bereits neutral oder Template nicht gemountet)"
fi

echo
echo "=== 4) Mailcow-Login-Titel (title_name) -> myNextDays Mail ==="
# Mailcow: der sichtbare Login-/Tab-Titel kommt aus ui_texts (DB) bzw. vars.
# title_name/main_name/apps_name in vars.local.inc.php ueberschreiben (persistent).
docker exec "$NGINX" sh -c '
VARS=/web/inc/vars.local.inc.php
touch "$VARS"
if ! grep -q "MND-WHITELABEL" "$VARS" 2>/dev/null; then
  cat >> "$VARS" <<PHPEOF

// MND-WHITELABEL: sichtbare Mailcow-Titel durch myNextDays ersetzen
\$UI_TEXTS["title_name"]  = "myNextDays Mail";
\$UI_TEXTS["main_name"]   = "myNextDays Mail";
\$UI_TEXTS["apps_name"]   = "myNextDays Apps";
PHPEOF
  echo "   vars.local.inc.php erweitert"
else
  echo "   vars.local.inc.php bereits gepatcht"
fi
' 2>/dev/null || echo "   (nginx/php-Pfad pruefen)"

echo
echo "=== 5) Dienste neu starten, damit alles greift ==="
docker compose up -d --force-recreate sogo-mailcow 2>&1 | tail -1
docker restart "$NGINX" mailcowdockerized-php-fpm-mailcow-1 >/dev/null 2>&1 && echo "   nginx+php neu gestartet"
for i in $(seq 1 30); do c=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 5 "https://mail.mynextdays.dk/SOGo/"||echo 000); [ "$c" = "200" ] && { echo "   SOGo up ✓"; break; }; sleep 2; done

echo
echo "=== 6) Verifikation ==="
echo -n "   SOGo-Tab-Titel: "; curl -sk --max-time 10 "https://mail.mynextdays.dk/SOGo/" | grep -oiE "<title>[^<]*</title>" | head -1
echo -n "   Login-Tab-Titel: "; curl -sk --max-time 10 "https://mail.mynextdays.dk/" | grep -oiE "<title>[^<]*</title>" | head -1
