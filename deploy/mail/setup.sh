#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Mailcow-Erstinstallation auf einem FRISCHEN Server (reproduzierbar).
# Führt aus, was beim ersten Aufsetzen von mail.mynextdays.dk gemacht wurde.
# Idempotent genug, um erneut zu laufen; bricht bei existierender Config nicht ab.
#
# Voraussetzung: frischer Ubuntu-Server als root, DNS/PTR/Port-25 kommen SEPARAT
# (siehe README.md „Andys manuelle Schritte").
#
# Nutzung:  MAILCOW_HOSTNAME=mail.mynextdays.dk MAILCOW_TZ=Europe/Copenhagen \
#           bash setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

: "${MAILCOW_HOSTNAME:?MAILCOW_HOSTNAME muss gesetzt sein (z.B. mail.mynextdays.dk)}"
: "${MAILCOW_TZ:=Europe/Copenhagen}"

echo "==> 1) Basis-Pakete + jq (von generate_config.sh benötigt)"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git nano jq >/dev/null

echo "==> 2) Docker (offizielles Repo)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
  curl -fsSL "https://download.docker.com/linux/ubuntu/dists/${CODENAME}/Release" >/dev/null 2>&1 \
    || CODENAME=noble  # Fallback auf 24.04 LTS, falls Docker-Repo den Codename (noch) nicht kennt
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
fi
docker --version && docker compose version

echo "==> 3) Swap (Mailcow-Empfehlung)"
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> 4) Hostname"
hostnamectl set-hostname "$MAILCOW_HOSTNAME"
grep -q "$MAILCOW_HOSTNAME" /etc/hosts || echo "127.0.1.1 $MAILCOW_HOSTNAME" >> /etc/hosts

echo "==> 5) Mailcow klonen + config generieren"
cd /opt
[ -d mailcow-dockerized ] || git clone https://github.com/mailcow/mailcow-dockerized
cd mailcow-dockerized
if [ ! -f mailcow.conf ]; then
  MAILCOW_HOSTNAME="$MAILCOW_HOSTNAME" MAILCOW_TZ="$MAILCOW_TZ" SKIP_CLAMD=n SKIP_BRANCH=y \
    ./generate_config.sh
fi

echo "==> 6) Stack starten"
docker compose pull
docker compose up -d

echo ""
echo "==> FERTIG. Web-UI: https://${MAILCOW_HOSTNAME}/  (admin / moohoo → SOFORT ändern)"
echo "    Danach: Domain + DKIM + Postfächer anlegen (siehe README.md/mailboxes.md),"
echo "    DNS setzen (dns-records.md), härten (harden.sh)."
