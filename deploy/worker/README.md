# Background-Worker (jobs-Queue)

Eigenständige Coolify-App. Arbeitet die generische `jobs`-Queue ab: Channex-Content-Sync,
ARI-Push (`push_ari`), Reconcile-Tick (ersetzt den Host-Cron), Dynamic-Pricing-Recompute —
alles **außerhalb** des HTTP-Request-Pfads.

## Warum ein eigener Stack (nicht im DB-Stack)

Ein crashender Worker im selben Compose-Stack wie die Produktions-DB kann den ganzen Stack
inkl. DB mitreißen — das ist einmal passiert (Crash-Schleife → Coolify fuhr den kompletten
Supabase-Stack herunter, App offline). Als isolierte App bleibt ein Worker-Crash folgenlos für
die DB: er restartet nur sich selbst. Dieselbe Trennung wie beim Kong-Stack.

## Netz

Der Worker nimmt keinen HTTP-Verkehr an → kein Traefik/coolify-Netz. Er erreicht Kong
(`SUPABASE_URL=http://kong:8000`) und Redis über das stabile externe Netz `supabase-internal`
per Servicename. **Voraussetzung:** `redis` ist im DB-Stack zusätzlich in `supabase-internal`
(alias `redis`) — bereits in `deploy/supabase/docker-compose.yml` gesetzt.

## Coolify-Setup (einmalig)

1. Neue Coolify-App aus diesem Repo, Compose-Datei `deploy/worker/docker-compose.yml`.
2. Env-Variablen (dieselben wie der `api`-Service): `ANON_KEY`, `SERVICE_ROLE_KEY`,
   `JWT_SECRET`, `REDIS_PASSWORD`, `CHANNEX_*`. Optional: `WORKER_CONCURRENCY`,
   `CHANNEX_ACCOUNT_BUDGET`, `CHANNEX_PROPERTY_BUDGET`.
3. watch_paths: `apps/api/**` und `deploy/worker/**` (Auto-Deploy bei Code-/Compose-Änderung).
4. Nach dem ersten erfolgreichen Deploy: den Host-Cron `nextdays-reconcile.sh` entfernen
   (der Worker macht den Reconcile-Tick selbst) — **erst** wenn der Worker live läuft.

## Verifikation

- Container läuft ohne Crash-Schleife (kann `kong`/`redis` auflösen).
- Log `worker_started` mit `concurrency=4`.
- Ein eingereihter Job (`sync_property_content` / `push_ari`) wird geclaimt → `done`.
- Reconcile-Tick reiht alle ~15 min `reconcile_tenant`-Jobs ein.
