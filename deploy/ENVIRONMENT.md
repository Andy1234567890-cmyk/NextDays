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

> **Stand 08.08.2026:** `APP_BASE_URL`, `MARKETPLACE_BASE_URL` und die neun
> `COMPANY_*`-Variablen sind in Coolify auf `nextdays-api` **gesetzt** (per API
> geprüft). Coolify reicht Env-Änderungen erst beim **nächsten Deploy** in den
> laufenden Container — bis dahin verschickt die Produktiv-API weiterhin Mails
> mit dem Fußzeilen-Mangelhinweis und lässt Einladungen mit `500` scheitern.
> Ein Redeploy von `nextdays-api` schließt das ab.

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

### SMTP (Mailversand) — eigener Mailcow-Server, siehe [mail/README.md](mail/README.md)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `SMTP_HOST` | Mailcow-Server (`mail.mynextdays.dk`) | nein | Coolify-Env |
| `SMTP_PORT` | 587 (STARTTLS; 25/465 bei Hetzner ausgehend geblockt) | nein | Coolify-Env |
| `SMTP_USER` | echtes Mailcow-Postfach (`info@mynextdays.dk`) | nein | Coolify-Env |
| `SMTP_PASSWORD` | Passwort dieses Postfachs | **ja** | → Passwort-Manager |
| `SMTP_FROM_ADDRESS` | sichtbarer Absender (`info@mynextdays.dk`, **nicht** `noreply@` — Begründung in [mail/README.md](mail/README.md)) | nein | Coolify-Env |
| `SMTP_FROM_NAME` | Anzeigename (`myNextDays`) | nein | Coolify-Env |
| `SMTP_STARTTLS` | `true` (Port 587) vs. impl. TLS (Port 465) | nein | Coolify-Env |
| `MAIL_SANDBOX` | `true` → nur Log, kein Versand (Dev). Prod `false` | nein | Coolify-Env |

> Fehlt `SMTP_HOST` oder `SMTP_FROM_ADDRESS` → Versand deaktiviert (`send()` gibt
> 503, kein stiller Erfolg). Der Mailserver selbst läuft auf einem separaten Host
> (`62.238.4.193`), NICHT im DB-/App-Stack.

### Basis-URLs der Frontends (Ziel der Links in ausgehenden Mails)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `APP_BASE_URL` | PMS-Dashboard `web/` (`https://app.mynextdays.com`). Ziel der Einladungs- und Passwort-Reset-Links für **Betriebs**-Nutzer (0334) | nein | Coolify-Env |
| `ADMIN_BASE_URL` | Plattform-Backoffice `admin/`. Einladungslinks des **Backoffice**-Teams — bewusst getrennt von `APP_BASE_URL` | nein | Coolify-Env |
| `MARKETING_BASE_URL` | Marketing-Seite. Bestätigungs-/Abmeldelinks der Newsletter-Mails | nein | Coolify-Env |
| `MARKETPLACE_BASE_URL` | myBestDays-Marktplatz `plattform/`. Ziel der Bewertungs-Erinnerung an den **Gast** | nein | Coolify-Env |

> Fehlt eine dieser URLs, schlägt der jeweilige Vorgang **klar fehl** (Einladung
> `500`, Newsletter/Erinnerung wird nicht verschickt) — statt einen Link auf eine
> geratene Domain zu verschicken (Wurzel 4).

### Anbieterangaben in der Mail-Fußzeile (`COMPANY_*`)
Pflicht für geschäftliche E-Mails (dän. e-handelslov § 7 / EU-Geschäftsbrief).
Die Werte stehen bewusst in der Umgebung und **nicht** im Code: eine
Registeränderung darf keinen Deploy brauchen. Dieselben Angaben pflegen die
Frontends in `marketing/content/legal/anbieter.ts` — bei einer Änderung **beide**
Stellen nachziehen.

