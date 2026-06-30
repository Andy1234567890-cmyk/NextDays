#!/usr/bin/env bash
#
# NextDays — Backup-Installer (idempotent).
# Kopiert Skripte nach /usr/local/bin, systemd-Units nach /etc/systemd/system
# und aktiviert die Timer. Mehrfach ausführbar ohne Schaden.
#
set -euo pipefail
[[ "$(id -u)" -eq 0 ]] || { echo "Bitte als root ausführen (sudo)."; exit 1; }

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Tools prüfen (borg, age)…"
command -v borg >/dev/null || { echo "borg fehlt: apt-get install -y borgbackup"; exit 1; }
command -v age  >/dev/null || { echo "age fehlt:  apt-get install -y age";        exit 1; }

echo "==> Skripte nach /usr/local/bin …"
for s in backup restore-test disk-check; do
  install -m 0750 "${SRC_DIR}/${s}.sh" "/usr/local/bin/nextdays-${s}.sh"
done

echo "==> systemd-Units nach /etc/systemd/system …"
for u in nextdays-backup.service nextdays-backup.timer \
         nextdays-restore-test.service nextdays-restore-test.timer \
         nextdays-disk-check.service nextdays-disk-check.timer; do
  install -m 0644 "${SRC_DIR}/${u}" "/etc/systemd/system/${u}"
done

if [[ ! -f /etc/nextdays-backup.env ]]; then
  echo "!! /etc/nextdays-backup.env fehlt — aus Vorlage anlegen und Werte eintragen:"
  echo "   cp ${SRC_DIR}/nextdays-backup.env.example /etc/nextdays-backup.env && chmod 600 /etc/nextdays-backup.env"
fi

echo "==> Timer aktivieren …"
systemctl daemon-reload
systemctl enable --now nextdays-backup.timer
systemctl enable --now nextdays-restore-test.timer
systemctl enable --now nextdays-disk-check.timer

echo "==> Aktive Timer:"
systemctl list-timers | grep nextdays || true
echo "Fertig. Erst-Backup:  systemctl start nextdays-backup.service"
