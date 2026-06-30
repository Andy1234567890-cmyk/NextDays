#!/usr/bin/env bash
#
# NextDays — Disk-Alert (verhindert Wiederholung des 99-%-Vorfalls).
# Warnt, wenn OS-SSD ODER das Daten-Volume > Schwellwert belegt sind.
# Alarm via Ping-URL (z. B. healthchecks/Uptime-Kuma) und/oder Mail.
#
set -euo pipefail

ENV_FILE="${NEXTDAYS_BACKUP_ENV:-/etc/nextdays-backup.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

THRESHOLD="${DISK_ALERT_THRESHOLD:-80}"
ALERT_PING_URL="${DISK_ALERT_PING_URL:-}"
ALERT_MAIL="${DISK_ALERT_MAIL:-}"
# Zu prüfende Mountpoints (Leerzeichen-getrennt).
MOUNTS="${DISK_CHECK_MOUNTS:-/ /mnt/HC_Volume_106086998}"
LOG_FILE="${DISK_LOG_FILE:-/var/log/nextdays-disk-check.log}"

log() { printf '%s [disk-check] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG_FILE" >&2; }

ALERTS=()
for mp in $MOUNTS; do
  [[ -d "$mp" ]] || continue
  use="$(df -P "$mp" | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
  [[ "$use" =~ ^[0-9]+$ ]] || continue
  log "${mp}: ${use}% belegt (Schwelle ${THRESHOLD}%)"
  if [[ "$use" -ge "$THRESHOLD" ]]; then
    ALERTS+=("${mp} bei ${use}% (>= ${THRESHOLD}%)")
  fi
done

if [[ ${#ALERTS[@]} -eq 0 ]]; then
  log "OK — alle Mounts unter Schwelle."
  exit 0
fi

MSG="NextDays Disk-Alert auf $(hostname): ${ALERTS[*]}"
log "ALARM: ${MSG}"

if [[ -n "$ALERT_PING_URL" ]] && command -v curl >/dev/null 2>&1; then
  curl -fsS -m 15 --data-raw "$MSG" "$ALERT_PING_URL" >/dev/null 2>&1 || log "WARN: Alert-Ping fehlgeschlagen."
fi
if [[ -n "$ALERT_MAIL" ]] && command -v mail >/dev/null 2>&1; then
  printf '%s\n' "$MSG" | mail -s "NextDays Disk-Alert" "$ALERT_MAIL" || log "WARN: Alert-Mail fehlgeschlagen."
fi

# Non-zero Exit, damit auch systemd den fehlerhaften Lauf sieht.
exit 1
