#!/usr/bin/env bash
#
# NextDays — täglicher Off-site-Backup-Lauf (Hetzner Storage Box via BorgBackup).
#
# Sichert:
#   1. Logischer pg_dump (-Fc) beider DBs (`postgres`, `_supabase`) aus dem
#      laufenden Supabase-Postgres-Container — REINES LESEN, kein Schreiben in Prod.
#   2. Das Supabase-Storage-Verzeichnis (Gäste-Fotos/Belege = PII).
#
# Pipeline pro Lauf:
#   pg_dump -Fc  →  pg_restore --list (Integritätscheck)  →  age-Verschlüsselung
#   →  Borg-Push (DB-Dumps + Storage)  →  GFS-Prune (7d/4w/6m)  →  Dead-man-Ping.
#
# Harte Regeln:
#   * Prod-DB + Bind-Mount-Datenverzeichnisse werden NUR gelesen.
#   * Keine Secrets im Code/Log. Werte kommen aus /etc/nextdays-backup.env (chmod 600)
#     bzw. aus der Container-Env (PGPASSWORD via `docker exec ... env`).
#   * Idempotent, klare Exit-Codes, Logging ohne Secrets nach /var/log/nextdays-backup.log.
#
set -euo pipefail

# --- Konfiguration laden (root-only Datei, NICHT im Repo) --------------------
ENV_FILE="${NEXTDAYS_BACKUP_ENV:-/etc/nextdays-backup.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

# Pflicht-Variablen (Borg). AGE_RECIPIENT verschlüsselt die DB-Dumps zusätzlich
# vor dem Push (Defense-in-Depth: Borg verschlüsselt das Repo, age den Dump-Inhalt).
: "${BORG_REPO:?BORG_REPO nicht gesetzt (z. B. ssh://uXXXXXX@uXXXXXX.your-storagebox.de:23/./nextdays-borg)}"
: "${BORG_PASSPHRASE:?BORG_PASSPHRASE nicht gesetzt}"
export BORG_REPO BORG_PASSPHRASE
# Storage Box: nicht-interaktiv, kein TTY-Prompt.
export BORG_RSH="${BORG_RSH:-ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new}"
export BORG_RELOCATED_REPO_ACCESS_IS_OK="${BORG_RELOCATED_REPO_ACCESS_IS_OK:-no}"

POSTGRES_IMAGE="${POSTGRES_IMAGE:-supabase/postgres:15.14.1.138}"
PG_USER="${PG_USER:-supabase_admin}"
STORAGE_DIR="${STORAGE_DIR:-/mnt/HC_Volume_106086998/nextdays/storage}"
# Wenn die Medien in Hetzner Object Storage liegen (STORAGE_BACKEND=s3), wird das
# Bucket statt des lokalen Verzeichnisses gesichert (zweite Kopie/Versionierung).
# Voraussetzung: STORAGE_S3_ENDPOINT + STORAGE_S3_BUCKET + AWS_*-Keys gesetzt.
STORAGE_S3_ENDPOINT="${STORAGE_S3_ENDPOINT:-}"
STORAGE_S3_BUCKET="${STORAGE_S3_BUCKET:-}"
STORAGE_S3_REGION="${STORAGE_S3_REGION:-fsn1}"
DATABASES="${DATABASES:-postgres _supabase}"
# Coolify-Konfiguration mitsichern (Config + Secrets für Disaster-Recovery, Punkt
# 4+7). Coolify verschlüsselt seine Dumps NICHT selbst → wir nehmen sie hier in den
# age-verschlüsselten, off-site Borg-Lauf mit auf. ENTSCHEIDEND: der APP_KEY aus
# /data/coolify/source/.env entschlüsselt die in der Coolify-DB abgelegten App-
# Secrets — ohne ihn ist der DB-Dump wertlos. Daher DB-Dump + source/.env + ssh/keys
# IMMER zusammen in EIN verschlüsseltes Archiv (siehe deploy/RECOVERY.md).
BACKUP_COOLIFY="${BACKUP_COOLIFY:-true}"
COOLIFY_DB_CONTAINER="${COOLIFY_DB_CONTAINER:-coolify-db}"
COOLIFY_DB_USER="${COOLIFY_DB_USER:-coolify}"
COOLIFY_DB_NAME="${COOLIFY_DB_NAME:-coolify}"
COOLIFY_DATA_DIR="${COOLIFY_DATA_DIR:-/data/coolify}"
RETENTION_DAILY="${RETENTION_DAILY:-7}"
RETENTION_WEEKLY="${RETENTION_WEEKLY:-4}"
RETENTION_MONTHLY="${RETENTION_MONTHLY:-6}"
PING_URL="${BACKUP_PING_URL:-}"
LOG_FILE="${BACKUP_LOG_FILE:-/var/log/nextdays-backup.log}"

