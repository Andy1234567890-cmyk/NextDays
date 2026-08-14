#!/usr/bin/env bash
# ============================================================================
# stop-sell-echo-pruefen.sh — beweist, dass der Stop-Sell-Echo-Kreis tot bleibt
# ----------------------------------------------------------------------------
# Hintergrund (14.08.2026): Der ARI-Import las Channex' abgeleiteten
# stop_sell-Readback als Portal-Wahrheit zurück und schrieb Zeilen mit
# source='channex'; der nächtliche Full-Sync pushte sie als echte Stops —
# drei aktive Objekte waren monatelang auf allen Portalen unverkäuflich.
# Der Import-Schreibpfad ist entfernt (bookings_sync), die Alt-Zeilen hat
# Migration 0394 gelöscht. Seitdem gibt es KEINEN legitimen Schreiber mehr
# für source='channex' — jede solche Zeile ist ein Regressionsbeweis.
#
# Das Skript prüft die LIVE-DB (read-only):
#   1. stop_sell-Zeilen mit source='channex'  → müssen 0 sein
#   2. zusätzlich als Übersicht: manuelle Stops je Objekt (nur Anzeige)
#
# Aufruf:
#   bash scripts/diagnose/stop-sell-echo-pruefen.sh
#
# Zugang (ENV, Defaults passen auf den Staging-Server):
#   DB_SSH=root@65.21.144.136     # leer lassen, wenn psql lokal erreichbar ist
#   DB_CONTAINER=                 # leer = automatisch (docker ps, Präfix db-)
#   DB_USER=postgres
#   DB_NAME=postgres
#
# Exit 0 = keine Echo-Zeilen, Exit 1 = Regression (Echo-Kreis wieder aktiv).
# ============================================================================
set -uo pipefail

DB_SSH="${DB_SSH-root@65.21.144.136}"
DB_CONTAINER="${DB_CONTAINER-}"
DB_USER="${DB_USER-postgres}"
DB_NAME="${DB_NAME-postgres}"

psql_exec() {
  local sql="$1"
  if [[ -n "$DB_SSH" ]]; then
    local container="$DB_CONTAINER"
    if [[ -z "$container" ]]; then
      container=$(ssh "$DB_SSH" "docker ps --format '{{.Names}}' | grep '^db-' | head -1")
    fi
    ssh "$DB_SSH" "docker exec $container psql -U $DB_USER -d $DB_NAME -Atc \"$sql\""
  else
    psql -U "$DB_USER" -d "$DB_NAME" -Atc "$sql"
  fi
}

echo "— Stop-Sell-Echo-Prüfung (source='channex' muss leer sein) —"

anzahl=$(psql_exec "select count(*) from public.stop_sell where source = 'channex'")
if [[ -z "$anzahl" ]]; then
  echo "FEHLER: keine Antwort von der DB — Zugang prüfen (DB_SSH/DB_CONTAINER)." >&2
  exit 1
fi

if [[ "$anzahl" != "0" ]]; then
  echo "REGRESSION: $anzahl stop_sell-Zeilen mit source='channex' gefunden:" >&2
  psql_exec "select p.title || ' | ' || s.date || ' | angelegt ' || s.created_at
             from public.stop_sell s join public.properties p on p.id = s.property_id
             where s.source = 'channex' order by s.created_at desc limit 20" >&2
  echo "→ Es gibt keinen legitimen Schreiber für source='channex' mehr" >&2
  echo "  (Import-Pfad entfernt am 14.08.2026, Migration 0394)." >&2
  echo "  Herkunft klären, BEVOR der Full-Sync die Zeilen als echte" >&2
  echo "  Stops an die Portale pusht." >&2
  exit 1
fi

echo "OK: 0 Echo-Zeilen."
echo
echo "— Zur Einordnung: manuelle Stops je Objekt (legitim, nur Anzeige) —"
psql_exec "select coalesce(p.title,'?') || ': ' || count(*) || ' Tage (' || min(s.date) || ' bis ' || max(s.date) || ')'
           from public.stop_sell s left join public.properties p on p.id = s.property_id
           group by p.title order by p.title" || true
exit 0
