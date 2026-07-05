# Env-Inventar — NextDays (nur NAMEN, keine Werte)

Checkliste für den Wiederaufbau (siehe [RECOVERY.md](RECOVERY.md)). **Keine Secret-
Werte hier** — Secrets liegen ausschließlich in Andys Passwort-Manager und in der
verschlüsselten Coolify-Config-Sicherung. Diese Datei sagt nur, **welche** Variablen
**wo** gesetzt sein müssen und **ob** sie geheim sind.

- **Secret? = ja** → Wert NUR aus Passwort-Manager (Andy) / Coolify-Backup, nie ins Repo.
- **Quelle:** `Coolify-Env` = im Coolify-UI je App gesetzt; `Compose-Default` = hat
  einen unkritischen Default in der Compose-Datei; `generiert` = beim Setup einmalig
  erzeugt (z. B. JWT/Keys).

> Erhoben aus den `deploy/`-Compose-Dateien **und** der echten Coolify-DB
> (`environment_variables`) am 2026-06-30. 6 Coolify-Apps: `nextdays-supabase`,
> `-web`, `-plattform`, `-storybook`, `-marketing`, `-kong`.

---

## App: `nextdays-supabase` (FastAPI-API + kompletter Supabase-Stack + Redis)

### Kern / Supabase
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `APP_ENV` | App-Umgebung (`production`) | nein | Coolify-Env |
| `LOG_LEVEL` | Log-Level | nein | Coolify-Env |
| `DATA_ROOT` | Volume-Basispfad (`/mnt/HC_Volume_…/nextdays`) | nein | Coolify-Env |
| `POSTGRES_DB` | DB-Name (`postgres`) | nein | Coolify-Env |
| `POSTGRES_PASSWORD` | Postgres-Superuser-Passwort | **ja** | → Passwort-Manager |
| `JWT_SECRET` | Supabase-JWT-Signaturschlüssel (ES256/HS256) | **ja** | → Passwort-Manager (generiert) |
| `JWT_EXPIRY` | Token-Gültigkeit | nein | Coolify-Env |
| `ANON_KEY` | Supabase anon-Key (signiert mit JWT_SECRET) | **ja** | → Passwort-Manager (generiert) |
| `SERVICE_ROLE_KEY` | Supabase service-role-Key (umgeht RLS) | **ja** | → Passwort-Manager (generiert) |
| `SECRET_KEY_BASE` | Realtime/Phoenix Secret | **ja** | → Passwort-Manager |
| `REALTIME_ENC_KEY` | Realtime-Verschlüsselung | **ja** | → Passwort-Manager |
| `VAULT_ENC_KEY` | Supabase-Vault-Verschlüsselung | **ja** | → Passwort-Manager |
| `DASHBOARD_USERNAME` | Supabase-Studio Basic-Auth User | nein | Coolify-Env |
| `DASHBOARD_PASSWORD` | Supabase-Studio Basic-Auth Passwort | **ja** | → Passwort-Manager |
| `SITE_URL` / `API_EXTERNAL_URL` | öffentliche URLs (GoTrue/Studio) | nein | Coolify-Env |
| `ADDITIONAL_REDIRECT_URLS` | OAuth-Redirects | nein | Coolify-Env |
| `DISABLE_SIGNUP` | Self-Signup aus | nein | Coolify-Env |
| `MAILER_AUTOCONFIRM` | Mail-Autoconfirm | nein | Coolify-Env |
| `POOLER_TENANT_ID` / `POOLER_DEFAULT_POOL_SIZE` / `POOLER_MAX_CLIENT_CONN` | Supavisor-Pooler | nein | Coolify-Env |
| `KONG_DOMAIN` | Kong-Domain | nein | Coolify-Env |
| `SERVICE_FQDN_*` / `SERVICE_URL_*` (API/KONG) | Coolify-interne Service-FQDNs | nein | Coolify (auto) |

### Redis
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `REDIS_URL` | Redis-Verbindung inkl. Passwort | **ja** | → Passwort-Manager |
| `REDIS_PASSWORD` | Redis-Passwort (AOF-Persistenz an) | **ja** | → Passwort-Manager |

### SMTP (Mailversand)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_SENDER_NAME` / `SMTP_ADMIN_EMAIL` | SMTP-Konfig | nein | Coolify-Env |
| `SMTP_PASS` | SMTP-Passwort | **ja** | → Passwort-Manager |

### Google OAuth / APIs
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `GOTRUE_EXTERNAL_GOOGLE_ENABLED` | Google-Login an/aus | nein | Coolify-Env |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth-Client-ID | nein | Coolify-Env |
| `GOOGLE_OAUTH_SECRET` | OAuth-Client-Secret | **ja** | → Passwort-Manager |
| `GOOGLE_MAPS_API_KEY` | Maps-API | **ja** | → Passwort-Manager |
| `GOOGLE_TRANSLATE_API_KEY` | Translate-API | **ja** | → Passwort-Manager |

