#!/usr/bin/env bash
# Prüft den Einbau von Suchmaschinen-Nachweis und Reichweitenmessung auf der
# Marketing-Website — gegen eine LAUFENDE Instanz, nicht gegen den Quelltext.
#
# WARUM ES DIESES SKRIPT GIBT: Beide Dinge sind unsichtbar, wenn sie fehlen.
# Ein leeres `NEXT_PUBLIC_*` beim Bauen liefert eine Seite, die genauso aussieht
# wie die richtige — nur ohne Meta-Tag und ohne Messung. Das fällt erst auf,
# wenn die Search Console die Verifizierung ablehnt oder Wochen später niemand
# Zahlen hat. Genau die Klasse Fehler, die laut sein muss statt still
# (CLAUDE.md, Wurzel 5).
#
# Geprüft wird das AUSGELIEFERTE HTML:
#   1. google-site-verification steht im <head> — auf JEDER Seite, auch den
#      Rechtsseiten (Next erbt Metadaten von der Wurzel nach unten).
#   2. VOR der Einwilligung ist KEIN GA4-Skript und KEINE Mess-ID im HTML.
#      Das ist die datenschutzrechtlich entscheidende Prüfung: das Tag darf
#      erst der Browser NACH der Zustimmung nachladen, nie der Server
#      mitliefern.
#
# Was dieses Skript NICHT kann: den Browser-Pfad nach der Zustimmung prüfen —
# dafür braucht es einen echten Browser (Playwright) oder das Netzwerk-Protokoll
# der Entwicklerwerkzeuge. Diese Grenze steht hier ausdrücklich, damit ein
# grüner Lauf nicht für mehr genommen wird, als er beweist.
#
# Aufruf:  bash scripts/diagnose/messung-einwilligung-pruefen.sh [BASIS_URL]
#          Vorgabe ist http://localhost:3001 (lokaler Dev-Server der Marketing-App).
set -uo pipefail

BASIS="${1:-http://localhost:3001}"
SEITEN=(/ /cookie-richtlinie /datenschutz /impressum /agb /auftragsverarbeitung /preise /kontakt)
FEHLER=0

echo "Prüfe ${BASIS}"
echo

erreichbar=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASIS}/" || echo 000)
if [ "$erreichbar" != "200" ]; then
  echo "FEHLER: ${BASIS}/ antwortet ${erreichbar} — läuft die App?"
  exit 1
fi

echo "== 1. Eigentumsnachweis (google-site-verification) im <head>"
for seite in "${SEITEN[@]}"; do
  html=$(curl -s --max-time 30 "${BASIS}${seite}")
  kopf="${html%%</head>*}"
  if [[ "$kopf" == *'name="google-site-verification"'* ]]; then
    wert=$(printf '%s' "$kopf" | grep -o 'name="google-site-verification" content="[^"]*"' | head -1 | sed 's/.*content="//;s/"$//')
    if [ -n "$wert" ]; then
      echo "  OK      ${seite} (${wert:0:12}…)"
    else
      echo "  FEHLER  ${seite}: Tag vorhanden, aber content ist leer"
      FEHLER=$((FEHLER + 1))
    fi
  else
    echo "  FEHLER  ${seite}: kein google-site-verification im <head>"
    FEHLER=$((FEHLER + 1))
  fi
done

echo
echo "== 2. Vor der Einwilligung darf KEIN GA4 im HTML stehen"
for seite in "${SEITEN[@]}"; do
  html=$(curl -s --max-time 30 "${BASIS}${seite}")
  befund=""
  [[ "$html" == *"googletagmanager.com/gtag/js"* ]] && befund="gtag-Skript"
  # Die Mess-ID selbst darf ebenfalls nicht im Server-HTML stehen: sie käme aus
  # dem Bundle und wäre der Beleg, dass etwas ungefragt konfiguriert wird.
  if printf '%s' "$html" | grep -qE '"G-[A-Z0-9]{6,}"'; then
    befund="${befund:+$befund, }Mess-ID"
  fi
  if [ -n "$befund" ]; then
    echo "  FEHLER  ${seite}: ${befund} schon im ausgelieferten HTML"
    FEHLER=$((FEHLER + 1))
  else
    echo "  OK      ${seite}"
  fi
done

echo
echo "== 3. Quelltext-Gegenprobe: Einwilligung ist Voraussetzung"
WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if grep -q 'istErlaubt("analytisch")' "${WURZEL}/marketing/lib/analytics.ts"; then
  echo "  OK      analytics.ts prüft istErlaubt(\"analytisch\")"
else
  echo "  FEHLER  analytics.ts prüft die Einwilligung NICHT — Leiste ist eine Attrappe"
  FEHLER=$((FEHLER + 1))
fi
if grep -q 'analytics_storage: "denied"' "${WURZEL}/marketing/lib/analytics.ts"; then
  echo "  OK      Consent-Mode-Vorgabe steht auf denied"
else
  echo "  FEHLER  keine denied-Vorgabe (Consent Mode v2) in analytics.ts"
  FEHLER=$((FEHLER + 1))
fi

echo
if [ "$FEHLER" -eq 0 ]; then
  echo "Alles in Ordnung (${#SEITEN[@]} Seiten geprüft)."
  echo "HINWEIS: Der Pfad NACH der Zustimmung ist hiermit nicht geprüft —"
  echo "dafür im Browser zustimmen und auf einen Request an"
  echo "googletagmanager.com sowie die Cookies _ga/_ga_* achten."
  exit 0
fi
echo "${FEHLER} Fehler."
exit 1
