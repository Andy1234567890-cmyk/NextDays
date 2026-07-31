#!/usr/bin/env bash
# Prüft den Stand des Domain-Cutovers gegen die echte Welt.
#
# Beantwortet drei Fragen ohne Raten:
#   1. Auf welchen Nameservern liegt die Domain gerade?
#   2. Worauf zeigt sie — Server, Parking oder nichts?
#   3. Antwortet HTTPS mit gültigem Zertifikat?
#
# Aufruf: deploy/domain-check.sh
set -uo pipefail

SERVER="65.21.144.136"
PARKING="212.237.249.17"
MAILSERVER="62.238.4.193"

# Hosts, die am Ende auf den Server zeigen müssen.
AKTIV=(
  "mynextdays.com"
  "www.mynextdays.com"
  "app.mynextdays.com"
  "api.mynextdays.com"
  "mybestdays.dk"
  "www.mybestdays.dk"
)

# Domänen, die per 301 auf das Original weiterleiten.
REDIRECT=(
  "mynextdays.de"
  "mynextdays.net"
  "mynextdays.org"
  "mybestdays.eu"
  "mybestdays.net"
)

gruen() { printf "\033[32m%s\033[0m" "$1"; }
rot()   { printf "\033[31m%s\033[0m" "$1"; }
grau()  { printf "\033[90m%s\033[0m" "$1"; }

bewerte_ip() {
  case "$1" in
    "$SERVER")  gruen "Server" ;;
    "$PARKING") rot   "PARKING" ;;
    "")         rot   "keine Antwort" ;;
    *)          printf "%s" "$1" ;;
  esac
}

echo "=== Nameserver ==="
for d in mynextdays.com mynextdays.de mynextdays.net mynextdays.org \
         mybestdays.dk mybestdays.eu mybestdays.net mynextdays.dk; do
  ns=$(dig +short NS "$d" 2>/dev/null | head -1)
  printf "  %-18s " "$d"
  case "$ns" in
    *cloudflare*) gruen "Cloudflare" ;;
    *dandomain*)  rot   "DanDomain (noch nicht umgestellt)" ;;
    "")           rot   "keine NS-Antwort" ;;
    *)            printf "%s" "$ns" ;;
  esac
  [ "$d" = "mynextdays.dk" ] && grau "   ← Mail, bleibt unangetastet"
  echo
done

echo
echo "=== A-Records der aktiven Hosts ==="
for h in "${AKTIV[@]}"; do
  ip=$(dig +short A "$h" 2>/dev/null | tail -1)
  printf "  %-26s " "$h"
  bewerte_ip "$ip"
  echo
done

echo
echo "=== Wildcard (muss WEG sein) ==="
for d in mynextdays.com mybestdays.dk; do
  ip=$(dig +short A "zzz-test-wildcard.$d" 2>/dev/null | tail -1)
  printf "  *.%-24s " "$d"
  if [ -z "$ip" ]; then
    gruen "kein Wildcard — richtig"
  else
    rot "Wildcard aktiv ($ip) — beantwortet auch api./app.!"
  fi
  echo
done

echo
echo "=== HTTPS + Zertifikat ==="
for h in "${AKTIV[@]}"; do
  printf "  %-26s " "$h"
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "https://$h/" 2>/dev/null)
  if [ "$code" = "000" ]; then
    rot "keine HTTPS-Antwort"
  else
    if echo | openssl s_client -connect "$h:443" -servername "$h" 2>/dev/null \
       | openssl x509 -noout -checkend 0 >/dev/null 2>&1; then
      gruen "HTTP $code, Zertifikat gültig"
    else
      printf "HTTP %s, " "$code"; rot "Zertifikat fehlt/ungültig"
    fi
  fi
  echo
done

echo
echo "=== Weiterleitungen der Marken-Domänen ==="
for h in "${REDIRECT[@]}"; do
  printf "  %-26s " "$h"
  ziel=$(curl -s -o /dev/null -w "%{redirect_url}" -m 10 "https://$h/" 2>/dev/null)
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "https://$h/" 2>/dev/null)
  if [ -n "$ziel" ]; then
    printf "%s → %s" "$code" "$ziel"
  elif [ "$code" = "000" ]; then
    grau "noch keine Antwort"
  else
    printf "HTTP %s " "$code"; rot "kein Redirect"
  fi
  echo
done

echo
echo "=== Mail (mynextdays.dk) — darf sich NICHT ändern ==="
mx=$(dig +short MX mynextdays.dk 2>/dev/null | head -1)
mailip=$(dig +short A mail.mynextdays.dk 2>/dev/null | tail -1)
printf "  MX                         "
[ -n "$mx" ] && gruen "$mx" || rot "FEHLT — Mailversand gestört!"
echo
printf "  mail.mynextdays.dk         "
if [ "$mailip" = "$MAILSERVER" ]; then gruen "$mailip"; else rot "${mailip:-keine Antwort} (erwartet $MAILSERVER)"; fi
echo
spf=$(dig +short TXT mynextdays.dk 2>/dev/null | grep -c "v=spf1")
printf "  SPF                        "
[ "$spf" -gt 0 ] && gruen "vorhanden" || rot "FEHLT"
echo

echo
echo "=== Staging (muss bis zum Schluss laufen) ==="
for u in "https://nextdays-api.65.21.144.136.sslip.io/api/v1/booking-engine/listings?limit=1" \
         "https://y13cm245vlmvq3yv38gdbtat.65.21.144.136.sslip.io/" \
         "https://bln3q0n1l1se2hna8utkuag9.65.21.144.136.sslip.io/login"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 12 "$u" 2>/dev/null)
  name=$(echo "$u" | sed -E 's#https://([^.]+)\..*#\1#')
  printf "  %-26s " "$name"
  [ "$code" = "200" ] && gruen "HTTP $code" || rot "HTTP $code"
  echo
done
