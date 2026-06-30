# RECOVERY — Server-Totalausfall → Wiederaufbau auf frischem Hetzner-Server

Macht aus „Server weg = Katastrophe" → „ein paar Stunden Arbeit nach Runbook".
Infra-Resilienz-Runbook Punkt 4+7.

**Voraussetzung — diese drei Sachen müssen außerhalb des Servers existieren:**
1. **Off-site-Backup** (Borg → Hetzner Storage Box, age-verschlüsselt) mit App-DB,
   Medien UND Coolify-Config — erzeugt von [backup/backup.sh](backup/backup.sh).
2. Die **age-Identität** (`/root/age-backup.key`) + **Borg-Passphrase** — im
   Passwort-Manager. Ohne sie ist kein Backup entschlüsselbar.
3. Der **Passwort-Manager** mit allen Secret-Werten (siehe [ENVIRONMENT.md](ENVIRONMENT.md)).

---

## RPO / RTO

| Kennzahl | Wert | Annahme |
|---|---|---|
| **RPO** (max. Datenverlust) | **≈ 24 h** | Backup-Timer läuft täglich 02:30. Bei stündlichem Timer → ≈ 1 h. |
| **RTO** (Wiederherstellzeit) | **manuell, ~2–4 h** nach diesem Runbook | Hetzner-Server + Volume bereitstellen, Coolify + Stack hoch, Restore, Smoke-Test. |
| Coolify-Config | im selben Backup (täglich) | enthält App-Settings + verschlüsselte Secrets (APP_KEY nötig). |

Kein Hot-Standby / Failover — bewusst (Solo-Betrieb, ein Server). Diese Strategie
ist **Backup + getesteter Restore**, kein HA.

---

## Server-Voraussetzungen (aus den Compose-Kommentaren konsolidiert)

Damit beim Wiederaufbau nichts übersehen wird — diese Dinge sind **nicht** in den
Compose-Dateien selbst, sondern Umgebungs-Vorbedingungen:

- **200-GB-Volume** gemountet unter `/mnt/HC_Volume_<ID>` (ext4). Die Daten liegen als
  Bind-Mount darunter: `…/nextdays/{postgres,storage,redis}`. **Falsch/fehlend → OS-SSD
  läuft voll oder Container finden ihre Daten nicht.**
- **Externe Docker-Netze** müssen VOR dem Stack existieren:
  - `supabase-internal` — internes Supabase-Service-Netz (db/auth/rest/realtime/storage/meta).
  - `coolify` — Traefik-Proxy-Netz. Der Supabase-Compose bindet sich **explizit** dort
    ein (`networks: coolify: external: true`), sonst ist die API nach jedem Deploy
    nicht über Traefik erreichbar (504).
- **`HOSTNAME=0.0.0.0`** für die Next.js-standalone-Apps (`nextdays-web`), sonst bindet
  der Server nur an localhost und Traefik bekommt 502.