### Integrationen (Channex / Stripe / WhatsApp / Groq)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `CHANNEX_API_KEY` | Channel-Manager-API | **ja** | → Passwort-Manager |
| `CHANNEX_BASE_URL` | Channex-Endpoint | nein | Coolify-Env |
| `CHANNEX_WEBHOOK_SECRET` | Channex-Webhook-Prüf-Secret | **ja** | → Passwort-Manager |
| `CHANNEX_SANDBOX_PORTALS` | Sandbox-Kanäle (Prod=false) | nein | Coolify-Env |
| `STRIPE_SECRET_KEY` | Stripe-Secret | **ja** | → Passwort-Manager |
| `STRIPE_WEBHOOK_SECRET` | Stripe-Webhook-Signatur | **ja** | → Passwort-Manager |
| `STRIPE_PLATFORM_FEE_PCT` | Plattform-Provision (%) | nein | Coolify-Env |
| `GROQ_API_KEY` | KI-Antwortvorschläge | **ja** | → Passwort-Manager |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp-Nummer-ID | nein | Coolify-Env |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp-Webhook-Verify | **ja** | → Passwort-Manager |
| `WHATSAPP_GRAPH_VERSION` | Graph-API-Version | nein | Coolify-Env |
| `WHATSAPP_DEFAULT_TENANT_ID` | Default-Tenant für neue Nummern | nein | Coolify-Env |
| `PUBLIC_API_URL` | öffentliche API-URL (Webhook-Callbacks) | nein | Coolify-Env |
| `CORS_ORIGINS` | erlaubte Frontend-Origins | nein | Coolify-Env |
| `UVICORN_WORKERS` | API-Worker-Anzahl (Default 4, 8-Kern-Server) | nein | Coolify-Env |
| `PGRST_DB_POOL` | PostgREST-Connection-Pool (Default 25; Σ Pools < max_connections 100) | nein | Coolify-Env |
| `WORKER_CONCURRENCY` | Parallel-Jobs je Worker-Prozess (Default 4) | nein | Coolify-Env |
| `CHANNEX_ACCOUNT_BUDGET` | Kontoweites Channex-Anfrage-Budget im Worker (Default `200/60`) | nein | Coolify-Env |
| `CHANNEX_PROPERTY_BUDGET` | Channex-Budget je Property im Worker (Default `20/60`) | nein | Coolify-Env |

### Page-Builder (`site_config`-Slice)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `SITE_DRAFT_SECRET` | HMAC-Signatur der Draft-Vorschau-Tokens (unveröffentlichte Seiten, TTL 1 h) | **ja** | → Passwort-Manager (generiert) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare for SaaS — Custom Hostnames anlegen/syncen (TLS für Agentur-Domains) | **ja** | → Passwort-Manager |
| `CLOUDFLARE_ZONE_ID` | Cloudflare-Zone für die Custom Hostnames | nein | Coolify-Env |
| `CLOUDFLARE_FALLBACK_ORIGIN` | Fallback-Origin, auf den Custom Hostnames zeigen (builder-App) | nein | Coolify-Env |
| `CLOUDFLARE_BASE_URL` | Cloudflare-API-Endpoint (Default `https://api.cloudflare.com/client/v4`) | nein | Compose-Default |

> Ohne `CLOUDFLARE_*`-Konfiguration antworten die Domain-Endpunkte des
> `site_config`-Slices mit 503 (bewusst kein stiller Fallback).

### Medien-Storage (Hetzner Object Storage, S3) — siehe [storage/README.md](storage/README.md)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `STORAGE_BACKEND` | `file` oder `s3` | nein | Coolify-Env |
| `STORAGE_S3_ENDPOINT` / `STORAGE_S3_REGION` / `STORAGE_S3_BUCKET` | S3-Ziel | nein | Coolify-Env |
| `STORAGE_S3_FORCE_PATH_STYLE` | Path-Style-Flag | nein | Coolify-Env |
| `AWS_ACCESS_KEY_ID` | S3-Access-Key | **ja** | → Passwort-Manager |
| `AWS_SECRET_ACCESS_KEY` | S3-Secret-Key | **ja** | → Passwort-Manager |

### Rate-Limiting (optional, Defaults im Code) — siehe [RATE-LIMITING.md](RATE-LIMITING.md)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `RATE_LIMIT_*` (ENABLED/DEFAULT/AUTH/PAYMENTS/LISTINGS/TENANT/TRUSTED_PROXY_HOPS/FAIL_CLOSED_SENSITIVE) | Rate-Limit-Staffelung | nein | Coolify-Env (optional) |

---

