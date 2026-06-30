# Rate-Limiting & Backpressure (Infra-Runbook Punkt 8)

Schützt davor, dass ein langsamer/missbrauchter Endpunkt den ganzen Server
mitreißt (vgl. der `booking-engine/listings`-N+1-Timeout). Drei Ebenen:
**API-Limiter** (Redis), **DB-Backpressure** (statement_timeout), **Edge** (Traefik).

---

## 1. API-Rate-Limiting (FastAPI, Redis-backed)

Implementierung: `apps/api/src/core/ratelimit.py` (Limiter-Kern) +
`ratelimit_middleware.py` (ASGI-Middleware), eingehängt in `main.py`.

**Warum Redis-backed:** bei `UVICORN_WORKERS=2` würde ein In-Memory-Limiter pro
Worker getrennt zählen → effektives Limit unvorhersehbar. Redis ist die gemeinsame
Wahrheit (atomares Lua-Fixed-Window, ein Roundtrip, race-frei).

### Gestaffelte Limits (Env, Default-Werte)
| Bucket | Env | Default | Gilt für |
|---|---|---|---|
| Default/IP | `RATE_LIMIT_DEFAULT` | `300/60` | alles übrige (Exzess-/Scraper-Schutz) |
| Auth | `RATE_LIMIT_AUTH` | `10/60` | `/auth/login`, `/auth/register` (Brute-Force) |
| Payments | `RATE_LIMIT_PAYMENTS` | `30/60` | `/payments/*` (teuer/sensibel) |
| Listings | `RATE_LIMIT_LISTINGS` | `60/60` | `/booking-engine/listings`, `/availability`, `/calendar` |
| Tenant | `RATE_LIMIT_TENANT` | `600/60` | pro eingeloggtem Tenant (Fairness) |

Schema `"<max>/<fenster-sek>"`. Schalter: `RATE_LIMIT_ENABLED` (Default true).

### Echte Client-IP hinter Traefik
`RATE_LIMIT_TRUSTED_PROXY_HOPS` (Default `0`): Anzahl vertrauenswürdiger Proxys
von **rechts** in `X-Forwarded-For`; die echte Client-IP ist das `(1+hops)`-letzte
Element — **nicht** das erste (das wäre spoofbar).

**Am Server verifiziert:** Coolifys Traefik vertraut clientseitigem
`X-Forwarded-For` NICHT — ein Test mit gefälschtem `X-Forwarded-For: 1.2.3.4`
kam beim Backend als reine echte Client-IP an (Traefik ersetzt den Header). Damit
enthält XFF genau **ein** vertrauenswürdiges Element → `hops = 0` (letztes Element).
Käme später eine weitere Proxy-Schicht davor (z. B. Cloudflare), den Wert erhöhen.

### Antwort bei Überschreitung
HTTP **429** + `Retry-After` (Restsekunden des Fensters) + `X-RateLimit-Limit/
-Remaining`. Strukturiertes Log `rate_limited` (bucket/scope/path, **keine PII**).

### Resilienz: fail-open vs. fail-closed (bewusste Entscheidung)
Redis ist primär Cache/Queue, kein harter Auth-Gate. Fällt Redis aus:
- **Normale Endpunkte → fail-OPEN** (Request durchlassen + lautes Log
  `rate_limit_fail_open`). Ein Redis-Ausfall darf nicht ALLE Nutzer aussperren.
- **Sensible Endpunkte (Auth/Payments) → fail-CLOSED** (HTTP 503 + `Retry-After`),
  schaltbar über `RATE_LIMIT_FAIL_CLOSED_SENSITIVE` (Default true). Begründung:
  ein offenes Brute-Force-/Zahlungs-Fenster bei Redis-Ausfall ist gefährlicher als
  eine kurze 503 — die Login-/Payment-Last ist klein genug, dass ein harter Stopp
  vertretbar ist.

