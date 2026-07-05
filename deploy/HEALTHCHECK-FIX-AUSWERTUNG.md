# Auswertung: supabase-Stack „degraded" beheben — echte Healthchecks

**Ziel:** `nextdays-supabase` in Coolify von gelb (degraded) auf grün, mit
ECHTEN Healthchecks (keine TCP-Hacks), ohne DB-Schaden bei 1000 Usern.

## Warum steht supabase gelb?

5 Dienste im DB-Stack haben **keinen** Healthcheck: `rest`, `auth`, `realtime`,
`storage`, `pooler`. Coolify kann ihren Zustand nicht prüfen → App = `degraded`.
(`db`, `meta`, `studio` haben Healthchecks bzw. meta braucht offiziell keinen.)

## Die offiziellen Healthchecks (Quelle: supabase/supabase docker-compose.yml)

Verifiziert gegen die offizielle Supabase-Compose. Diese sind KEINE Hacks — sie
nutzen die eingebauten Health-Endpunkte/-Binaries der Dienste:

### rest (PostgREST) — distroless, prüft sich mit dem EIGENEN Binary
```yaml
    environment:
      # Pflicht für --ready (live verifiziert, s.u.):
      PGRST_ADMIN_SERVER_PORT: 3001
      PGRST_ADMIN_SERVER_HOST: localhost
    healthcheck:
      test: ["CMD", "postgrest", "--ready"]
      interval: 5s
      timeout: 5s
      retries: 3
      start_period: 10s
```
> Das war der Knackpunkt: das postgrest-Image hat kein sh/curl/wget, ABER
> `postgrest --ready` ist ein eingebauter Health-Selbsttest. Kein Fremd-Tool nötig.
>
> **Live-Befund (v14.12, Wegwerf-Container gegen die echte Umgebung):** `--ready`
> braucht den Admin-Server (`PGRST_ADMIN_SERVER_PORT`) und verweigert bei
> Wildcard-server-host (`!4`/`*`). Lösung: `PGRST_ADMIN_SERVER_HOST=localhost` —
> nur der Admin-Endpunkt lauscht auf localhost, der Haupt-Server (3000) bleibt
> für kong/storage erreichbar (beides im Test bewiesen: `REST_READY_OK` +
> `EXTERN_OK`).

### auth (GoTrue) — hat wget
```yaml
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:9999/health"]
      interval: 5s
      timeout: 5s
      retries: 3
```

### realtime — braucht curl MIT Auth-Header + Tenant-Pfad
```yaml
    healthcheck:
      test: ["CMD-SHELL", "curl -sSfL --head -o /dev/null -H \"Authorization: Bearer ${ANON_KEY}\" http://localhost:4000/api/tenants/realtime-dev/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```
> WICHTIG: Der Tenant-Name im Pfad muss ggf. an `POOLER_TENANT_ID`/Realtime-Tenant
> angepasst werden. Offiziell steht dort `realtime-dev`. Vor dem Deploy live testen:
> `docker exec <realtime> curl -sSfL --head -H "Authorization: Bearer $ANON_KEY" \
>   http://localhost:4000/api/tenants/<tenant>/health`
>
> **Live verifiziert:** `_realtime.tenants` enthält `realtime-dev` (und
> `realtime`); der Check mit `realtime-dev` + ANON_KEY antwortet OK. Umgesetzt als
> CMD-Array (statt CMD-SHELL), gleiche Semantik ohne Shell-Quoting-Fallen; die
> `${ANON_KEY}`-Interpolation wurde per `docker compose config` gegen die echte
> Coolify-Env bewiesen (gerendert steht der echte JWT im Befehl).

### storage — hat wget
```yaml
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://storage:5000/status"]
      interval: 5s
      timeout: 5s
      retries: 3
      start_period: 10s
```
> Nutzt den Servicenamen `storage` (nicht localhost) — im default-Netz auflösbar.
> **Live verifiziert:** über `storage` OK; über `localhost` verweigert (wird
> IPv6/::1 aufgelöst, dort lauscht der Dienst nicht) — der offizielle
> Servicename-Weg ist also Pflicht, kein Stil-Detail.

### pooler (Supavisor) — hat curl
```yaml
    healthcheck:
      test: ["CMD", "curl", "-sSfL", "--head", "-o", "/dev/null", "http://127.0.0.1:4000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
```

