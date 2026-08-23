#!/usr/bin/env bash
# Mindestaufenthalt: die ganze Kette in einem Blick.
#
#   lokal (properties.type_attributes.availability)
#     -> Job (jobs: sync_property_content)
#       -> Channex (properties.settings.min_stay_type)
#         -> Rate-Plan-Restriktionen (min_stay_arrival/through)
#
# Hintergrund: am 23.08.2026 stand bei allen 18 Objekten im Booking-Extranet
# "Keine Mindestaufenthaltsdauer", obwohl lokal und bei Channex Werte anlagen.
# Ursache war settings.min_stay_type="both" — Booking kennt je Zimmer nur EINEN
# Mindestaufenthalt-Typ und uebernimmt bei "both" keinen. Wer das prueft, will
# alle vier Ebenen NEBENEINANDER sehen, nicht einzeln raten.
#
# NUR LESEN. Keine Schreibaufrufe an Channex.
#
# Aufruf:  bash scripts/diagnose/mindestaufenthalt-kette.sh [objekt-titel-teil]
set -euo pipefail

HIER="$(cd "$(dirname "$0")" && pwd)"
cd "$HIER/../../apps/api"
# .env gezielt lesen statt sourcen: unquotierte Werte mit Leerzeichen
# (Firmenname "... ApS") liesse die Shell als Kommando ausfuehren.
eval "$(grep -E '^CHANNEX_(API_KEY|BASE_URL)=' ./.env \
        | sed -E 's/^([A-Z_]+)=\"?([^\"]*)\"?$/export \1="\2"/')"
: "${CHANNEX_API_KEY:?CHANNEX_API_KEY fehlt}"
: "${CHANNEX_BASE_URL:?CHANNEX_BASE_URL fehlt}"
FILTER="${1:-}"

echo "== Channex: settings.min_stay_type je Property =="
curl -sS -H "user-api-key: $CHANNEX_API_KEY" \
  "$CHANNEX_BASE_URL/properties?pagination%5Blimit%5D=100" \
| FILTER="$FILTER" python3 "$HIER/mindestaufenthalt_channex.py"

echo
echo "== Lokal + Jobs: per SSH auf der Server-DB =="
cat <<'HINT'
  ssh root@65.21.144.136 "docker exec \$(docker ps -qf name=supabase-db) \
    psql -U postgres -c \"
      select p.title,
             p.type_attributes->'availability'->>'minStayType' as lokal_typ,
             p.type_attributes->'availability'->>'minStay'     as lokal_naechte,
             (select max(created_at) from jobs j
               where j.type='sync_property_content'
                 and j.payload->>'property_id' = p.id::text)   as letzter_sync_job
        from properties p
       where p.status='active'
       order by p.title;\""

  Kein letzter_sync_job => das Speichern hat das Backend nie erreicht.
  Dann sind die Frontend-Logs die Quelle: Browser-Konsole, Praefix
  [verfuegbarkeit] — sie nennen Dauer und Fehler je Teilschritt.

  Backend-Logs zum Gegenpruefen (Ereignisnamen):
    property_update_availability            was das Frontend schickt
    channex_content_sync_eingereiht         Job wurde erzeugt
    channex_sync_uebersprungen_keine_portalfreigabe
    channex_min_stay_type_push              was an Channex geht
HINT
