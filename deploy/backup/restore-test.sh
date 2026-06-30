#!/usr/bin/env bash
#
# NextDays — getesteter Restore (Disaster-Recovery-Probe).
#
# Holt das JÜNGSTE Off-site-Backup, spielt den `postgres`-Dump in einen
# WEGWERF-Container (eigenes Netz, eigenes tmp-Volume, KEIN Bezug zu Prod) und
# prüft die Kern-Tabellen auf Plausibilität. Räumt danach restlos auf.
#
# Harte Regel: schreibt NIE in die Prod-Instanz. Der Restore landet
# ausschließlich im Wegwerf-Container `nextdays-restore-test`.
#
# Empfehlung: monatlich per Timer laufen lassen (nextdays-restore-test.timer).
#
set -euo pipefail

ENV_FILE="${NEXTDAYS_BACKUP_ENV:-/etc/nextdays-backup.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

: "${BORG_REPO:?BORG_REPO nicht gesetzt}"
: "${BORG_PASSPHRASE:?BORG_PASSPHRASE nicht gesetzt}"
export BORG_REPO BORG_PASSPHRASE
export BORG_RSH="${BORG_RSH:-ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new}"

# Wegwerf-Ziel: schlankes Standard-postgres (gleiche MAJOR-Version 15), NICHT das
# supabase/postgres-Image. Letzteres initialisiert beim Start eigene Supabase-
# Schemas/Rollen/Extensions, die mit dem Dump kollidieren und den Datenimport
# abbrechen lassen. Ein leeres postgres:15 nimmt den Dump mit `--no-owner
# --no-privileges` sauber auf (fehlende Supabase-Rollen werden ignoriert) — für
# einen reinen Wiederherstellbarkeits-NACHWEIS ist das die robuste Wahl.
DUMP_DB="${RESTORE_DUMP_DB:-postgres}"          # welche gedumpte DB getestet wird
RESTORE_IMAGE="${RESTORE_IMAGE:-postgres:15-alpine}"
TEST_PG_USER="postgres"
TEST_DB="probe"
RESTORE_CONTAINER="${RESTORE_CONTAINER:-nextdays-restore-test}"
TEST_PG_PASSWORD="restore-test-only"            # nur für die Wegwerf-Instanz
LOG_FILE="${RESTORE_LOG_FILE:-/var/log/nextdays-restore-test.log}"

# Erwartete Mindest-Größenordnung (Plausibilität gegen Prod). Bei Bedarf via Env
# anheben, wenn der Datenbestand wächst. 0 = nur „Tabelle existiert + Query läuft".
MIN_RESERVATIONS="${MIN_RESERVATIONS:-1}"
MIN_PROPERTIES="${MIN_PROPERTIES:-1}"
MIN_TENANTS="${MIN_TENANTS:-1}"

