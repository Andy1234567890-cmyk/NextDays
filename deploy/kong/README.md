# Kong — eigenständige API-Gateway-App (Zero-Downtime)

Kong ist das öffentliche Gateway des self-hosted Supabase-Stacks. Es läuft als
**eigene Coolify-Application** (nicht im Supabase-Compose), damit Coolifys
**Rolling-Update** greift (Single-Service mit Healthcheck → neuer Container wird
healthy, BEVOR der alte stirbt = echtes Zero-Downtime). Compose-Stacks bekommen
in Coolify v4 kein Rolling-Update (stop-all → start-all → kurze Downtime).

## Architektur

```
Internet ──HTTPS──▶ Traefik (coolify-proxy)
                       │  Domain: supabase-kong.<…>.sslip.io  (docker_compose_domains, :8000)
                       ▼
                 ┌──────────┐   supabase-internal (stabiles externes Netz)
                 │  Kong    │──────────────┬─────────┬──────────┬────────┐
                 │ (App B)  │              ▼         ▼          ▼        ▼
                 └──────────┘            auth      rest    storage     meta/realtime
                                         └──────── Supabase-Stack (App A) ────────┘
```

- **Kong erreicht die Stack-Services** (`auth`, `rest`, `storage`, `meta`,
  `realtime`) über das **stabile externe Netz `supabase-internal`** per Name —
  UUID-unabhängig. Beide Apps deklarieren dieses Netz `external: true` MIT
  `name: supabase-internal`.
- **Routing nach außen** über Coolifys `docker_compose_domains` (Service `kong`,
  Domain MIT `:8000`-Suffix). Coolify generiert die Traefik-Labels selbst.

## Voraussetzungen (einmalig pro Server)

```bash
docker network create supabase-internal
```

## Wichtige Coolify-Einstellungen dieser App

- **build_pack:** dockercompose, `docker_compose_location: /docker-compose.yml`,
  `base_directory: /deploy/kong`
- **Env:** `ANON_KEY`, `SERVICE_ROLE_KEY` (gleiche Werte wie der Supabase-Stack)
- **docker_compose_domains:** `{"kong":{"domain":"https://<domain>:8000"}}`
- **Healthcheck** (im Compose): `kong health` → Voraussetzung fürs Rolling-Update

## Stolperfallen (hart erarbeitet)

1. **Service-`networks:` als LISTE schreiben** (`- default` / `- supabase-internal`)
   und das external Netz top-level mit `name:` deklarieren. Sonst überschreibt
   Coolifys Parser den Service-networks-Block und Kong landet nur im UUID-Netz
   → "Temporary failure in name resolution" zu auth/rest.
2. **Kong-Memory ≥ 1g** — bei 256m OOM-Kill der nginx-Worker (502/401-Wechsel).
3. **kong.yml als inline `configs: content:`**, nicht `file:` (Pfad bricht mit
   base_directory).
4. **Domain-Wechsel:** alte Zuweisung am Supabase-Stack entfernen, sonst
   Domain-Konflikt in Traefik (beide Kongs → HTTP 000).
