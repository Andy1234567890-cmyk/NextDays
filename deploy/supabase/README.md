# Self-hosted Supabase-Stack (Production)

Versioniertes Compose-Pendant zum lokalen CLI-Stack (`supabase start`).
Betrieb auf Hetzner via Coolify — siehe [ADR-0010](../../docs/decisions/0010-production-deployment-coolify-hetzner.md).

## Vor dem ersten Start nötig (nicht im Repo, bewusst getrennt)

Diese Artefakte erzeugt Andy beim Setup auf dem Server (sie enthalten
projektspezifische Keys/Config und gehören **nicht** versioniert):

0. **200-GB-Volume mounten + Datenverzeichnisse anlegen (KRITISCH).** Postgres,
   Storage und Redis-AOF müssen auf dem **separaten Hetzner-Volume** liegen,
   nicht auf der OS-SSD. Sonst läuft die 160-GB-Systemplatte mit Fotos/Belegen
   voll. Die Compose bindet die Named Volumes per `driver_opts` an `${DATA_ROOT}`:

   ```bash
   # Mount-Pfad zeigt Hetzner im Volume-Panel, z. B. /mnt/HC_Volume_12345678
   export DATA_ROOT=/mnt/HC_Volume_12345678/nextdays
   mkdir -p "$DATA_ROOT"/{postgres,storage,redis}
   # DATA_ROOT anschließend als Coolify-Env setzen (siehe ../.env.example)
   ```

   Prüfen nach dem Start, dass wirklich aufs Volume geschrieben wird:
   `docker volume inspect supabase-db-data` → `Options.device` muss
   `${DATA_ROOT}/postgres` sein, **nicht** `/var/lib/docker/...`.

1. **`kong.yml`** — deklarative Gateway-Konfiguration (Standard-Supabase-Routing
   für `auth`, `rest`, `realtime`, `storage`, `meta`). Vorlage: offizielles
   Supabase-`docker/volumes/api/kong.yml`. Wird per Volume in `kong` gemountet.
   **Achtung Kong 3.x:** Diese Compose nutzt `kong/kong:3.9.1` (offizielles Set).
   Nimm die `kong.yml` aus einer **aktuellen** Supabase-Release (Format-Version
   `_format_version: "3.0"`), nicht aus einer alten 2.x-Vorlage — sonst startet
   Kong nicht. Das offizielle Supabase-`docker/`-Verzeichnis passt zu diesem
   Image-Set.

2. **Env-Datei** mit allen Werten aus [`../.env.example`](../.env.example):
   - `POSTGRES_PASSWORD`, `JWT_SECRET` (≥ 32 Zeichen)
   - `ANON_KEY` + `SERVICE_ROLE_KEY` — aus dem `JWT_SECRET` signiert
     (Supabase „Generate API keys"-Verfahren / `supabase gen keys`)
   - `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, `REALTIME_ENC_KEY` (Zufalls-Secrets)
   - `SMTP_*` (echter Mailversand statt Inbucket)
   - `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` (Studio-Schutz)

3. **DB-Rollen/Init**: Der `supabase/postgres`-Image legt die Standard-Rollen
   (`authenticator`, `anon`, `authenticated`, `service_role`,
   `supabase_auth_admin`, `supabase_storage_admin`) über sein Init-Skript an.
   Danach die App-Migrationen (`supabase/migrations/0001…`) gegen die DB fahren.

   **Postgres-Version:** Bewusst **PG15** (`supabase/postgres:15.14.1.138`),
   nicht das offizielle PG17 — passend zu `supabase/config.toml`
   (`major_version = 15`) und den bestehenden Migrationen (ADR-0010). Die
   übrigen Image-Tags entsprechen einem aktuellen, zueinander kompatiblen
   offiziellen Supabase-Release-Set (Stand der Tag-Pinnung in der Compose).

## Bewusste Prod-Abweichungen vom Dev-CLI-Stack

| Komponente | Dev (CLI) | Prod (diese Compose) |
| --- | --- | --- |
| Mail | Inbucket (Catcher) | echter SMTP (`SMTP_*`) |
| Pooler (Supavisor) | `enabled = false` | **aktiv** (`pooler`-Service) |
| Analytics/Logflare | aus | aus (RAM sparen) |
| Volumes | ephemer | benannt, auf 200-GB-Volume |
| Image-Tags | CLI-verwaltet | gepinnt (reproduzierbar) |

## Kong von außen erreichbar machen (SUPABASE_URL)

Kong ist das öffentliche Gateway des Stacks — seine Domain wird zur
`SUPABASE_URL`, die API und Frontend nutzen. So wird es exponiert:

1. **Domain pro Service über Coolify, NICHT über manuelle Labels.** In Coolify
   das Feld `docker_compose_domains` für den Service `kong` setzen — die Domain
   **mit Port-Suffix `:8000`**:

   ```
   {"kong":{"domain":"https://<deine-domain>:8000"}}
   ```

   Per API: `PATCH /api/v1/applications/{uuid}` mit
   `{"docker_compose_domains":[{"name":"kong","domain":"https://…:8000"}]}`.

   > ⚠️ Der Port `:8000` ist Pflicht. Ohne ihn generiert Coolify kein
   > `loadbalancer.server.port`-Label → Traefik antwortet „no available server"
   > (503). Coolify erzeugt aus diesem Feld automatisch alle Traefik-Labels
   > inkl. korrektem Netzwerk — **keine** manuellen `traefik.*`-Labels und
   > **kein** eigener `networks:`-Block im Compose nötig (würde sogar stören).

2. **Kong-Memory ≥ 1g.** Das Limit steht im Compose auf `1g`. **Nicht** auf
   256m senken: Kong erstickt dann (100 % MEM → nginx-Worker werden per
   `signal 9` OOM-gekillt → instabile 502/401-Wechsel, die wie ein
   Routing-Problem *aussehen*, aber keines sind).

3. **Verifikation** (sobald Kong `healthy` ist, ~15 s nach Deploy):

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     "https://<deine-domain>/rest/v1/" -H "apikey: $ANON_KEY"   # → 200
   ```

## Hinweis

Image-Tags sind auf konkrete Versionen gepinnt. Vor dem Deploy gegen die
zueinander passenden Supabase-Release-Stände prüfen (offizielles
`supabase/docker/docker-compose.yml` als Referenz für kompatible Tag-Sets).
