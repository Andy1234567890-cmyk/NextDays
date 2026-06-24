#!/usr/bin/env bash
# apply-migrations.sh — wendet alle supabase/migrations/*.sql idempotent auf die
# Server-DB an (in Dateinamen-Reihenfolge) und trackt sie in public.schema_migrations.
#
# HINTERGRUND: Es gibt KEINEN automatischen Migrations-Runner (deploy.yml deployt
# nur Container, das Supabase-Image-Init läuft nur beim allerersten Start). App-
# Migrationen müssen aktiv eingespielt werden — dieses Skript ist der eine Ort
# dafür. Schon angewendete Migrationen werden übersprungen (schema_migrations),
# darum kann man es gefahrlos jederzeit erneut laufen lassen.
#
# AUSFÜHRUNG (vom Repo-Root, braucht SSH-Zugang zum Server):
#   bash supabase/apply-migrations.sh            # neue Migrationen anwenden
#   bash supabase/apply-migrations.sh --baseline # vorhandene NUR als angewendet
#                                                # markieren (SQL NICHT ausführen)
#
# --baseline ist EINMALIG nötig, wenn das Tracking nachträglich auf eine schon
# bestehende DB eingeführt wird: die bereits eingespielten Migrationen werden in
# schema_migrations eingetragen, ohne ihr SQL erneut zu fahren (manche frühen
# Migrationen sind nicht idempotent, z. B. `create type` ohne if-not-exists).
# Danach läuft der Normalmodus nur noch über echte neue Migrationen.
#
# Der DB-Containername ändert sich bei jedem Coolify-Deploy (Suffix), darum wird
# er dynamisch per Prefix ermittelt — nie hartkodieren.
set -euo pipefail

MODE="apply"
if [ "${1:-}" = "--baseline" ]; then
  MODE="baseline"
fi

SERVER="${MIGRATE_SSH:-root@65.21.144.136}"
DB_PREFIX="${MIGRATE_DB_PREFIX:-db-cdqxi}"
DB_USER="${MIGRATE_DB_USER:-supabase_admin}"
DB_NAME="${MIGRATE_DB_NAME:-postgres}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

# psql im DB-Container; SQL kommt IMMER über stdin (psql -f -), nie über -c, damit
# keine Klammern/Quotes durch die Shell-Schichten zerbrechen. Das Remote-Kommando
# ist fest single-gequotet; der Container wird zur Laufzeit per Prefix gesucht.
REMOTE_CMD='docker exec -i $(docker ps --format "{{.Names}}" | grep -E "^'"$DB_PREFIX"'" | head -1) psql -U "'"$DB_USER"'" -d "'"$DB_NAME"'" -v ON_ERROR_STOP=1 -q -f -'

# stdin (SQL) → ssh → docker exec → psql -f -
psql_stdin() {
  ssh -o ConnectTimeout=15 "$SERVER" "$REMOTE_CMD"
}

# Wie psql_stdin, aber Ausgabe unformatiert/tuples-only (für SELECTs).
REMOTE_CMD_TA='docker exec -i $(docker ps --format "{{.Names}}" | grep -E "^'"$DB_PREFIX"'" | head -1) psql -U "'"$DB_USER"'" -d "'"$DB_NAME"'" -tAq -f -'
psql_query() {
  ssh -o ConnectTimeout=15 "$SERVER" "$REMOTE_CMD_TA"
}

echo "→ Stelle public.schema_migrations sicher"
printf '%s\n' \
  "create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now());" \
  | psql_stdin

echo "→ Bereits angewendete Migrationen einlesen"
APPLIED="$(printf '%s\n' "select version from public.schema_migrations;" | psql_query | tr -d '\r')"

applied_count=0
skipped_count=0
for file in "$MIGRATIONS_DIR"/*.sql; do
  version="$(basename "$file" .sql)"
  if printf '%s\n' "$APPLIED" | grep -qx "$version"; then
    skipped_count=$((skipped_count + 1))
    continue
  fi
  if [ "$MODE" = "baseline" ]; then
    # Nur als angewendet markieren — SQL NICHT ausführen (DB ist bereits darauf).
    echo "→ Baseline: $version"
    printf "insert into public.schema_migrations (version) values ('%s') on conflict do nothing;\n" "$version" \
      | psql_stdin
  else
    echo "→ Wende an: $version"
    # Migration + Tracking-Eintrag in EINER Transaktion (ON_ERROR_STOP bricht ab,
    # bevor der Eintrag gesetzt wird → kein "angewendet"-Flag bei Fehler).
    {
      echo "begin;"
      cat "$file"
      echo ""
      echo "insert into public.schema_migrations (version) values ('$version');"
      echo "commit;"
    } | psql_stdin
  fi
  applied_count=$((applied_count + 1))
done

if [ "$MODE" = "baseline" ]; then
  echo "✓ Baseline fertig — $applied_count markiert, $skipped_count bereits vorhanden."
else
  echo "✓ Fertig — $applied_count neu angewendet, $skipped_count bereits vorhanden."
fi