- **`NEXT_PUBLIC_*` als buildtime-Env** setzen (Coolify: „Build Variable") — Next.js
  inlined sie beim Build; zur Laufzeit gesetzt wären sie wirkungslos.

---

## Schritt-für-Schritt

### 1. Server + Volume
```bash
# Neuer Hetzner-Server (CX43/CPX o.ä.), Ubuntu. 200-GB-Volume anhängen + mounten.
# Volume-Mountpfad notieren (z.B. /mnt/HC_Volume_XXXXXXXX) und DATA_ROOT anpassen!
mkdir -p /mnt/HC_Volume_XXXXXXXX/nextdays/{postgres,storage,redis}
```
> Der Volume-Pfad ist an mehreren Stellen referenziert (Compose-Bind-Mounts,
> `DATA_ROOT`, `backup.sh`). Bei abweichendem Pfad überall anpassen.

### 2. Coolify installieren + externe Netze
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash -s 4.1.2
# Externe Netze anlegen (VOR dem Stack-Deploy):
docker network create supabase-internal
# 'coolify' wird vom Coolify-Installer angelegt; prüfen:
docker network ls | grep -E "coolify|supabase-internal"
```

### 3. Coolify-Config + Secrets zurückspielen
**Variante A — Coolify-Config-Backup einspielen (schnell, bevorzugt):**
Das jüngste Backup enthält `coolify-config.tar.age` (DB-Dump + `source/.env` mit
APP_KEY + `ssh/keys/`).
```bash
set -a; source /etc/nextdays-backup.env; set +a   # BORG_REPO/PASSPHRASE/age
borg list --glob-archives 'nextdays-*' --last 1
cd /tmp && borg extract "::nextdays-<ARCHIV>" tmp        # holt die *.age-Dateien
age -d -i /root/age-backup.key -o coolify-config.tar tmp/nextdays-backup.*/coolify-config.tar.age
tar -xf coolify-config.tar      # → coolify-db.dump, source/.env, ssh/keys/

# Coolify-Dienste stoppen, DB einspielen:
docker stop coolify coolify-redis coolify-realtime coolify-proxy
cat coolify-db.dump | docker exec -i coolify-db \
  pg_restore --verbose --clean --no-acl --no-owner -U coolify -d coolify

# KRITISCH: den alten APP_KEY übernehmen, sonst sind alle Secrets unlesbar.
# Den APP_KEY aus dem gesicherten source/.env nehmen und im NEUEN
# /data/coolify/source/.env als APP_PREVIOUS_KEYS eintragen:
#   APP_PREVIOUS_KEYS=<alter_app_key>
# SSH-Keys zurücklegen (Zugang zu verwalteten Servern):
cp ssh/keys/ssh_key@* /data/coolify/ssh/keys/ && chown -R root:root /data/coolify
# Coolify neu starten:
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash -s 4.1.2
```
> Ohne den passenden `APP_KEY`/`APP_PREVIOUS_KEYS` sind die in der Coolify-DB
> Laravel-verschlüsselten Env-Werte nach dem Restore unlesbar — dann zwingend
> Variante B.

**Variante B — Apps neu anlegen (Fallback, wenn Config-Backup fehlt/APP_KEY weg):**
1. In Coolify die 6 Apps aus den `deploy/`-Compose neu anlegen (Repo verbinden):
   `nextdays-supabase`, `-web`, `-plattform`, `-storybook`, `-marketing`, `-kong`.
2. Env je App **aus [ENVIRONMENT.md](ENVIRONMENT.md) + Passwort-Manager** setzen
   (Secret-Werte aus dem Passwort-Manager; `NEXT_PUBLIC_*` als Build-Variable).

### 4. Stack hochfahren (Reihenfolge/Abhängigkeiten)
1. **`nextdays-supabase`** zuerst (db → rest/auth/realtime/storage/meta, pooler, redis,
   FastAPI-api). Healthchecks abwarten (`db` healthy bevor api startet).
2. **`nextdays-kong`** (Edge-Gateway, braucht ANON/SERVICE-Keys des Stacks).
3. **`nextdays-web` / `-plattform` / `-marketing` / `-storybook`** (Frontends).
```bash
docker ps   # alle Container „healthy"? Kong, db, api, web, plattform
```

### 5. App-DB-Restore (jüngstes Backup)
Details + Restore-Test: [backup/README.md](backup/README.md).
```bash
cd /tmp && borg extract "::nextdays-<ARCHIV>" tmp
age -d -i /root/age-backup.key -o postgres.dump tmp/nextdays-backup.*/postgres.dump.age
# In die LAUFENDE Supabase-DB einspielen (Container-Name dynamisch):
DB=$(docker ps --filter ancestor=supabase/postgres:15.14.1.138 --format '{{.Names}}' | head -1)
docker exec -i -e PGPASSWORD="$(docker exec $DB printenv POSTGRES_PASSWORD)" "$DB" \
  pg_restore --no-owner --clean --if-exists -U supabase_admin -d postgres < postgres.dump
# _supabase analog mit -d _supabase
```
> **Gotcha** (siehe backup/README.md): Der monatliche *Restore-TEST* nutzt ein
> schlankes `postgres:15-alpine` (das supabase-Image kollidiert beim --clean). Für
> die ECHTE Wiederherstellung hier wird in die laufende Supabase-DB eingespielt.

### 6. Medien wieder anbinden
Liegen in Hetzner Object Storage (Bucket überlebt den Serverausfall). Nur die Env
muss stehen (aus [storage/README.md](storage/README.md) / ENVIRONMENT.md):
`STORAGE_BACKEND=s3`, `STORAGE_S3_*`, `AWS_*`. Test: ein bestehendes Bild über die
App laden. Liegt das Bucket aus irgendeinem Grund leer vor → aus dem Borg-Backup
restaurieren (Medien sind dort mitgesichert).

### 7. Smoke-Test (vor „fertig")
- [ ] **Login Dashboard** (`nextdays-web`) — Auth/JWT funktioniert.
- [ ] **Plattform lädt** (`nextdays-plattform`) — öffentliche Buchungsstrecke.
- [ ] **Ein Listing mit Bild** — Medien/Object-Storage erreichbar.
- [ ] **Ein Realtime-Event** — z.B. Posteingang/Reservierung aktualisiert sich live (WebSocket).
- [ ] **Test-Zahlungsfluss (Stripe Sandbox)** — Payment-Intent + Webhook 200.
- [ ] **DB-Plausibilität** — Kern-Tabellen-Counts ~ wie vor dem Ausfall.

### 8. DNS / Domain
Aktuell `*.sslip.io` (an die Server-IP gebunden) → **neue Server-IP = neue sslip.io-
Hostnames automatisch**, keine DNS-Arbeit nötig. Beim Cutover auf eine echte Domain
(Infra-Runbook #4): A-Records auf die neue IP, Coolify-FQDN je App anpassen, Traefik
holt Let's-Encrypt-Zertifikate neu.

---

## Was wo liegt (Verweise)
- App-DB + Medien + Coolify-Config-Backup: [backup/README.md](backup/README.md),
  [backup/backup.sh](backup/backup.sh).
- Env-Namen/Secret-Checkliste: [ENVIRONMENT.md](ENVIRONMENT.md).
- Medien/Object-Storage: [storage/README.md](storage/README.md).
- Stack-Definition: [docker-compose.prod.yml](docker-compose.prod.yml),
  [supabase/docker-compose.yml](supabase/docker-compose.yml), [kong/](kong/).

## Bewusst manuell / offen
- **DNS**: bei echter Domain manueller A-Record-Wechsel (heute sslip.io = automatisch).
- **Kein Failover/HA** — ein Server, manueller Wiederaufbau.
- **Secrets** liegen nicht im Repo: Passwort-Manager (Andy) + verschlüsseltes
  Coolify-Backup sind die einzigen Quellen.