### meta — offiziell KEIN Healthcheck
Supabase definiert für `postgres-meta` keinen Healthcheck. Falls Coolify meta
dennoch als „ohne HC = degraded" wertet, einen einfachen ergänzen (meta hat node):
`["CMD", "node", "-e", "fetch('http://localhost:8080/health').then(r=>{if(r.status!==200)process.exit(1)})"]`
— vorher live verifizieren, ob `/health` an :8080 existiert.

## Umsetzungsstand (alle 5 eingebaut + verifiziert)

Alle 5 Healthchecks stehen in `deploy/supabase/docker-compose.yml`
(rest inkl. Admin-Server-Env, auth, realtime als CMD-Array, storage, pooler im
offiziellen Format). Jeder Testbefehl wurde VOR dem Eintragen live im laufenden
bzw. Wegwerf-Container ausgeführt; die komplette Datei wurde anschließend auf dem
Server per `docker compose config` mit der echten Coolify-Env gerendert (rc=0,
ANON_KEY interpoliert). `meta` bringt seinen Healthcheck aus dem Image mit
(Container meldet live `healthy`).

Zusätzlich: der **Worker** (eigene App, kein HTTP-Port) hat jetzt einen echten
Liveness-Check — der Run-Loop schreibt je Durchlauf einen Heartbeat
(`src/worker.py`, `HEARTBEAT_PATH`), der Healthcheck in
`deploy/worker/docker-compose.yml` schlägt an, wenn die Datei älter als 120 s
ist (hängender Event-Loop wird sichtbar, nicht nur ein toter Prozess).

Und: `nextdays-supabase` hatte noch `apps/api/**` in den watch_paths — jeder
api-Push hätte den DB-Stack mitdeployt. Entfernt (nur noch
`deploy/supabase/**`), in der Coolify-DB gegengelesen.

## Deploy-Sicherheit — DAS ist der kritische Teil bei 1000 Usern

Ein Healthcheck-Deploy ist ein **DB-Stack-Deploy**. Am 2026-07-05 hat genau so ein
Deploy einen Container-Race (zwei Postgres auf einem Volume) → WAL-Korruption →
DB-Ausfall ausgelöst. Vor JEDEM Deploy dieses Stacks:

1. **`is_consistent_container_name_enabled = true`** für `nextdays-supabase` MUSS
   gesetzt sein (feste Container-Namen → Docker verhindert Doppel-Postgres).
   Prüfen:
   ```sql
   select s.is_consistent_container_name_enabled from application_settings s
   join applications a on a.id=s.application_id where a.name='nextdays-supabase';
   ```
   → muss `t` sein. (Wurde am 05.07. gesetzt.)
2. **Pre-Deploy-Backup:** `bash deploy/backup/pre-deploy-backup.sh` (Pflicht).
3. Nach dem Deploy: prüfen, dass **genau EIN** Container je Dienst läuft:
   ```bash
   for s in db pooler rest auth realtime storage meta studio; do
     echo "$s: $(docker ps --format '{{.Names}}' | grep -c "^$s-cdqxi")"; done
   ```
   Jeder Wert MUSS `1` sein. Bei `2` → sofort den überzähligen stoppen (bei db
   höchste Datengefahr), NIE einen weiteren „Aufräum"-Redeploy fahren.
4. Recovery bei DB-PANIC: siehe `deploy/DEPLOY-RUNBOOK.md` (`pg_resetwal`).

## Empfohlene Reihenfolge (für die Umsetzung)

1. Die 5 offiziellen Healthchecks in `deploy/supabase/docker-compose.yml` eintragen
   (rest/auth/realtime/storage/pooler), realtime-Tenant vorher live verifizieren.
2. YAML lokal validieren (`python3 -c "import yaml; yaml.safe_load(open(...))"`).
3. `pre-deploy-backup.sh` ausführen.
4. Consistent-names-Flag prüfen (muss `t`).
5. DB-Stack deployen, dann die Container-Anzahl-Prüfung (Schritt 3 oben).
6. In Coolify prüfen: `nextdays-supabase` = grün, jeder Dienst healthy.

## Bekannter Rest-Zustand (Stand 2026-07-05, verifiziert)

- Daten intakt: 65 properties, 21 tenants, 17 reservations.
- api/redis/worker als eigene Coolify-Apps getrennt, DB-Stack = nur DB+Auth+Storage.
- api extern 200, DB-Calls 200, api→redis True (nach coolify-Netz-Fix für IPv6).
- Offen: die 5 Healthchecks oben (dieser Fix) → dann ist supabase grün.
