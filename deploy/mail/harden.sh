#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Mailserver-Härtung (mail.mynextdays.dk). Idempotent — kann jederzeit erneut
# laufen. Siehe deploy/mail/SECURITY.md.
#
# Setzt: UFW-Firewall (nur nötige Mail-Ports + SSH), fail2ban (SSH-Brute-Force),
# SSH-Härtung (kein Passwort-Login), unattended-upgrades (Security-Patches).
#
# SICHERHEIT: Schaltet Passwort-Login NUR ab, wenn ein SSH-Key hinterlegt ist —
# sonst würde man sich aussperren.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "==> 1) Pakete: ufw, fail2ban, unattended-upgrades"
apt-get update -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades >/dev/null

echo "==> 2) UFW-Regeln (default deny incoming, allow outgoing)"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
# SSH zuerst (nicht aussperren!)
ufw allow 22/tcp    comment 'SSH' >/dev/null
# Mail-Ports (Mailcow)
ufw allow 25/tcp    comment 'SMTP (MX-Empfang)' >/dev/null
ufw allow 80/tcp    comment 'HTTP (ACME/Redirect)' >/dev/null
ufw allow 443/tcp   comment 'HTTPS (Web-UI)' >/dev/null
ufw allow 465/tcp   comment 'SMTPS (Submission)' >/dev/null
ufw allow 587/tcp   comment 'Submission STARTTLS (App-Versand)' >/dev/null
ufw allow 143/tcp   comment 'IMAP STARTTLS' >/dev/null
ufw allow 993/tcp   comment 'IMAPS' >/dev/null
ufw allow 110/tcp   comment 'POP3' >/dev/null
ufw allow 995/tcp   comment 'POP3S' >/dev/null
ufw allow 4190/tcp  comment 'ManageSieve' >/dev/null
ufw --force enable >/dev/null
echo "    UFW aktiv."

echo "==> 3) SSH-Härtung (nur mit vorhandenem Key)"
if [ -s /root/.ssh/authorized_keys ]; then
  SSHD=/etc/ssh/sshd_config
  set_sshd() {  # key value
    if grep -qE "^\s*#?\s*$1\b" "$SSHD"; then
      sed -i -E "s|^\s*#?\s*$1\b.*|$1 $2|" "$SSHD"
    else
      echo "$1 $2" >> "$SSHD"
    fi
  }
  set_sshd PasswordAuthentication no
  set_sshd PermitRootLogin prohibit-password
  set_sshd ChallengeResponseAuthentication no
  set_sshd PubkeyAuthentication yes
  if sshd -t 2>/dev/null; then
    systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true
    echo "    SSH gehärtet (Passwort-Login aus)."
  else
    echo "    WARN: sshd-Config-Test fehlgeschlagen — KEINE Änderung übernommen."
  fi
else
  echo "    ÜBERSPRUNGEN: kein authorized_keys → Passwort-Login bleibt an (kein Aussperren)."
fi

echo "==> 4) fail2ban (SSH)"
cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled  = true
port     = 22
maxretry = 5
bantime  = 3600
findtime = 600
EOF
systemctl enable fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban
echo "    fail2ban aktiv."

echo "==> 5) unattended-upgrades (nur Security)"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable unattended-upgrades >/dev/null 2>&1 || true
systemctl restart unattended-upgrades 2>/dev/null || true
echo "    unattended-upgrades aktiv."

echo ""
echo "==> FERTIG. Status:"
ufw status verbose | head -20
echo "fail2ban: $(systemctl is-active fail2ban)"
echo "unattended-upgrades: $(systemctl is-active unattended-upgrades)"
