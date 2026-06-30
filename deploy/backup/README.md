# NextDays — Off-site-Backup, getesteter Restore & Backup-Monitoring

Schließt die Resilienz-Lücken aus dem Infra-Runbook:
**Off-site-DB-Backup**, **getesteter Restore** und **Backup-/Disk-Alert**.
Reiner Hetzner-Stack (Storage Box + BorgBackup), kein AWS.

## Was automatisch läuft

| Komponente | Zeitplan | Was |
|---|---|---|
| `nextdays-backup.timer` | täglich 02:30 | `pg_dump -Fc` (`postgres` + `_supabase`) + Supabase-Storage → age-verschlüsselt → Borg-Push zur Storage Box → GFS-Prune |
| `nextdays-restore-test.timer` | monatlich, 1. um 04:00 | Jüngstes Backup in Wegwerf-Container wiederherstellen + Sanity-Checks |
| `nextdays-disk-check.timer` | stündlich | Warnt bei > 80 % auf OS-SSD oder Daten-Volume |

**Retention (GFS):** 7 täglich · 4 wöchentlich · 6 monatlich.
**Gesichert:** DBs `postgres` + `_supabase`, Storage-Verzeichnis (Gäste-Fotos/Belege = PII).
**Verschlüsselung:** Borg-Repo (repokey) **und** age auf den DB-Dumps (Defense-in-Depth).

Die Prod-DB und die Bind-Mount-Datenverzeichnisse werden ausschließlich **gelesen**.

---

## Einmalige Einrichtung (durch Andy)

### 1. Storage Box anlegen (Hetzner-Konto)
- Im Hetzner-Robot/Cloud-Konsole eine **Storage Box** bestellen (BX11 reicht für das
  aktuelle Datenvolumen; idealerweise anderes RZ als der Server in Falkenstein).
- Server-SSH-Key hinterlegen: den **öffentlichen** Key des Servers
  (`/root/.ssh/id_ed25519.pub`, ggf. mit `ssh-keygen -t ed25519` erzeugen) in der
  Storage-Box-Verwaltung unter „SSH-Keys" eintragen. SSH-Support an der Box aktivieren.

### 2. Konfiguration setzen
```bash
sudo cp /opt/nextdays/deploy/backup/nextdays-backup.env.example /etc/nextdays-backup.env
sudo chmod 600 /etc/nextdays-backup.env
sudo nano /etc/nextdays-backup.env          # BORG_REPO, BORG_PASSPHRASE, AGE_* etc.
```
age-Schlüsselpaar erzeugen und `AGE_RECIPIENT` (Public Key) eintragen:
```bash
age-keygen -o /root/age-backup.key && chmod 600 /root/age-backup.key
grep 'public key' /root/age-backup.key      # → AGE_RECIPIENT
```

### 3. Borg-Repo initialisieren (einmalig, verschlüsselt)
```bash
set -a; source /etc/nextdays-backup.env; set +a
borg init --encryption=repokey-blake2 "$BORG_REPO"
```
> ⚠️ `BORG_PASSPHRASE` schützt bei `repokey` den Schlüssel. **Passphrase getrennt von der
> Storage Box sichern** (z. B. Passwortmanager) — ohne sie ist kein Restore möglich.

### 4. Installieren & Timer aktivieren
`install.sh` kopiert Skripte nach `/usr/local/bin`, Units nach `/etc/systemd/system`
und aktiviert die Timer:
```bash
sudo bash /opt/nextdays/deploy/backup/install.sh
systemctl list-timers | grep nextdays
```

### 5. Erst-Backup + Restore-Test
```bash
sudo systemctl start nextdays-backup.service      && journalctl -u nextdays-backup -n 40 --no-pager
sudo systemctl start nextdays-restore-test.service && journalctl -u nextdays-restore-test -n 40 --no-pager
```

---

## 🔴 Disaster-Recovery: Server-Totalausfall → Wiederherstellung auf neuem Hetzner-Server

**Voraussetzung:** Du hast `BORG_REPO`, `BORG_PASSPHRASE` und die age-Identität
(`/root/age-backup.key`) außerhalb des Servers gesichert. **Ohne diese drei kein Restore.**

1. **Neuen Hetzner-Server + Volume** bereitstellen, Docker + Coolify installieren,
   Daten-Volume als `/mnt/HC_Volume_.../nextdays/{postgres,storage,redis}` mounten.
2. **Borg + age installieren**, `/etc/nextdays-backup.env` mit denselben Werten anlegen,
   age-Identität nach `/root/age-backup.key` legen.
3. **Supabase-Stack hochfahren** (Coolify-Deploy von `main`), sodass der Postgres-Container
   `supabase/postgres:15.14.1.138` läuft. Env-Variablen kommen aus Coolify.
4. **Jüngstes Backup ermitteln & holen:**
   ```bash
   set -a; source /etc/nextdays-backup.env; set +a
   borg list --glob-archives 'nextdays-*' --last 1
   # `tmp` ist ein Pfad-PRÄFIX (kein Glob); extrahiert nur die DB-Dumps.
   cd /tmp && borg extract "::nextdays-<ARCHIV>" tmp
   age -d -i /root/age-backup.key -o postgres.dump tmp/nextdays-backup.*/postgres.dump.age   # falls .age
   ```
5. **In die laufende DB einspielen** (DB-Container-Name dynamisch):
   ```bash
   DB=$(docker ps --filter ancestor=supabase/postgres:15.14.1.138 --format '{{.Names}}' | head -1)
   docker exec -i -e PGPASSWORD="$(docker exec $DB printenv POSTGRES_PASSWORD)" "$DB" \
     pg_restore --no-owner --clean --if-exists -U supabase_admin -d postgres < /tmp/postgres.dump
   # _supabase analog mit -d _supabase
   ```
6. **Storage wiederherstellen:**
   ```bash
   cd / && borg extract "::nextdays-<ARCHIV>" 'mnt/HC_Volume_*/nextdays/storage'
   ```
7. **Smoke-Test:** Login, eine Buchung öffnen, ein Gäste-Foto/Beleg laden, Zahlungen prüfen.

> Der `restore-test.sh` übt die Schritte 4–5 monatlich automatisch in einem isolierten
> Wegwerf-Container — er bestätigt, dass das Backup tatsächlich wiederherstellbar ist.

---

## Monitoring

- **Backup-Erfolg:** Dead-man-Ping (`BACKUP_PING_URL`) **nur** bei Erfolg. Externer Monitor
  (healthchecks.io / Uptime-Kuma Push) schlägt Alarm, wenn der tägliche Ping ausbleibt.
- **Disk:** `nextdays-disk-check` warnt stündlich bei > 80 % (Ping und/oder Mail).
- **Healthchecks der Dienste** (für externen Uptime-Check):
  `web /api/health`, `api /healthz`, `plattform /api/health` — Uptime-Kuma-Setup optional.

---

## Bewusst NICHT Teil dieses Setups (→ Infra-Resilienz-Runbook)
- Medien-Migration zu Object Storage / CDN.
- Echte Domain-Redundanz, Multi-Node-Setup, Postgres-HA / Streaming-Replikation.
- Failover-Automatik. Dieses Setup ist **Backup + getesteter Restore**, kein Hot-Standby —
  RPO ≈ 24 h (täglicher Lauf), RTO = manuelle Wiederherstellung nach obigem Runbook.
