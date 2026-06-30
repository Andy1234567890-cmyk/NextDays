#!/usr/bin/env bash
#
# NextDays — Medien-Migration: Supabase-Storage file-Backend → Hetzner Object
# Storage (S3). Infra-Runbook Punkt 3.
#
# ADDITIV & verlustfrei: kopiert die Bestands-Medien vom Daten-Volume in den
# S3-Bucket und VERIFIZIERT per Prüfsumme. Das file-Backend-Verzeichnis bleibt
# unberührt (Fallback), bis der Cutover (STORAGE_BACKEND=s3) verifiziert ist.
#
# Schlüssel-Invariante (verifiziert gegen storage-api v1.60.4 Quellcode):
#   On-Disk:  {FILE_PATH}/{GLOBAL_S3_BUCKET}/{tenantId}/{bucketId}/{name}/{version}
#   S3-Key:                                  {tenantId}/{bucketId}/{name}/{version}
#   => Der Inhalt des Ordners {FILE_PATH}/{GLOBAL_S3_BUCKET}/ wird 1:1 zum
#      Bucket-Root. Der {GLOBAL_S3_BUCKET}-Ordnername (hier "stub") wird NICHT
#      Teil des Keys — er entspricht dem S3-Bucket selbst.
#   tenantId (self-hosted) = "storage-single-tenant" (sofern PROJECT_REF/TENANT_ID
#   leer). Separator vor der Version = "/" (Default, TUS_USE_FILE_VERSION_SEPARATOR
#   ungesetzt). Beides in Stufe 0 am Server bestätigt.
#
# Secrets: ausschließlich aus der Env / einer root-only rclone-Config. Nichts im
# Repo, keine PII in Logs (es werden nur Schlüssel-Pfade, keine Inhalte berührt).
#
# Aufruf (auf dem Server, als root):
#   STORAGE_S3_ENDPOINT=https://fsn1.your-objectstorage.com \
#   STORAGE_S3_BUCKET=nextdays-media STORAGE_S3_REGION=fsn1 \
#   AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… \
#   bash migrate-storage-to-s3.sh [--apply]
#
# Ohne --apply: Trockenlauf (rclone --dry-run + check), zeigt nur, was kopiert würde.
# Mit  --apply: kopiert real und verifiziert per Prüfsumme.
#
set -euo pipefail

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

# --- Konfiguration ----------------------------------------------------------
SRC_ROOT="${STORAGE_SRC_ROOT:-/mnt/HC_Volume_106086998/nextdays/storage}"
INTERNAL_BUCKET="${GLOBAL_S3_BUCKET_DIR:-stub}"   # Ordnername unter SRC_ROOT
SRC_DIR="${SRC_ROOT}/${INTERNAL_BUCKET}"          # dessen Inhalt = Bucket-Root

: "${STORAGE_S3_ENDPOINT:?STORAGE_S3_ENDPOINT fehlt (z. B. https://fsn1.your-objectstorage.com)}"
: "${STORAGE_S3_BUCKET:?STORAGE_S3_BUCKET fehlt (Ziel-Bucketname im Hetzner-Konto)}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID fehlt}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY fehlt}"
S3_REGION="${STORAGE_S3_REGION:-fsn1}"

log() { printf '%s [migrate-s3] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; }
die() { log "FEHLER: $*"; exit 1; }

command -v rclone >/dev/null || die "rclone fehlt (apt-get install -y rclone)."
[[ -d "$SRC_DIR" ]] || die "Quelle ${SRC_DIR} existiert nicht."

# --- rclone-Remote rein über Env (keine persistente Config nötig) -----------
# Hetzner = S3-kompatibel (provider Other). Checksummen-Vergleich via rclone check.
export RCLONE_CONFIG_HET_TYPE=s3
export RCLONE_CONFIG_HET_PROVIDER=Other
export RCLONE_CONFIG_HET_ENV_AUTH=false
export RCLONE_CONFIG_HET_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
export RCLONE_CONFIG_HET_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_HET_ENDPOINT="$STORAGE_S3_ENDPOINT"
export RCLONE_CONFIG_HET_REGION="$S3_REGION"
[[ "${STORAGE_S3_FORCE_PATH_STYLE:-}" == "true" ]] && export RCLONE_CONFIG_HET_FORCE_PATH_STYLE=true

DEST="HET:${STORAGE_S3_BUCKET}"

N_SRC="$(find "$SRC_DIR" -type f | wc -l | tr -d ' ')"
log "Quelle: ${SRC_DIR} (${N_SRC} Dateien)"
log "Ziel:   ${DEST} (Endpoint ${STORAGE_S3_ENDPOINT})"
log "Modus:  $([[ $APPLY -eq 1 ]] && echo 'APPLY (real)' || echo 'DRY-RUN')"

# --- Kopie ------------------------------------------------------------------
if [[ $APPLY -eq 0 ]]; then
  log "Trockenlauf: rclone copy --dry-run …"
  rclone copy --dry-run --checksum -v "$SRC_DIR" "$DEST" 2>&1 | sed 's/^/  /' >&2
  log "Trockenlauf fertig. Mit --apply real ausführen."
  exit 0
fi

log "Kopiere (checksum-basiert) …"
rclone copy --checksum --transfers 8 -v "$SRC_DIR" "$DEST" 2>&1 | sed 's/^/  /' >&2

# --- Prüfsummen-Verifikation Quelle ↔ Ziel ----------------------------------
log "Verifiziere Prüfsummen (rclone check) …"
if ! rclone check --checksum "$SRC_DIR" "$DEST" 2>&1 | sed 's/^/  /' >&2; then
  die "Prüfsummen-Verifikation FEHLGESCHLAGEN — Cutover NICHT durchführen."
fi

N_DST="$(rclone size --json "$DEST" 2>/dev/null | grep -oE '"count":[0-9]+' | grep -oE '[0-9]+' || echo '?')"
log "OK — ${N_SRC} Quelldateien, ${N_DST} Objekte im Bucket, Prüfsummen identisch."
log "Bestands-Medien sind im Bucket. Nächster Schritt: Cutover STORAGE_BACKEND=s3"
log "(siehe deploy/storage/README.md), file-Verzeichnis erst nach Verifikation entfernen."