| Variable | Wert | Secret? |
|---|---|---|
| `COMPANY_LEGAL_NAME` | `myNextDays ApS` | nein |
| `COMPANY_LEGAL_FORM` | `Anpartsselskab (ApS) dänischen Rechts` | nein |
| `COMPANY_STREET` | `Hirtshalsvej 21` | nein |
| `COMPANY_CITY` | `9881 Bindslev` | nein |
| `COMPANY_COUNTRY` | `Dänemark` | nein |
| `COMPANY_REGISTRATION_NUMBER` | `46615182` (CVR, rein 8-stellig, ohne `DK`) | nein |
| `COMPANY_VAT_ID` | **bewusst leer** — siehe Hinweis | nein |
| `COMPANY_CONTACT_EMAIL` | `info@mynextdays.dk` | nein |
| `COMPANY_CONTACT_PHONE` | `+45 93 90 39 91` | nein |

> **`COMPANY_VAT_ID` bleibt leer, bis die Momsregistrierung vorliegt.** VIES
> meldete `DK46615182` am 08.08.2026 als ungültig (Kontrollabfrage
> `DK54562519`/Lego A/S → gültig, der Dienst antwortet also korrekt). § 7 verlangt
> die Nummer nur bei bestehender Registrierung; eine nicht erteilte Nummer zu
> veröffentlichen wäre eine falsche Angabe. Sobald die Registrierung da ist:
> hier setzen **und** `ustId` in `marketing/content/legal/anbieter.ts` füllen.

> Fehlt `COMPANY_LEGAL_NAME`, benennt die Mail-Fußzeile den Mangel sichtbar,
> statt eine Adresse zu erfinden oder leer zu bleiben.

### Google OAuth / APIs
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `GOTRUE_EXTERNAL_GOOGLE_ENABLED` | Google-Login an/aus | nein | Coolify-Env |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth-Client-ID | nein | Coolify-Env |
| `GOOGLE_OAUTH_SECRET` | OAuth-Client-Secret | **ja** | → Passwort-Manager |
| `GOOGLE_MAPS_API_KEY` | Maps-API | **ja** | → Passwort-Manager |
| `GOOGLE_TRANSLATE_API_KEY` | Translate-API | **ja** | → Passwort-Manager |

### Zwei-Faktor / Passkeys (GoTrue-MFA)
Die Schreibweise ist **nicht** einheitlich und nicht frei wählbar: die beiden
Enroll/Verify-Schalter heißen `GOTRUE_MFA_WEB_AUTHN_*` (envconfig zerlegt das
Go-Feld `WebAuthn` per `split_words` zu `WEB_AUTHN`), die RP-Variablen dagegen
`GOTRUE_WEBAUTHN_*`. Mit der jeweils falschen Schreibweise startet GoTrue
kommentarlos und lehnt jedes Enrollment mit `422` ab. Belegt in
`deploy/supabase/docker-compose.yml:223-248`.

| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `WEBAUTHN_RP_ID` | Relying-Party-ID = nackte Domain **ohne** Schema. Produktion: `app.mynextdays.com` | nein | Coolify-Env |
| `WEBAUTHN_RP_ORIGINS` | Erlaubte Herkünfte, komma-getrennt, **mit** `https://` (Ausnahme nur localhost). Produktion: `https://app.mynextdays.com` | nein | Coolify-Env |
| `WEBAUTHN_RP_DISPLAY_NAME` | Name im Systemdialog des Geräts (Default `myNextDays`) | nein | Coolify-Env |

**Achtung:** Ein späterer Wechsel der `WEBAUTHN_RP_ID` macht **jeden bereits
registrierten Passkey unbrauchbar** — er ist kryptografisch an genau diese
Domain gebunden. Vor dem ersten produktiven Passkey festlegen (Details:
`docs/OFFENE-PUNKTE.md` 1.3). `mynextdays.dk` ist reiner Mailserver und
kommt hier NICHT vor.

