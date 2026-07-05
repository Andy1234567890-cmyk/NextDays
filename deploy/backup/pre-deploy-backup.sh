#!/usr/bin/env bash
# pre-deploy-backup.sh — Sofort-Dump der Produktions-DB UNMITTELBAR vor einem
# riskanten Deploy (v. a. jedem Deploy des DB-Stacks nextdays-supabase).
#
# WARUM: Das nächtliche Borg-Backup (deploy/backup/backup.sh) lässt bis zu 24 h
# Lücke. Bei einem Deploy-Zwischenfall (z. B. Container-Race → Doppel-Postgres →
# WAL-Korruption, einmal passiert am 2026-07-05) braucht es einen Wiederher-
# stellungspunkt VOM MOMENT VOR dem Deploy. Dieses Skript erzeugt ihn.
#
# AUSFÜHRUNG (vom Repo-Root oder direkt auf dem Server als root):
#   bash deploy/backup/pre-deploy-backup.sh            # lokal via SSH zum Server
#   MIGRATE_SSH=root@1.2.3.4 bash .../pre-deploy-backup.sh
#
# Der DB-Containername ändert sich bei jedem Coolify-Deploy → dynamisch per Prefix.
set -euo pipefail

SERVER="${MIGRATE_SSH:-root@65.21.144.136}"
DB_PREFIX="${MIGRATE_DB_PREFIX:-db-cdqxi}"
DB_USER="${MIGRATE_DB_USER:-postgres}"
DB_NAME="${MIGRATE_DB_NAME:-postgres}"
# Ablage auf dem Hetzner-Volume (überlebt Container-Neustarts), NICHT /tmp.
DEST_DIR="${PREDEPLOY_DEST:-/mnt/HC_Volume_106086998/nextdays/predeploy-backups}"
KEEP="${PREDEPLOY_KEEP:-20}"   # wie viele Pre-Deploy-Dumps behalten

# shellcheck disable=SC2029  # Variablen bewusst client-seitig expandieren
ssh -o ConnectTimeout=15 "$SERVER" bash -s <<REMOTE
set -euo pipefail
DB=\$(docker ps --format '{{.Names}}' | grep "^${DB_PREFIX}" | head -1)
[ -z "\$DB" ] && { echo "FEHLER: kein DB-Container (${DB_PREFIX}*) gefunden"; exit 1; }
mkdir -p "${DEST_DIR}"
TS=\$(date +%Y%m%d-%H%M%S)
OUT="${DEST_DIR}/predeploy-\${TS}.dump"
echo "→ pg_dump aus \$DB nach \$OUT"
docker exec "\$DB" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --format=custom > "\$OUT"
SIZE=\$(du -h "\$OUT" | cut -f1)
if [ ! -s "\$OUT" ]; then echo "FEHLER: Dump ist leer"; rm -f "\$OUT"; exit 1; fi
echo "✓ Pre-Deploy-Backup: \$OUT (\$SIZE)"
# Alte Dumps aufräumen (nur die letzten ${KEEP} behalten).
ls -1t "${DEST_DIR}"/predeploy-*.dump 2>/dev/null | tail -n +\$(( ${KEEP} + 1 )) | xargs -r rm -f
echo "  (behalte die letzten ${KEEP} Dumps)"
REMOTE
