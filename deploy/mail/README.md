# NextDays — E-Mail: eigener Mailcow-Server

Eigener Open-Source-Mailserver (**Mailcow**) auf einem **separaten** Hetzner-Server
— getrennt von DB-Stack und App. Damit versendet die Plattform Transaktions-Mails
(Rechnungen, Belege, Onboarding, Benachrichtigungen) über die **eigene Domain**
statt über einen externen Anbieter.

> **Warum ein eigener Server (nicht im DB-/App-Stack):** ein Mailserver braucht
> exklusive Ports (25/465/587/143/993 …), eine saubere IP-Reputation und darf beim
> Crash NICHT den DB-Stack mitreißen (Memory „Worker nie in DB-Stack"). Deshalb
> läuft Mailcow auf einem eigenen Host mit eigener öffentlicher IP.

---

## Eckdaten (Ist-Stand)

| Feld | Wert |
|---|---|
| Server | Hetzner CPX32 (4 vCPU, 8 GB RAM, 150 GB) |
| IPv4 | `62.238.4.193` |
| IPv6 | `2a01:4f9:c014:7997::1` |
| Mail-Hostname (FQDN) | `mail.mynextdays.dk` |
| Mail-Domain (Postfächer) | `mynextdays.dk` |
| Installationspfad | `/opt/mailcow-dockerized` |
| Config | `/opt/mailcow-dockerized/mailcow.conf` |
| Web-UI | `https://mail.mynextdays.dk/` (Admin: `admin` / anfangs `moohoo` → **sofort ändern**) |
| Zeitzone | `Europe/Copenhagen` |

Postfächer: siehe [mailboxes.md](mailboxes.md).

---

## ⚙️ Andys manuelle Schritte (Voraussetzung — nur Andy kann das)

Ohne diese Schritte kann der Server **keine Mail nach außen zustellen**. Sie sind
NICHT automatisierbar (Hetzner-Konto, Domain-DNS).

### 1. Port 25 UND 465 ausgehend freischalten lassen (KRITISCH)
Hetzner blockt **ausgehenden** Traffic zu Port **25 und 465** auf allen
Cloud-Servern standardmäßig. Ohne Port 25 kommt **keine** Mail bei Gmail/Web.de an.

- Hetzner Cloud Console → Support/Anfrage → **Freischaltung Port 25 + 465 ausgehend**
  für Server `#148398616` (`62.238.4.193`).
- Begründung: *„Betrieb eines legitimen Mailservers (Mailcow) für unser eigenes
  SaaS-Produkt, kein Massenversand/Spam."*
- Dauer: Stunden bis 1–2 Tage.

> Intern versendet die **API über Port 587 (STARTTLS)** — der ist NICHT geblockt.
> Aber der Mailserver-zu-Mailserver-Versand nach draußen läuft über **Port 25** →
> der muss trotzdem frei sein.

### 2. Reverse-DNS (PTR) setzen
Hetzner Cloud Console → Server → Netzwerk → **Reverse DNS**:
- IPv4 `62.238.4.193` → `mail.mynextdays.dk`
- IPv6 `2a01:4f9:c014:7997::1` → `mail.mynextdays.dk`

**Ohne passenden PTR landet jede Mail im Spam.**

### 3. DNS-Records setzen (bei der DNS-Verwaltung von `mynextdays.dk`)
Die **exakten** Werte (inkl. des serverspezifischen DKIM-Keys) gibt
[`dns-records.md`](dns-records.md) aus — das wird nach dem ersten Start des
Stacks mit den echten Werten befüllt. Grundgerüst:

| Typ | Name | Wert |
|---|---|---|
| A | `mail.mynextdays.dk` | `62.238.4.193` |
| AAAA | `mail.mynextdays.dk` | `2a01:4f9:c014:7997::1` |
| MX | `mynextdays.dk` | `10 mail.mynextdays.dk.` |
| TXT (SPF) | `mynextdays.dk` | `v=spf1 mx a:mail.mynextdays.dk -all` |
| TXT (DKIM) | `dkim._domainkey.mynextdays.dk` | *(DKIM-Key aus der Mailcow-UI / dns-records.md)* |
| TXT (DMARC) | `_dmarc.mynextdays.dk` | `v=DMARC1; p=quarantine; rua=mailto:postmaster@mynextdays.dk` |
| Autodiscover (optional) | `autodiscover.mynextdays.dk` | CNAME → `mail.mynextdays.dk.` |
| Autoconfig (optional) | `autoconfig.mynextdays.dk` | CNAME → `mail.mynextdays.dk.` |

---

## Betrieb (auf dem Server, als root)

```bash
cd /opt/mailcow-dockerized

# Starten:
docker compose up -d

# Status:
docker compose ps

# Stoppen:
docker compose down

# Update (Mailcow bringt ein eigenes Update-Skript):
./update.sh

# Logs eines Dienstes:
docker compose logs -f postfix-mailcow
```

Konfiguration liegt in `mailcow.conf`. Nach Änderungen:
`docker compose up -d` (bzw. `docker compose down && docker compose up -d`).

---

## Anbindung an die App (Transaktions-Versand)

Die API versendet über `core/mail.py` (`MailService`) per **SMTP-Submission
(Port 587, STARTTLS)**. Konfiguriert wird das über Umgebungsvariablen der API
(NICHT im Repo — siehe `apps/api/.env.example`):

```
SMTP_HOST=mail.mynextdays.dk
SMTP_PORT=587
SMTP_USER=developer@mynextdays.dk     # ein echtes Mailcow-Postfach
SMTP_PASSWORD=<Postfach-Passwort>
SMTP_FROM_ADDRESS=noreply@mynextdays.dk
SMTP_FROM_NAME=myNextDays
SMTP_STARTTLS=true
MAIL_SANDBOX=false
```

- Fehlt `SMTP_HOST` oder `SMTP_FROM_ADDRESS` → Versand ist deaktiviert, `send()`
  gibt `503` (kein stiller Erfolg, kein erfundener Absender — Wurzel 4).
- SMTP-Fehler werden als `MailError` re-raised, nie verschluckt (Wurzel 5).
- `MAIL_SANDBOX=true` → nur Log, kein realer Versand (lokale Tests).

---

## Sicherheit / Absicherung
Siehe [SECURITY.md](SECURITY.md) — UFW-Firewall (nur die nötigen Mail-Ports + SSH),
fail2ban, SSH-Härtung, automatische Security-Updates.

## Bewusst (noch) NICHT Teil
Backup/Restore der Mailcow-Volumes (kommt separat, analog `deploy/backup/`),
Cluster/HA, mehrere Mail-Domains, White-Label-Kundendomains.