#### SMS-Faktor (`factor_type: phone`)
**Zwei getrennte Systeme, nicht verwechseln.** Die `TWILIO_*`-Variablen im
API-Abschnitt versorgen den **eigenen** OTP-Weg der FastAPI. Der SMS-**Faktor**
läuft dagegen in GoTrue, einem eigenen Prozess mit eigener Konfiguration — die
Werte der API wirken dort **nicht** (Wurzel 7). Fehlt der Block unten, legt
GoTrue den Faktor zwar an (`POST /factors` → `200`), beantwortet aber jede
Challenge mit `500 „Failed to get SMS provider"`: der Nutzer säße in einer
Sackgasse. Live nachgewiesen am 09.08.2026.

| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `GOTRUE_SMS_PROVIDER` | `twilio` — ohne diesen Wert findet GoTrue keinen Anbieter | nein | Compose |
| `GOTRUE_SMS_TWILIO_ACCOUNT_SID` | Twilio-Konto (`AC…`) | nein | Coolify-Env |
| `GOTRUE_SMS_TWILIO_AUTH_TOKEN` | Twilio-Token | **ja** | → Passwort-Manager |
| `GOTRUE_SMS_TWILIO_MESSAGE_SERVICE_SID` | Absender: entweder Messaging-Service-SID (`MG…`) **oder** eine E.164-Nummer — GoTrue reicht den Wert unverändert als Twilios `From` weiter | nein | Coolify-Env |
| `GOTRUE_SMS_OTP_LENGTH` / `GOTRUE_MFA_PHONE_OTP_LENGTH` | Codelänge (6; <6 oder >10 wird auf 6 gezwungen) | nein | Compose |
| `GOTRUE_SMS_OTP_EXP` | Gültigkeit in Sekunden (60) | nein | Compose |
| `GOTRUE_SMS_MAX_FREQUENCY` / `GOTRUE_MFA_PHONE_MAX_FREQUENCY` | Sperrfrist zwischen zwei SMS (`60s`) | nein | Compose |
| `MFA_SMS_AVAILABLE` | **Schalter der Oberfläche.** `true` erst, wenn das Twilio-Konto aufgewertet ist. Default `false` → die UI führt SMS sichtbar als „nicht verfügbar" | nein | Coolify-Env (API) |

**Nicht setzen:** `GOTRUE_SMS_AUTOCONFIRM` (bestätigt Nummern ohne
Zustellnachweis) und `GOTRUE_SMS_TEST_OTP` (ein dauerhaft gültiger Festcode für
die hinterlegten Nummern — und er wirkt ohnehin nur beim Telefon-Login, **nicht**
beim MFA-Faktor).

**Warum `MFA_SMS_AVAILABLE` vorerst `false` bleibt:** Das Twilio-Konto ist ein
**Trial**-Konto. Ein solches sendet ausschließlich an Nummern, die vorher in der
Twilio-Konsole verifiziert wurden (sonst Fehler `21608`), und zwar an höchstens
fünf. Ein Kunde kann seine eigene Nummer dort nicht eintragen — der Faktor wäre
für ihn also unbrauchbar. Zum Freischalten: Twilio-Konto aufwerten, für die
Zielländer die Geo-Permissions setzen (nur in der Konsole möglich, nicht per
API), dann `MFA_SMS_AVAILABLE=true` setzen und die API neu deployen.