### Ausgenommen
`/`, `/health`, alle Slice-`*/health`, `/docs`, `/openapi.json`, `/redoc` —
sonst kippt der Coolify-Healthcheck.

---

## 2. DB-Backpressure (statement_timeout)

Der eigentliche „ein Endpunkt reißt alles mit"-Vektor: eine unbegrenzte Query
hält Connections, bis der Pool leer ist. Die DB-Rollen sind jetzt gedeckelt:

| Rolle | statement_timeout | Quelle |
|---|---|---|
| `anon` | 3 s | Supabase-Default |
| `authenticated` / `authenticator` | 8 s | Supabase-Default |
| `service_role` | **15 s** (+ lock_timeout 8 s) | **Migration 0085** (war vorher unbegrenzt!) |

`service_role` (mit der das Backend u. a. den Listings-Pfad bedient) hatte KEIN
Timeout — Migration `0085_service_role_statement_timeout.sql` schließt das.
Verifiziert: `pg_sleep` über service_role bricht jetzt mit „canceling statement
due to statement timeout" ab. Greift für neue Connections (PostgREST-Pool); ein
PostgREST-Neustart erzwingt es sofort.

**PostgREST-Pool:** 1 PostgREST-Instanz, Pool-Default 10 (`PGRST_DB_POOL`) von
`max_connections=100` der DB — unkritisch. Falls weitere Instanzen/Pooler
hinzukommen, `PGRST_DB_POOL` so wählen, dass `Σ Pools < max_connections` bleibt
(Faustregel ≤ 20 je Instanz). Wert als Coolify-Env, nicht hardcoden.

---

## 3. Edge: Traefik-Rate-Limit für die öffentliche Plattform

Basisschutz gegen Scraper/Lastspitzen **vor** dem Origin (Coolify nutzt Traefik).
Aktuell läuft die Plattform noch unter `*.sslip.io`; die Middleware unten greift
direkt beim Domain-Cutover. Als Coolify-Labels am **Plattform-Service** setzen
(Coolify → Service → Advanced → Custom Labels):

```yaml
# Token-Bucket: 100 req/s im Schnitt, Burst 50, pro echter Client-IP.
# depth=1 = ein vertrauenswürdiger Proxy-Hop (Traefik selbst) in X-Forwarded-For.
- "traefik.http.middlewares.platform-ratelimit.ratelimit.average=100"
- "traefik.http.middlewares.platform-ratelimit.ratelimit.burst=50"
- "traefik.http.middlewares.platform-ratelimit.ratelimit.period=1s"
- "traefik.http.middlewares.platform-ratelimit.ratelimit.sourcecriterion.ipstrategy.depth=1"
# Middleware an den/die Router des Plattform-Service hängen:
- "traefik.http.routers.<platform-router>.middlewares=platform-ratelimit"
```

`<platform-router>` = der von Coolify generierte Router-Name des Plattform-Service
(in den vorhandenen Labels nachsehen). `depth=1` ist wichtig, damit Traefik die
echte Client-IP nimmt und nicht alle Requests unter einer IP zusammenfasst.

> Die Edge-Middleware ergänzt den API-Limiter (Defense-in-Depth): Traefik fängt
> grobe Lastspitzen vor dem Origin ab, der FastAPI-Limiter macht die feine,
> endpunkt-/tenant-genaue Staffelung.

---

## Bewusst offen
- Edge-Limit ist erst nach dem Domain-Cutover (#4) aktiv scharf (heute `*.sslip.io`).
- Kein verteiltes Sliding-Window/Leaky-Bucket — Fixed-Window genügt für den
  Schutzzweck; an Fenstergrenzen ist kurz das doppelte Limit möglich (akzeptiert).
- Tenant-Keying liest die `tenant_id` best-effort aus dem JWT (Fairness, nicht
  Sicherheit); die IP-Grenze ist die harte Sicherheitsschranke.
