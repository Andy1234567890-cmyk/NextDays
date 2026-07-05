# Deploy-Runbook — verbindliche Checkliste vor jedem Produktions-Deploy

Kurz, verbindlich. Gilt besonders für Deploys des **DB-Stacks** (`nextdays-supabase`).

## Vor JEDEM DB-Stack-Deploy

1. **Backup-vor-Deploy** ausführen:
   ```bash
   bash deploy/backup/pre-deploy-backup.sh
   ```
   Erzeugt einen pg_dump auf dem Volume (`/mnt/.../predeploy-backups/`). Erst wenn
   „✓ Pre-Deploy-Backup" erscheint, weitermachen.

2. **Container-Namen fest?** Der DB-Stack MUSS
   `is_consistent_container_name_enabled = true` haben (Coolify-App-Setting), sonst
   startet ein Redeploy einen ZWEITEN Satz Container **neben** dem alten — inkl.
   eines zweiten Postgres auf demselben Bind-Mount → **WAL-Korruption**. Prüfen:
   ```sql
   select s.is_consistent_container_name_enabled from application_settings s
   join applications a on a.id=s.application_id where a.name='nextdays-supabase';
   ```
   Muss `t` sein.

3. **Neuer Service im DB-Stack?** → NEIN. Neue Services (Worker etc.) IMMER als
   eigene Coolify-App. Ein Crash im DB-Stack reißt die DB mit.

4. **`networks:`-Block geändert?** Coolify überschreibt ihn beim Generieren —
   gegen einen funktionierenden Service (kong/api) gegenprüfen.

## Nach dem Deploy

5. **Genau EIN Container je Dienst?**
   ```bash
   for s in db pooler rest auth realtime storage meta studio redis; do
     echo "$s: $(docker ps --format '{{.Names}}' | grep -c "^$s-cdqxi")"; done
   ```
   Jeder Wert MUSS `1` sein. Steht irgendwo `2` → Doppel-Container-Race, SOFORT
   den überzähligen stoppen (bei db: höchste Datengefahr).

6. **Smoke-Test:** api-Health + ein echter DB-Call:
   ```bash
   curl -s https://nextdays-api.65.21.144.136.sslip.io/api/v1/booking-engine/listings?limit=1
   ```

## Wenn die DB nicht startet (PANIC: could not locate a valid checkpoint record)

Ursache: zwei Postgres liefen auf demselben Datenverzeichnis (WAL korrupt).
Recovery (Daten in den Heap-Dateien bleiben erhalten):

```bash
# 1. Restart-Loop stoppen
docker stop <db-container>
# 2. WAL zurücksetzen (Version MUSS exakt zum Image passen: 15.14.1.138)
docker run --rm -v /mnt/HC_Volume_106086998/nextdays/postgres:/var/lib/postgresql/data \
  --user 100:0 --entrypoint pg_resetwal supabase/postgres:15.14.1.138 \
  -f /var/lib/postgresql/data
# 3. db-Container wieder starten, Daten prüfen
docker start <db-container>
docker exec <db-container> psql -U postgres -d postgres -tAc "select count(*) from public.properties;"
```
Falls `pg_resetwal` nicht reicht → letzten Pre-Deploy-Dump einspielen
(`/mnt/.../predeploy-backups/`).

## Vorfall-Historie

- **2026-07-05:** Beim Herauslösen der `api` aus dem DB-Stack löste der
  Stack-Redeploy einen Container-Race aus (zweiter Satz aller Dienste, inkl.
  zweitem Postgres auf demselben Volume) → WAL-Korruption → DB-Restart-Schleife,
  App einige Minuten offline. Recovery per `pg_resetwal`, **kein Datenverlust**
  (Pre-Deploy-Dump lag vor). Fix: `is_consistent_container_name_enabled=true` +
  dieses Runbook + `pre-deploy-backup.sh`.