### Integrationen (Channex / Stripe / WhatsApp / Groq)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `CHANNEX_API_KEY` | Channel-Manager-API; gilt nur für die Installation aus `CHANNEX_BASE_URL` (Prod-Schlüssel wird einmalig angezeigt, braucht ein aktives Abo) | **ja** | → Passwort-Manager |
| `CHANNEX_BASE_URL` | Channex-Endpoint — Prod `https://app.channex.io/api/v1`, Staging `https://staging.channex.io/api/v1`; getrennte Konten, Schlüssel gelten nur in ihrer Welt (`deploy/CHANNEX-GO-LIVE.md`) | nein | Coolify-Env |
| `CHANNEX_WEBHOOK_SECRET` | Channex-Webhook-Prüf-Secret (geht outbound an Channex — autorisiert NUR den Webhook-Empfang) | **ja** | → Passwort-Manager |
| `INTERNAL_CRON_SECRET` | Eigenes Secret für interne Cron-Endpunkte (recompute/reconcile/auto-run/dispatch); verlässt den Server nie. Leer = Cron-Endpunkte deaktiviert (503) | **ja** | → Passwort-Manager |
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
| `CHANNEX_PROPERTY_BUDGET` | Channex-Budget je Property im Worker für NICHT-ARI-Calls (Content-Sync; Default `20/60`) | nein | Coolify-Env |
| `CHANNEX_ARI_ACCOUNT_BUDGET` | Kontoweites ARI-Budget (Channex-Grenze: 20 ARI/Minute; Default `20/60`) | nein | Coolify-Env |
| `CHANNEX_AVAILABILITY_BUDGET` | ARI-Budget je Property für Availability (Channex-Grenze: 10/Minute; Default `10/60`) | nein | Coolify-Env |
| `CHANNEX_RATES_BUDGET` | ARI-Budget je Property für Restrictions+Preise (Channex-Grenze: 10/Minute; Default `10/60`) | nein | Coolify-Env |

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
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Karten im Objekt-/Reservierungsbereich | nein | Coolify-Env (`is_buildtime`) |
| `NEXT_PUBLIC_BUILDER_URL` | Origin des Seiten-Renderers (`nextdays-builder`). Ziel des Vorschau-iframes im Website-Baukasten UND Quelle der CSP-Direktive `frame-src`. Ohne den Wert zeigt der Baukasten „Vorschau nicht eingerichtet" | nein | Coolify-Env (`is_buildtime`) |
| `GOOGLE_FONTS_API_KEY` | Google-Fonts-Katalog im Page-Builder (server-only, Proxy `/api/google-fonts`; ohne Key → 503 im Font-Picker) | **ja** | → Passwort-Manager |

> `NEXT_PUBLIC_*` sind per Definition öffentlich (Browser-sichtbar) → **kein Secret**,
> müssen aber als **buildtime** gesetzt sein, weil Next.js sie beim Build inlined.
> `GOOGLE_FONTS_API_KEY` hat bewusst **kein** `NEXT_PUBLIC_`-Präfix — er wird nur
> server-seitig in der Proxy-Route gelesen und darf nie ins Browser-Bundle.

> **Die Falle, die hier zweimal zuschlug (24.08.2026).** `is_buildtime` in Coolify
> allein genügt NICHT: der Wert kommt nur an, wenn das Dockerfile ihn auch als
> `ARG` deklariert und an `ENV` weitergibt. In `web/Dockerfile` fehlte dieser
> Block vollständig — mit der Folge, dass KEINE einzige `NEXT_PUBLIC_`-Variable
> im Client-Bundle landete, obwohl alle in Coolify korrekt als buildtime
> markiert waren. Nachweisbar war das von außen: die CSP von
> `app.mynextdays.com` hatte kein `frame-src` (es entsteht nur bei gesetztem
> `NEXT_PUBLIC_BUILDER_URL`), und in keinem der 31 Client-Chunks stand ein
> Supabase-Host. Wer eine neue `NEXT_PUBLIC_`-Variable einführt, muss sie an
> DREI Stellen eintragen: Coolify-Env (buildtime), `ARG`+`ENV` im Dockerfile der
> App, und diese Tabelle.

