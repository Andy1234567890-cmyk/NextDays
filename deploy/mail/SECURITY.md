# Mailserver — Sicherheit & Absicherung

Härtung des Mailcow-Hosts (`mail.mynextdays.dk`, `62.238.4.193`). Ein Mailserver ist
ein permanentes Angriffsziel (Spam-Relay, Brute-Force auf SMTP/IMAP, offene Ports).

## 1. Firewall (UFW) — nur die nötigen Ports

Mailcow braucht diese **eingehenden** Ports offen; alles andere wird geblockt.

| Port | Dienst | Nötig? |
|---|---|---|
| 22 | SSH | ja (Administration) |
| 25 | SMTP (MX-Empfang von anderen Servern) | ja |
| 80 | HTTP (Let's-Encrypt-Challenge → Redirect 443) | ja |
| 443 | HTTPS (Web-UI + Autodiscover) | ja |
| 465 | SMTPS (Submission, implizites TLS) | ja |
| 587 | Submission (STARTTLS) — **App-Versand** | ja |
| 143 | IMAP (STARTTLS) | ja |
| 993 | IMAPS | ja |
| 110 / 995 | POP3 / POP3S | optional (nur wenn POP3 genutzt) |
| 4190 | ManageSieve (Filterregeln) | optional |

Docker umgeht `iptables`/UFW teilweise selbst (published Ports). Deshalb regelt
Mailcow den Zugriff primär über die **veröffentlichten Ports in `mailcow.conf`**
(`*_PORT`/`*_BIND`), und UFW dient als zusätzliche Host-Ebene. Auf einem dedizierten
Mail-Host sind **alle** obigen Ports gewollt — die Härtung besteht v.a. darin, ALLES
ANDERE zu blocken und SSH abzusichern.

```bash
# siehe harden.sh — idempotent, kann jederzeit erneut laufen
bash deploy/mail/harden.sh
```

## 2. SSH-Härtung
- **Root-Login nur per Key**, kein Passwort (`PasswordAuthentication no`,
  `PermitRootLogin prohibit-password`).
- fail2ban aktiv (siehe unten) gegen SSH-Brute-Force.
- Optional später: SSH auf einen nicht-Standard-Port, dedizierter Admin-User.

## 3. fail2ban
Mailcow bringt **eigenen Brute-Force-Schutz** mit (`netfilter-mailcow` /
`dovecot`/`postfix`-Watchdog bannt IPs nach Fehlversuchen auf SMTP/IMAP). Zusätzlich
sichert host-seitiges **fail2ban** den SSH-Zugang. Beide ergänzen sich:
Mailcow schützt die Mail-Ports, fail2ban den SSH-Port.

## 4. Automatische Security-Updates
`unattended-upgrades` für Sicherheits-Patches des Hosts. Docker-Images werden über
Mailcows `update.sh` aktualisiert (nicht automatisch — kontrolliert, mit Snapshot).

## 5. Web-UI absichern
- Admin-Passwort **sofort** von `moohoo` auf ein starkes Passwort ändern.
- Optional: 2FA (TOTP) in der Mailcow-UI aktivieren.
- Optional: Admin-UI per IP-Allowlist / VPN einschränken.

## 6. Zustellbarkeit = Teil der Sicherheit
SPF (`-all`), DKIM und DMARC (`p=quarantine` → später `p=reject`) verhindern, dass
Dritte in deinem Namen versenden. Siehe [dns-records.md](dns-records.md).

## Verifikation (nach Umsetzung)
```bash
ssh root@62.238.4.193 'ufw status verbose'         # Firewall-Regeln
ssh root@62.238.4.193 'systemctl is-active fail2ban'
ssh root@62.238.4.193 'grep -E "PasswordAuthentication|PermitRootLogin" /etc/ssh/sshd_config'
```
