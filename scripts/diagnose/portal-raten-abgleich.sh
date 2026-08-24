#!/usr/bin/env bash
# Trockenlauf: welche Portal-Raten haetten bei uns keinen Preisplan?
#
# Stellt je Objekt und Portal NEBENEINANDER:
#   was das Portal fuehrt      (POST /channels/mapping_details -> rooms[].rates[])
#   was der Kanal zuordnet     (GET  /channels/{id} -> rate_plans[].settings)
#   welche Plaene wir haben    (rate_plans, per SSH auf der Server-DB)
#   -> was `abgleich_portal_raten` ANLEGEN und LOESCHEN WUERDE
#
# Hintergrund: `channels._plaene_fuer_uebrige_raten` legt je Portal-Rate einen
# eigenen Preisplan an, laeuft aber nur beim VERBINDEN eines Kanals. Fuer die 18
# bereits verbundenen Booking-Kennungen griff es nie — bei "FeWo *Stjerneskud*"
# fuehrt Booking zwei Raten (Standard Rate, Wochenrate), lokal stand nur der
# Grundpreis. Booking fuehrt Restriktionen auf RATE-Ebene: eine Rate ohne
# eigenen Plan ist bei uns unsichtbar und traegt keinen Mindestaufenthalt.
#
# LOESCHEN (seit 24.08.2026 Teil des Jobs): ein Kanal-Eintrag, dessen
# `rate_plan_code` das Portal nicht mehr fuehrt, kippt den PREIS-Push des ganzen
# Zimmers. Live bei "Feriehus Line" (Hotel 11659051, Zimmer 1165905102):
#   <Error Code="RATE_NOT_ACTIVE_FOR_ROOM"
#          ShortText="Rate '65900767' is not active for room '1165905102'"/>
#   Result: Failure
# Der Mindestaufenthalt-Push derselben Aktion lief mit <Success/> durch — nur
# die Preis-Nachricht nennt die Raten namentlich. Dieses Skript ZEIGT die
# Eintraege; geloescht werden sie ausschliesslich vom Job.
#
# NUR LESEN. `mapping_details` ist trotz POST eine reine Leseabfrage (sie legt
# nichts an); `GET /channels/{id}` ebenso. Kein PUT/PATCH/DELETE, keine
# Schreibabfrage an die DB.
#
# Aufruf:  bash scripts/diagnose/portal-raten-abgleich.sh [objekt-titel-teil]
set -euo pipefail

HIER="$(cd "$(dirname "$0")" && pwd)"
cd "$HIER/../../apps/api"
# .env gezielt lesen statt sourcen: unquotierte Werte mit Leerzeichen liesse die
# Shell als Kommando ausfuehren.
eval "$(grep -E '^CHANNEX_(API_KEY|BASE_URL)=' ./.env \
        | sed -E 's/^([A-Z_]+)=\"?([^\"]*)\"?$/export \1="\2"/')"
: "${CHANNEX_API_KEY:?CHANNEX_API_KEY fehlt}"
: "${CHANNEX_BASE_URL:?CHANNEX_BASE_URL fehlt}"

DB_HOST="${DB_HOST:-root@65.21.144.136}"
DB_CONTAINER="${DB_CONTAINER:-db-cdqxi7d0w34sxzr4wr8jy8um}"
FILTER="${1:-}"

# --- 1) Die Verbindungen + die lokalen Plannamen, in EINER Leseabfrage -------
# Nur Portale mit einer echten Raten-Ebene (BookingCom & Co.): Airbnb fuehrt
# genau EINE Rate je Anzeige, dort gaebe es nie etwas anzulegen — siehe
# `portal_raten_abgleich.PORTALE_MIT_RATEN`.
# PLAENE traegt je Objekt die Paare "<channex_rate_plan_id>=<planname>", mit
# '~~' getrennt — die Auswertung braucht beides: den Namen (hat die Rate einen
# namensgleichen Plan?) und die Channex-ID (zeigt der Kanal-Eintrag darauf?).
# Plaene ohne Channex-Zuordnung stehen als "=<name>" drin, damit ein lokal schon
# vorhandener, aber noch nicht registrierter Plan nicht als fehlend gilt.
SQL="select c.property_id, p.title, c.ota_portal_code, c.ota_hotel_id,
             c.channex_channel_id,
             coalesce((select string_agg(coalesce(m.channex_rate_plan_id::text,'')
                                         || '=' || r.name, '~~'
                                         order by r.created_at)
                       from rate_plans r
                       left join channex_rate_plan_map m
                              on m.local_rate_plan_id = r.id
                             and m.deleted_at is null
                      where r.property_id = c.property_id), '')
        from channex_channel_connection c
        join properties p on p.id = c.property_id
       where c.channex_channel_id is not null
         and c.ota_portal_code in ('BookingCom','OpenChannel','SandBox')
       order by p.title"

echo "== Verbindungen von der Server-DB lesen =="
ZEILEN="$(ssh "$DB_HOST" "docker exec $DB_CONTAINER \
  psql -U postgres -t -A -F'|' -c \"$(echo "$SQL" | tr '\n' ' ')\"")"

if [ -z "$ZEILEN" ]; then
  echo "  keine verbundene Kennung mit Raten-Ebene gefunden"
  exit 0
fi

printf '\n%-30s %-12s %-10s %s\n' "OBJEKT" "PORTAL" "KENNUNG" "BEFUND"
printf '%s\n' "-------------------------------------------------------------------------------"

GESAMT=0
FEHLT=0
VERWAIST=0

while IFS='|' read -r PROP TITEL PORTAL HOTEL CHANNEL PLAENE; do
  [ -n "$PROP" ] || continue
  if [ -n "$FILTER" ] && ! printf '%s' "$TITEL" \
      | grep -qi -- "$FILTER"; then continue; fi
  GESAMT=$((GESAMT + 1))

  RATEN="$(curl -sS -X POST \
      -H "user-api-key: $CHANNEX_API_KEY" \
      -H 'Content-Type: application/json' \
      -d "{\"channel\":\"$PORTAL\",\"settings\":{\"hotel_id\":\"$HOTEL\"}}" \
      "$CHANNEX_BASE_URL/channels/mapping_details" || echo '{}')"

  KANAL="$(curl -sS -H "user-api-key: $CHANNEX_API_KEY" \
      "$CHANNEX_BASE_URL/channels/$CHANNEL" || echo '{}')"

  AUSGABE="$(RATEN="$RATEN" KANAL="$KANAL" PLAENE="$PLAENE" \
    python3 "$HIER/portal_raten_abgleich_auswertung.py")"
  ANZAHL="${AUSGABE%%|*}"
  REST="${AUSGABE#*|}"
  ANZAHL_VERWAIST="${REST%%|*}"
  BEFUND="${REST#*|}"
  FEHLT=$((FEHLT + ANZAHL))
  VERWAIST=$((VERWAIST + ANZAHL_VERWAIST))

  printf '%-30.30s %-12.12s %-10.10s %s\n' \
    "$TITEL" "$PORTAL" "$HOTEL" "$BEFUND"
done <<< "$ZEILEN"

printf '%s\n' "-------------------------------------------------------------------------------"
echo "  $GESAMT Kennung(en) geprueft; $FEHLT Preisplan/-plaene wuerde der"
echo "  Abgleich anlegen, $VERWAIST verwaiste(n) Kanal-Eintrag loeschen."
echo
echo "  Anlegen tut das der Job 'abgleich_portal_raten' (taeglich am"
echo "  reconcile-Tick, worker._enqueue_portal_raten_abgleich). Dieses Skript"
echo "  liest ausschliesslich."