# --- Logging (ohne Secrets) -------------------------------------------------
log() { printf '%s [backup] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG_FILE" >&2; }
die() { log "FEHLER: $*"; exit 1; }

WORK_DIR="$(mktemp -d /tmp/nextdays-backup.XXXXXX)"
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

log "Lauf gestartet (Repo=${BORG_REPO%%:*}:…)"   # Host zeigen, Pfad/Secret nicht

# --- DB-Container dynamisch auflösen (Coolify-Hash-Name ist nicht stabil) ----
DB_CONTAINER="$(docker ps --filter "ancestor=${POSTGRES_IMAGE}" --format '{{.Names}}' | head -1)"
[[ -n "$DB_CONTAINER" ]] || die "Kein laufender Container für Image ${POSTGRES_IMAGE} gefunden."
log "DB-Container: ${DB_CONTAINER}"

# PGPASSWORD aus der Container-Env ziehen (nie als CLI-Argument, nie geloggt).
PGPASSWORD_VAL="$(docker exec "$DB_CONTAINER" sh -c 'printf %s "$POSTGRES_PASSWORD"')"
[[ -n "$PGPASSWORD_VAL" ]] || die "POSTGRES_PASSWORD in Container-Env leer."

# --- 1) Dumps erzeugen + Integritätscheck + optional age ---------------------
DUMP_FILES=()
for db in $DATABASES; do
  out="${WORK_DIR}/${db}.dump"
  log "pg_dump ${db} …"
  # -Fc = Custom-Format (selektiver Restore). PGPASSWORD via Container-Env an docker exec.
  if ! docker exec -e PGPASSWORD="$PGPASSWORD_VAL" "$DB_CONTAINER" \
        pg_dump -U "$PG_USER" -d "$db" -Fc > "$out" 2>"${WORK_DIR}/${db}.err"; then
    log "pg_dump-stderr: $(tr -d '\r' < "${WORK_DIR}/${db}.err" | head -5)"
    die "pg_dump ${db} fehlgeschlagen."
  fi
  [[ -s "$out" ]] || die "Dump ${db} ist leer."

  # Integritätscheck: pg_restore --list muss fehlerfrei sein.
  if ! docker exec -i "$DB_CONTAINER" pg_restore --list < "$out" >/dev/null 2>"${WORK_DIR}/${db}.lst.err"; then
    log "pg_restore --list-stderr: $(head -3 "${WORK_DIR}/${db}.lst.err")"
    die "Integritätscheck (pg_restore --list) für ${db} fehlgeschlagen."
  fi
  log "  ${db}: $(du -h "$out" | cut -f1), Integrität OK"

  # Defense-in-Depth: DB-Dump zusätzlich mit age verschlüsseln, falls Empfänger gesetzt.
  if [[ -n "${AGE_RECIPIENT:-}" ]]; then
    age -r "$AGE_RECIPIENT" -o "${out}.age" "$out"
    rm -f "$out"
    out="${out}.age"
    log "  ${db}: age-verschlüsselt"
  fi
  DUMP_FILES+=("$out")
done

# --- 1b) Coolify-Konfiguration (DB-Dump + APP_KEY + SSH-Keys) ----------------
# In EIN Tar bündeln, dann age-verschlüsseln. Das Tar enthält die Secrets-
# entschlüsselnde source/.env (APP_KEY) zusammen mit dem DB-Dump → niemals
# unverschlüsselt ablegen, niemals ins Repo.
if [[ "$BACKUP_COOLIFY" == "true" ]] && docker ps --format '{{.Names}}' | grep -qx "$COOLIFY_DB_CONTAINER"; then
  cool_tar="${WORK_DIR}/coolify-config.tar"
  cool_dump="${WORK_DIR}/coolify-db.dump"
  log "pg_dump Coolify-DB (${COOLIFY_DB_NAME}) …"
  if ! docker exec "$COOLIFY_DB_CONTAINER" \
        pg_dump --format=custom --no-acl --no-owner -U "$COOLIFY_DB_USER" "$COOLIFY_DB_NAME" \
        > "$cool_dump" 2>"${WORK_DIR}/coolify.err"; then
    log "coolify pg_dump-stderr: $(head -3 "${WORK_DIR}/coolify.err")"
    die "Coolify-DB-Dump fehlgeschlagen."
  fi
  [[ -s "$cool_dump" ]] || die "Coolify-DB-Dump ist leer."
  # DB-Dump + die für die Entschlüsselung nötigen Coolify-Dateien zusammen tarren.
  # source/.env (APP_KEY) + ssh/keys/ (Server-Zugang) sind ohne den Dump nutzlos
  # und umgekehrt — daher gemeinsam in EIN Archiv.
  tar -cf "$cool_tar" -C "$WORK_DIR" "coolify-db.dump" \
      $( [[ -f "${COOLIFY_DATA_DIR}/source/.env" ]] && echo "-C ${COOLIFY_DATA_DIR} source/.env" ) \
      $( [[ -d "${COOLIFY_DATA_DIR}/ssh/keys" ]] && echo "-C ${COOLIFY_DATA_DIR} ssh/keys" ) \
      2>"${WORK_DIR}/tar.err" || die "Coolify-Tar fehlgeschlagen: $(head -2 "${WORK_DIR}/tar.err")"
  rm -f "$cool_dump"
  if [[ -n "${AGE_RECIPIENT:-}" ]]; then
    age -r "$AGE_RECIPIENT" -o "${cool_tar}.age" "$cool_tar"
    rm -f "$cool_tar"
    cool_tar="${cool_tar}.age"
    log "  Coolify-Config: age-verschlüsselt ($(du -h "$cool_tar" | cut -f1))"
  else
    log "  WARN: Coolify-Config OHNE age (AGE_RECIPIENT fehlt) — enthält Secrets!"
  fi
  DUMP_FILES+=("$cool_tar")
elif [[ "$BACKUP_COOLIFY" == "true" ]]; then
  log "WARN: Coolify-DB-Container '${COOLIFY_DB_CONTAINER}' nicht gefunden — Coolify-Config übersprungen."
fi

# --- 2) Medien einsammeln: S3-Bucket (bevorzugt) oder lokales Verzeichnis ----
# Nach dem S3-Cutover ist das lokale STORAGE_DIR veraltet/leer → dann das Bucket
# in ein temporäres Verzeichnis spiegeln und DIESES sichern (sonst Backup-Lücke).
ARCHIVE="nextdays-$(date -u '+%Y-%m-%dT%H-%M-%SZ')"
STORAGE_ARG=()
if [[ -n "$STORAGE_S3_ENDPOINT" && -n "$STORAGE_S3_BUCKET" && -n "${AWS_ACCESS_KEY_ID:-}" ]]; then
  if ! command -v rclone >/dev/null 2>&1; then
    die "STORAGE_S3_* gesetzt, aber rclone fehlt (apt-get install -y rclone)."
  fi
  S3_MIRROR="${WORK_DIR}/s3-media"
  mkdir -p "$S3_MIRROR"
  log "Spiegele S3-Bucket ${STORAGE_S3_BUCKET} für Backup …"
  export RCLONE_CONFIG_BK_TYPE=s3 RCLONE_CONFIG_BK_PROVIDER=Other
  export RCLONE_CONFIG_BK_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
  export RCLONE_CONFIG_BK_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
  export RCLONE_CONFIG_BK_ENDPOINT="$STORAGE_S3_ENDPOINT"
  export RCLONE_CONFIG_BK_REGION="$STORAGE_S3_REGION"
  [[ "${STORAGE_S3_FORCE_PATH_STYLE:-}" == "true" ]] && export RCLONE_CONFIG_BK_FORCE_PATH_STYLE=true
  rclone copy --checksum "BK:${STORAGE_S3_BUCKET}" "$S3_MIRROR" 2>&1 | tee -a "$LOG_FILE" \
    || die "S3-Spiegelung für Backup fehlgeschlagen."
  STORAGE_ARG=("$S3_MIRROR")
  log "S3-Medien gespiegelt: $(find "$S3_MIRROR" -type f | wc -l | tr -d ' ') Objekte."
elif [[ -d "$STORAGE_DIR" ]]; then
  STORAGE_ARG=("$STORAGE_DIR")
else
  log "WARN: weder S3-Bucket noch STORAGE_DIR ${STORAGE_DIR} vorhanden — Storage wird ausgelassen."
fi

log "Borg create ${ARCHIVE} …"
borg create \
  --compression zstd,6 \
  --stats \
  "::${ARCHIVE}" \
  "${DUMP_FILES[@]}" \
  "${STORAGE_ARG[@]}" 2>&1 | tee -a "$LOG_FILE" \
  || die "borg create fehlgeschlagen."

# --- 3) GFS-Retention -------------------------------------------------------
log "Borg prune (${RETENTION_DAILY}d/${RETENTION_WEEKLY}w/${RETENTION_MONTHLY}m) …"
borg prune \
  --glob-archives 'nextdays-*' \
  --keep-daily "$RETENTION_DAILY" \
  --keep-weekly "$RETENTION_WEEKLY" \
  --keep-monthly "$RETENTION_MONTHLY" \
  --stats 2>&1 | tee -a "$LOG_FILE" \
  || die "borg prune fehlgeschlagen."

# borg compact gibt belegten Speicher auf der Storage Box frei (Borg ≥1.2).
borg compact 2>&1 | tee -a "$LOG_FILE" || log "WARN: borg compact fehlgeschlagen (nicht fatal)."

# --- 4) Dead-man-Ping NUR bei Erfolg ----------------------------------------
# Fehlt der Ping (weil oben ein `die` griff), schlägt das externe Monitoring Alarm.
if [[ -n "$PING_URL" ]]; then
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -m 15 "$PING_URL" >/dev/null 2>&1 && log "Erfolgs-Ping gesendet." \
      || log "WARN: Erfolgs-Ping fehlgeschlagen."
  else
    log "WARN: curl fehlt — kein Erfolgs-Ping."
  fi
fi

log "Lauf erfolgreich abgeschlossen (Archiv ${ARCHIVE})."
