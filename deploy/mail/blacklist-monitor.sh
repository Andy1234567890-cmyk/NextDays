#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Blacklist-Monitoring für die Mailserver-IP (DNSBL). Für Cron (täglich).
# Alarm (Exit 2), wenn die IP ECHT gelistet ist — damit man reagiert, BEVOR
# Kunden Zustellprobleme oder Beschwerden melden.
#
# WICHTIG: Spamhaus liefert bei Abfragen über öffentliche/rate-limitierte Resolver
# einen Fehlercode 127.255.255.x zurück (KEIN Listing, sondern "Resolver blockiert").
# Diese Codes werden hier explizit ignoriert, sonst gäbe es False-Positive-Alarme.
# Echte Listings liegen im Bereich 127.0.0.2 – 127.0.0.255.
#
# Nutzung:  bash blacklist-monitor.sh [IP]   (Default: 62.238.4.193)
# ─────────────────────────────────────────────────────────────────────────────
IP="${1:-62.238.4.193}"
REV=$(echo "$IP" | awk -F. '{print $4"."$3"."$2"."$1}')
BLS="zen.spamhaus.org bl.spamcop.net b.barracudacentral.org dnsbl.sorbs.net cbl.abuseat.org psbl.surriel.com"
LISTED=""
for bl in $BLS; do
  RES=$(dig +short +time=3 +tries=1 "${REV}.${bl}" A 2>/dev/null)
  for ans in $RES; do
    case "$ans" in
      127.255.255.*) : ;;                 # Spamhaus-Fehlercode (Resolver-Block) → ignorieren
      127.0.0.*)     LISTED="$LISTED ${bl}(${ans})" ;;  # ECHTES Listing
      127.*)         LISTED="$LISTED ${bl}(${ans})" ;;  # sonstiges Listing anderer DNSBL
    esac
  done
done
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
if [ -n "$LISTED" ]; then
  echo "[$TS] ALARM: $IP ECHT GELISTET auf:$LISTED"
  exit 2
else
  echo "[$TS] OK: $IP sauber (Spamhaus-Resolver-Fehlercodes ignoriert)"
  exit 0
fi
