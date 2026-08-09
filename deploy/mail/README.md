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
SMTP_USER=info@mynextdays.dk          # ein echtes Mailcow-Postfach
SMTP_PASSWORD=<Postfach-Passwort>
SMTP_FROM_ADDRESS=info@mynextdays.dk
SMTP_FROM_NAME=myNextDays
SMTP_STARTTLS=true
MAIL_SANDBOX=false
```

#### Absenderadresse: `info@`, NICHT `noreply@` (entschieden am 08.08.2026)

Der sichtbare Absender aller Transaktionsmails ist `info@mynextdays.dk` — ein
Postfach, das tatsächlich gelesen wird. `noreply@` ist bewusst NICHT im Einsatz:

- **Zustellbarkeit.** Antworten sind ein Engagement-Signal. Eine Adresse, die
  niemand anschreiben kann, sammelt keine Antworten, wird seltener ins Adressbuch
  übernommen und häufiger als Spam gemeldet — beides drückt die Reputation. Für
  einen frisch aufgesetzten Mailserver ohne Sende-Historie (unser Fall) wiegt das
  besonders schwer, weil Apple/iCloud und Google die Reputation erst aufbauen.
- **Ein Absender, nicht zwei.** Wechselnde Absenderadressen verteilen den
  Reputationsaufbau auf mehrere Identitäten und verlangsamen ihn. `SMTP_USER` und
  `SMTP_FROM_ADDRESS` sind deshalb dieselbe Adresse.
- **Erwartbarkeit.** Ein Gastgeber, der auf eine Einladungs- oder Statement-Mail
  antwortet, erreicht damit den Betreiber, statt ins Leere zu schreiben.

Der Alias `noreply@` bleibt angelegt (er zeigt ohnehin auf `info@`), wird aber
nicht als Absender verwendet. Wer das ändern will, ändert es an genau dieser
Stelle und in `deploy/ENVIRONMENT.md` mit — es gibt nur diese eine Wahrheit.

- Fehlt `SMTP_HOST` oder `SMTP_FROM_ADDRESS` → Versand ist deaktiviert, `send()`
  gibt `503` (kein stiller Erfolg, kein erfundener Absender — Wurzel 4).
- SMTP-Fehler werden als `MailError` re-raised, nie verschluckt (Wurzel 5).
- `MAIL_SANDBOX=true` → nur Log, kein realer Versand (lokale Tests).

---

## Sicherheit / Absicherung
Siehe [SECURITY.md](SECURITY.md) — UFW-Firewall (nur die nötigen Mail-Ports + SSH),
fail2ban, SSH-Härtung, automatische Security-Updates.

## Regelkonformität (gegen Blacklisting / Beschwerden / Behörden-Kontakt)

Damit der Server nicht auffällig wird (Spam-Blacklists, Beschwerden, im schlimmsten
Fall Kontakt durch die Bundesnetzagentur), ist Folgendes eingebaut und live geprüft:

| Punkt | Status | Warum |
| --- | --- | --- |
| **Kein Open Relay** | ✅ | `defer_unauth_destination` + `permit_sasl_authenticated`: NUR authentifizierte Nutzer dürfen an fremde Domains senden. Offene Relays sind der Hauptgrund für sofortiges Blacklisting. |
| **`abuse@` + `postmaster@`** | ✅ angelegt | RFC-2142-Pflicht. Beschwerden/Blacklist-Betreiber/Behörden erreichen den Betreiber → Reaktion möglich, statt unbemerkt geblockt zu werden. Ziel: `info@` (MUSS gelesen werden). |
| **DKIM (2048)** | ✅ | Signiert ausgehende Mail → Echtheit beweisbar, keine Fälschung im eigenen Namen. |
| **SPF `-all` + DMARC `p=quarantine`** | ✅ (DNS) | Legt fest, wer senden darf; regelt Umgang mit Fälschungen + Reports an `postmaster@`. |
| **TLS erzwungen** | ✅ | Kein Klartext-Versand (Datenschutz/DSGVO). |
| **Ausgehender Spam-Filter (rspamd)** | ✅ | Verhindert versehentlichen Spam-Versand über eigene (evtl. kompromittierte) Konten. |
| **Firewall + fail2ban** | ✅ | Kein Missbrauch durch Brute-Force auf SMTP/IMAP/SSH. |

**NICHT am Server, sondern bei euch (rechtlich):** Bei geschäftlicher Mail-Nutzung
gilt Impressumspflicht (DDG/§5). Der rechtliche Betreiber-Kontakt gehört ins
Firmen-Impressum, nicht in die Server-Config.

> **Bei Wiederholung eines früheren Vorfalls:** Wenn ein Server/eine IP schon einmal
> auffällig war, kann die **IP-Reputation vorbelastet** sein. Deshalb VOR dem ersten
> Produktiv-Versand die neue IP `62.238.4.193` gegen die großen Blacklists prüfen
> (siehe SECURITY.md → „IP-Reputation prüfen") und langsam „warmlaufen" lassen
> (erst wenige Mails/Tag), damit die Reputation sauber aufgebaut wird.

## Bewusst (noch) NICHT Teil
Backup/Restore der Mailcow-Volumes (kommt separat, analog `deploy/backup/`),
Cluster/HA, mehrere Mail-Domains, White-Label-Kundendomains.