log() { printf '%s [restore-test] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG_FILE" >&2; }
die() { log "FEHLER: $*"; exit 1; }

WORK_DIR="$(mktemp -d /tmp/nextdays-restore.XXXXXX)"
cleanup() {
  docker rm -f "$RESTORE_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

# Falls eine frühere Probe abgebrochen ist: alten Wegwerf-Container entfernen.
docker rm -f "$RESTORE_CONTAINER" >/dev/null 2>&1 || true

# --- 1) Jüngstes Archiv ermitteln + extrahieren ------------------------------
LATEST="$(borg list --glob-archives 'nextdays-*' --last 1 --format '{archive}{NL}' 2>>"$LOG_FILE" | tail -1)"
[[ -n "$LATEST" ]] || die "Kein Archiv 'nextdays-*' im Repo gefunden."
log "Jüngstes Archiv: ${LATEST}"

# DB-Dumps extrahieren. Borg interpretiert das Positional-Argument als Pfad-PRÄFIX
# (kein Shell-Glob), der mktemp-Suffix ist unbekannt → das `tmp/`-Präfix extrahieren
# (klein: nur die Dumps) und den passenden Dump per `find` lokalisieren.
( cd "$WORK_DIR" && borg extract "::${LATEST}" tmp 2>>"$LOG_FILE" ) || true
DUMP_PATH="$(find "$WORK_DIR/tmp" -name "${DUMP_DB}.dump*" 2>/dev/null | head -1)"
[[ -n "$DUMP_PATH" ]] || die "Dump ${DUMP_DB}.dump im Archiv nicht gefunden."

# age-entschlüsseln, falls verschlüsselt abgelegt.
if [[ "$DUMP_PATH" == *.age ]]; then
  [[ -n "${AGE_IDENTITY_FILE:-}" ]] || die "Dump ist age-verschlüsselt, aber AGE_IDENTITY_FILE nicht gesetzt."
  DEC="${DUMP_PATH%.age}"
  age -d -i "$AGE_IDENTITY_FILE" -o "$DEC" "$DUMP_PATH"
  DUMP_PATH="$DEC"
fi
log "Dump extrahiert: $(du -h "$DUMP_PATH" | cut -f1)"

# --- 2) Wegwerf-Postgres starten (schlankes postgres:15, isoliert) -----------
log "Starte Wegwerf-Container ${RESTORE_CONTAINER} (${RESTORE_IMAGE}) …"
docker run -d --name "$RESTORE_CONTAINER" \
  --network none \
  -e POSTGRES_PASSWORD="$TEST_PG_PASSWORD" \
  -e POSTGRES_USER="$TEST_PG_USER" \
  -e POSTGRES_DB="$TEST_DB" \
  --tmpfs /var/lib/postgresql/data \
  "$RESTORE_IMAGE" >/dev/null \
  || die "Wegwerf-Container ließ sich nicht starten."

# Auf DB-Bereitschaft warten (max. 60 s).
for i in $(seq 1 60); do
  if docker exec "$RESTORE_CONTAINER" pg_isready -U "$TEST_PG_USER" -d "$TEST_DB" >/dev/null 2>&1; then
    break
  fi
  [[ "$i" -eq 60 ]] && die "Wegwerf-Postgres wurde nicht bereit."
  sleep 1
done
log "Wegwerf-Postgres bereit."

# --- 3) Restore + Sanity-Checks ---------------------------------------------
log "pg_restore in Wegwerf-Instanz …"
# --no-owner/--no-privileges: der Dump referenziert Supabase-Rollen, die in der
# schlanken Wegwerf-DB nicht existieren; diese ALTER-OWNER/GRANT-Statements werden
# übersprungen (erwartbare, nicht-fatale Fehlerzeilen). Die TABLE-DATA werden
# importiert — das ist der Wiederherstellbarkeits-Nachweis. KEIN --clean nötig
# (leere DB). Entscheidend ist der Daten-Sanity-Check unten, nicht der Exit-Code.
docker exec -i -e PGPASSWORD="$TEST_PG_PASSWORD" "$RESTORE_CONTAINER" \
  pg_restore --no-owner --no-privileges --no-comments \
  -U "$TEST_PG_USER" -d "$TEST_DB" < "$DUMP_PATH" 2>"${WORK_DIR}/restore.err" || true
if grep -qiE 'error:.*(corrupt|could not read|unexpected end of file|invalid)' "${WORK_DIR}/restore.err"; then
  log "restore-stderr: $(grep -iE 'error' "${WORK_DIR}/restore.err" | head -5)"
  die "pg_restore meldete fatale Fehler (beschädigter Dump?)."
fi

check_count() {
  local table="$1" min="$2" cnt
  cnt="$(docker exec -e PGPASSWORD="$TEST_PG_PASSWORD" "$RESTORE_CONTAINER" \
        psql -U "$TEST_PG_USER" -d "$TEST_DB" -tAc "SELECT count(*) FROM ${table};" 2>/dev/null | tr -d '[:space:]')"
  [[ "$cnt" =~ ^[0-9]+$ ]] || die "Tabelle ${table}: Query lieferte kein Ergebnis (Restore unvollständig?)."
  log "  ${table}: ${cnt} Zeilen (min ${min})"
  [[ "$cnt" -ge "$min" ]] || die "Tabelle ${table}: ${cnt} < erwartetes Minimum ${min}."
}

log "Sanity-Checks gegen Kern-Tabellen …"
check_count "reservations" "$MIN_RESERVATIONS"
check_count "properties"   "$MIN_PROPERTIES"
check_count "tenants"      "$MIN_TENANTS"
# payments existiert, kann aber legitim 0 sein → nur Existenz/Query-Erfolg prüfen.
check_count "payments"     0

log "RESTORE-TEST GRÜN — Archiv ${LATEST} ist wiederherstellbar."