## App: `nextdays-web` (Next.js Dashboard, standalone)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `HOSTNAME` | **muss `0.0.0.0`** (Next-standalone bindet sonst nur localhost) | nein | Coolify-Env |
| `NODE_ENV` | `production` | nein | Coolify-Env |
| `NIXPACKS_NODE_VERSION` | Node-Version (Build) | nein | Coolify-Env |
| `NEXT_PUBLIC_API_URL` | API-Basis-URL (Build-time inlined) | nein | Coolify-Env (`is_buildtime`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-URL (öffentlich) | nein | Coolify-Env (`is_buildtime`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon/publishable Key (öffentlich) | nein | Coolify-Env (`is_buildtime`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable (öffentlich) | nein | Coolify-Env (`is_buildtime`) |
| `GOOGLE_FONTS_API_KEY` | Google-Fonts-Katalog im Page-Builder (server-only, Proxy `/api/google-fonts`; ohne Key → 503 im Font-Picker) | **ja** | → Passwort-Manager |

> `NEXT_PUBLIC_*` sind per Definition öffentlich (Browser-sichtbar) → **kein Secret**,
> müssen aber als **buildtime** gesetzt sein, weil Next.js sie beim Build inlined.
> `GOOGLE_FONTS_API_KEY` hat bewusst **kein** `NEXT_PUBLIC_`-Präfix — er wird nur
> server-seitig in der Proxy-Route gelesen und darf nie ins Browser-Bundle.

## App: `nextdays-plattform` (Next.js öffentliche Buchungsplattform)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | API-Basis-URL | nein | Coolify-Env (`is_buildtime`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable | nein | Coolify-Env (`is_buildtime`) |
| `NIXPACKS_NODE_VERSION` | Node-Version | nein | Coolify-Env |

## App: `nextdays-builder` (White-Label-Site-Renderer, `builder/`)

Rendert pro Custom-Domain die veröffentlichte Agentur-Website (siehe
[builder/README.md](../builder/README.md)). Anders als die übrigen Frontends
**kein Nixpacks**, sondern eigenes `builder/Dockerfile` (Multi-Stage, bun-Build,
Next-Standalone unter Node, `HEALTHCHECK` auf `/healthz`; `HOSTNAME=0.0.0.0` ist
bereits im Image gesetzt). Coolify-`base_directory` ist `builder/`. Die
Cloudflare-Custom-Hostnames (`CLOUDFLARE_FALLBACK_ORIGIN`, s. o.) zeigen auf
diese App. Stand der Erhebung (2026-06-30) noch nicht als Coolify-App angelegt.

| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | eigener öffentlicher Origin der builder-App | nein | Coolify-Env (`is_buildtime`) |
| `NEXT_PUBLIC_API_URL` | FastAPI-Backend (Ziel des `/api/v1`-Proxys) | nein | Coolify-Env (`is_buildtime`) |

## App: `nextdays-storybook` (Komponenten-Doku)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | öffentliche Supabase-Refs | nein | Coolify-Env |
| `NIXPACKS_NODE_VERSION` | Node-Version | nein | Coolify-Env |

## App: `nextdays-marketing` (Marketing-Site)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `NIXPACKS_NODE_VERSION` | Node-Version | nein | Coolify-Env |

## App: `nextdays-kong` (Kong-Gateway, Supabase-Edge)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `ANON_KEY` | Supabase anon-Key (= supabase-Stack) | **ja** | → Passwort-Manager |
| `SERVICE_ROLE_KEY` | Supabase service-role-Key | **ja** | → Passwort-Manager |
| `SERVICE_FQDN_KONG` / `SERVICE_URL_KONG` | Kong-FQDN | nein | Coolify (auto) |

---

## Coolify-Instanz selbst — `/data/coolify/source/.env` (NICHT in der App-Env!)
Diese Datei ist die Identität der Coolify-Instanz. **Kritisch fürs Recovery** —
ohne `APP_KEY` sind die in der Coolify-DB **verschlüsselt** gespeicherten App-Secrets
nach einem Restore **unlesbar**. Siehe [RECOVERY.md](RECOVERY.md) Schritt 3.

| Variable | Zweck | Secret? |
|---|---|---|
| `APP_KEY` | **Laravel-Schlüssel — entschlüsselt ALLE Coolify-Secrets.** Ohne ihn ist ein DB-Backup wertlos. | **ja, kritisch** |
| `DB_USERNAME` / `DB_PASSWORD` | Coolify-interne Postgres | **ja** |
| `REDIS_PASSWORD` | Coolify-interner Redis | **ja** |
| `PUSHER_APP_ID` / `PUSHER_APP_KEY` / `PUSHER_APP_SECRET` | Coolify-Realtime | **ja** |
| `ROOT_USERNAME` / `ROOT_USER_EMAIL` / `ROOT_USER_PASSWORD` | Coolify-Admin-Login | **ja** |
| `APP_ID` / `APP_NAME` / `REGISTRY_URL` / `DOCKER_ADDRESS_POOL_BASE` / `DOCKER_ADDRESS_POOL_SIZE` | Instanz-Metadaten | nein |