## App: `nextdays-plattform` (Next.js öffentliche Buchungsplattform)
| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | API-Basis-URL | nein | Coolify-Env (`is_buildtime`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable | nein | Coolify-Env (`is_buildtime`) |
| `NEXT_PUBLIC_SITE_URL` | eigener öffentlicher Origin (Canonical/Sitemap) | nein | Coolify-Env (`is_buildtime`) |
| `NEXT_PUBLIC_GASTGEBER_URL` | Origin von `gastgeber/` (**myBestDays für Gastgeber**), Ziel der Gastgeber-Einstiege. **Nicht** die myNextDays-Domain (andere Marke) und nicht die Plattform selbst | nein | Coolify-Env (`is_buildtime`) |
| `NIXPACKS_NODE_VERSION` | Node-Version | nein | Coolify-Env |

Fehlt `NEXT_PUBLIC_GASTGEBER_URL`, verlinken die „myBestDays für Gastgeber"-Einstiege
auf den relativen Pfad `/anmelden` der Plattform (sichtbar 404) statt still auf eine
geratene Domain — bewusst so, damit die fehlende Variable auffällt (Wurzel 4).

## App: `nextdays-builder` (White-Label-Site-Renderer, `builder/`)

Rendert pro Custom-Domain die veröffentlichte Agentur-Website (siehe
[builder/README.md](../builder/README.md)). Anders als die übrigen Frontends
**kein Nixpacks**, sondern eigenes `builder/Dockerfile` (Multi-Stage, bun-Build,
Next-Standalone unter Node, `HEALTHCHECK` auf `/healthz`; `HOSTNAME=0.0.0.0` ist
bereits im Image gesetzt). Coolify-`base_directory` ist `builder/`. Die
Cloudflare-Custom-Hostnames (`CLOUDFLARE_FALLBACK_ORIGIN`, s. o.) zeigen auf
diese App.

**Angelegt am 24.08.2026** (`lx65cb93ivz5il1suejtaz7g`), Bauart wie
`nextdays-web`: `build_pack=dockerfile`, `base_directory=/`,
`dockerfile_location=/builder/Dockerfile`. Der Root-Kontext ist Pflicht, nicht
Geschmack — `builder/package.json` führt `@nextdays/currency` und
`@nextdays/security-headers` als `workspace:*`; mit `builder/` als Kontext gäbe
es kein `packages/` und `bun install` scheitert. Das alte Dockerfile hatte genau
diesen engen Kontext samt `--frozen-lockfile` gegen ein `builder/bun.lock` ohne
einen einzigen `workspace:`-Eintrag; es war also nicht baubar, was niemandem
auffiel, weil es keine Coolify-Resource gab. Angelegt wird die App mit
`deploy/coolify/builder-app-anlegen.php`, die Variablen mit
`deploy/coolify/builder-env-setzen.php` (beide idempotent).

Erreichbar zunächst über den Coolify-Host
`https://lx65cb93ivz5il1suejtaz7g.65.21.144.136.sslip.io` — der braucht keinen
DNS-Eintrag, und die Vorschau im Baukasten läuft damit sofort. Eine eigene
Subdomain kommt später DAZU, nicht an seine Stelle (wie `nextdays-web`, das
beide führt).

| Variable | Zweck | Secret? | Quelle |
|---|---|---|---|
| `DASHBOARD_ORIGIN` | Origin des Dashboards (`https://app.mynextdays.com`) — NUR von dort darf `/render/*` per iframe eingebettet werden. **Muss buildtime sein**, obwohl ohne `NEXT_PUBLIC_`-Präfix: `next.config.ts` liest es in `headers()`, und `next build` friert die Kopfzeilen in `routes-manifest.json` ein. Fehlt es, steht `frame-ancestors 'none'` im Image und die Vorschau bleibt leer — **ohne jede Meldung**, nur als CSP-Zeile in der Browser-Konsole | nein | Coolify-Env (`is_buildtime`) |
| `NEXT_PUBLIC_API_URL` | FastAPI-Backend (Ziel des `/api/v1`-Proxys). Rückfall ist `http://localhost:8000` und zeigt im Container ins Nichts: jede Kunden-Domain endet dann bei „nicht eingerichtet" | nein | Coolify-Env (`is_buildtime`) |

`NEXT_PUBLIC_SITE_URL` stand hier früher — der Wert wird im Code **nirgends
gelesen** (vollständiger Grep über `builder/`). Eintrag entfernt, statt eine
Variable zu dokumentieren, die niemand braucht.

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
