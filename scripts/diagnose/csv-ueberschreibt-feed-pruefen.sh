#!/usr/bin/env bash
# csv-ueberschreibt-feed-pruefen.sh — findet Portal-Buchungen, die der Feed
# (Channex) angelegt hat und die ein CSV-Bestandsimport spaeter ueberschrieb.
#
# WORAN MAN SIE ERKENNT: `reservations.source_channex_booking_id` beginnt mit
# `csv:`, aber zu demselben Bestaetigungscode liegt ein Feed-Payload in
# `channex_booking`. Die Zeile hat dann `booked_at` und `ota_details` verloren,
# und die Eigentuemer-Abrechnung meldet „Portal hat keine Gebuehren gemeldet",
# obwohl die Aufstellung im Payload steht. Live am 31.08.2026: 54 Zeilen
# (Betrieb a25577cf), gefunden von Hand am Objekt Rævlingehuset 09.–13.09.
#
# Seit dem Riegel in `bookings_sync._project_booking_to_reservation` (aermere
# Quelle laesst reichere in Ruhe) darf hier NIE wieder etwas stehen. Exit 1,
# sobald eine Zeile gefunden wird — je Betrieb mit Zahl und Beispielcodes.
#
# AUFRUF (vom Repo-Root, braucht SSH-Zugang zum Server):
#   bash scripts/diagnose/csv-ueberschreibt-feed-pruefen.sh
set -euo pipefail

SERVER="${MIGRATE_SSH:-root@65.21.144.136}"
DB_PREFIX="${MIGRATE_DB_PREFIX:-db-cdqxi}"
DB_USER="${MIGRATE_DB_USER:-supabase_admin}"
DB_NAME="${MIGRATE_DB_NAME:-postgres}"
REMOTE_CMD='docker exec -i $(docker ps --format "{{.Names}}" | grep -E "^'"$DB_PREFIX"'" | head -1) psql -U "'"$DB_USER"'" -d "'"$DB_NAME"'" -tAq -f -'

ERGEBNIS="$(ssh -o ConnectTimeout=15 "$SERVER" "$REMOTE_CMD" <<'SQL'
select r.tenant_id, count(*),
       string_agg(r.external_ref, ', ' order by r.check_in) filter (where true)
  from public.reservations r
  join public.channex_booking cb
    on cb.ota_reservation_code = r.external_ref and cb.tenant_id = r.tenant_id
 where r.source_channex_booking_id like 'csv:%'
 group by r.tenant_id;
SQL
)"

if [ -z "$ERGEBNIS" ]; then
  echo "✓ Keine Feed-Buchung von einem CSV-Import ueberschrieben."
  exit 0
fi
echo "✗ Feed-Buchungen mit CSV-Quelle (tenant | anzahl | codes):"
printf '%s\n' "$ERGEBNIS" | tr '|' '\t'
echo
echo "Reparatur: den Channex-Payload erneut durch die Projektion schicken"
echo "(bookings_sync._project_booking_to_reservation mit channex_booking.raw)."
exit 1
