# Lokales Setup

Schritt-für-Schritt-Anleitung für die lokale Entwicklungsumgebung.

## Voraussetzungen

| Werkzeug | Zweck | Installation |
|---|---|---|
| [Bun](https://bun.sh) | Package Manager (Web) | `curl -fsSL https://bun.sh/install \| bash` |
| [uv](https://docs.astral.sh/uv/) | Python-Paketmanager (API) | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Docker | API + Redis Container | [docker.com](https://www.docker.com/) |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | lokaler Postgres/Auth/Storage-Stack | `brew install supabase/tap/supabase` |
| Python 3.12+ | Backend-Runtime | [python.org](https://www.python.org/) |

## 1. Supabase-Stack starten

Der Supabase-Stack (Postgres, Auth/GoTrue, Storage, Studio, REST-API) läuft
**separat** über die CLI — nicht über `docker-compose.yml` (vermeidet Doppelung
und Port-Konflikte).

```bash
supabase start
```

Das gibt URLs und Keys aus. Merke dir die Ausgabe von:

```bash
supabase status
```

Relevante Werte: `API URL`, `anon key`, `service_role key`, `JWT secret`.

| Dienst | Lokaler Port |
|---|---|
| API (REST) | 54321 |
| Postgres | 54322 |
| Studio (UI) | 54323 |
| Inbucket (Mail-Catcher) | 54324 |

## 2. Migrationen anwenden

```bash
supabase db reset
```

Das spielt alle 90 Migrationen aus `supabase/migrations/` (0001–0090) frisch ein:
Tabellen (101), Enums, Indizes, RLS-Policies und Helper-Funktionen.

> **Produktion:** Auf dem Server laufen Migrationen NICHT automatisch — dort
> immer über `supabase/apply-migrations.sh` einspielen (Tracking in
> `schema_migrations`).

> **Verifikation:** In Studio (http://localhost:54323) sollten alle Kern- und
> Marktplatz-Tabellen sichtbar sein, mit aktivierter RLS.

## 3. Backend konfigurieren

```bash
cp apps/api/.env.example apps/api/.env
```

`apps/api/.env` mit den Werten aus `supabase status` füllen:

```ini
SUPABASE_URL=http://host.docker.internal:54321   # im Container; standalone: localhost
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SUPABASE_JWT_SECRET=<JWT secret>
REDIS_URL=redis://redis:6379/0
```

> Secrets werden im Code als `SecretStr` geladen — **niemals** echte `.env`-Dateien
> committen (durch `.gitignore` abgesichert).

Für das **Kontaktformular** der Marketing-Seite (`/api/v1/contact`) kommen zwei
Gruppen dazu. Fehlt eine davon, antwortet der Endpunkt `503` statt ungeprüft
anzunehmen (Wurzel 4/5):

```ini
# Zwei Postfächer, zwei Zuständigkeiten. Die Zuordnung Thema → Postfach steht im
# Code (features/contact/themen.py), die Adressen hier. Kein Rückfall auf das
# jeweils andere Postfach.
CONTACT_RECIPIENT_GENERAL=info@<DEINE_DOMAIN>
CONTACT_RECIPIENT_TECHNICAL=developer@<DEINE_DOMAIN>

# reCAPTCHA Enterprise (Google Cloud). Schlüssel Typ „Website", Bewertungsart
# score-based; danach die reCAPTCHA-Enterprise-API im Projekt aktivieren und
# einen darauf beschränkten API-Schlüssel anlegen. RECAPTCHA_SITE_KEY ist
# derselbe Wert wie NEXT_PUBLIC_RECAPTCHA_SITE_KEY in marketing.
RECAPTCHA_PROJECT_ID=
RECAPTCHA_API_KEY=
RECAPTCHA_SITE_KEY=
RECAPTCHA_MIN_SCORE=0.5
```

Lokal braucht man keinen davon: `APP_ENV=local` schaltet `captcha_sandbox` ein
(gleiche Bauart wie `mail_sandbox`), das Token wird nur protokolliert. Ausserhalb
von `local` gibt es keine Sandbox aus Versehen — dort entscheidet allein
`CAPTCHA_SANDBOX_OVERRIDE`, Default aus.

## 4. Backend + Redis starten

```bash
docker compose up
```

- API: http://localhost:8000
- Interaktive API-Docs (Swagger): http://localhost:8000/docs
- Health-Check: http://localhost:8000/health

## Alternative: Backend ohne Docker

```bash
cd apps/api
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
# in .env: SUPABASE_URL=http://localhost:54321
uvicorn src.main:app --reload
```

## Tests & Linting

```bash
cd apps/api
uv pip install -e ".[dev]"

pytest            # Unit-Tests (Integration wird übersprungen, wenn Supabase aus)
ruff check src    # Lint (inkl. Security-Regeln)
```

Integration-Tests (Marker `integration`) laufen automatisch mit, sobald der
Supabase-Stack erreichbar ist.

## Web-Frontend (`apps/web` — Dashboard inkl. Website-Editor)

```bash
cd apps/web
bun install
cp .env.example .env.local   # Werte eintragen, siehe Kommentare in der Datei
bun run dev                  # → http://localhost:3000
```

Wichtige Variablen in `.env.local` (Details in `apps/web/.env.example`):

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_API_URL` | FastAPI-Backend (lokal `http://localhost:8000`) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase (Auth/Realtime) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Karten |
| `GOOGLE_FONTS_API_KEY` | **server-only** — Google-Fonts-Katalog im Page-Builder (Proxy `/api/google-fonts`); ohne Key antwortet der Font-Picker mit 503 |

## marketing (`marketing/` — Landingpage, 24 Sprachen)

Eigenständige Next.js-App mit **eigener** `bun.lock`; sie nutzt bewusst KEINE
`@nextdays/*`-Workspace-Pakete (ADR-0016), damit ihr Dockerfile ohne
Root-Kontext baut.

```bash
cd marketing
bun install
bun run dev                  # → http://localhost:3001
```

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_API_URL` | FastAPI-Backend. Gebraucht für Support-Chat, Voranmeldung, Konto-Löschung und **Kontaktformular** — diese drei sprechen DIREKT mit der API, damit deren IP-Rate-Limit die IP des Besuchers sieht. Betrieb: die Marketing-Domain muss in `CORS_ORIGINS` der API stehen. |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Öffentlicher reCAPTCHA-Enterprise-Schlüssel für `/kontakt`. Muss mit `RECAPTCHA_SITE_KEY` der API übereinstimmen, sonst hält Google jedes Token für ungültig. Leer = lokal kein Captcha (die API riegelt über ihre Sandbox ab). |
| `NEXT_PUBLIC_APP_URL` | Dashboard-Adresse. Leer, solange die Plattform nicht öffentlich ist — die Knöpfe lösen dann das Voranmelde-Popup aus statt in ein unbenutzbares Login zu führen. |
| `NEXT_PUBLIC_DEMO_URL` | Vorführ-Zugang („Demo ansehen"), einzeln schaltbar. |
| `NEXT_PUBLIC_STATUS_URL` | Öffentliche Statusseite im Footer. Leer = Eintrag entfällt. |
| `NEXT_PUBLIC_SITE_URL` | Öffentliche Adresse DIESER Seite — Grundlage für `sitemap.xml`, `robots.txt`, `llms.txt` und `metadataBase`. Vorgabe ist die Impressumsadresse (`content/legal/anbieter.ts`); auf Staging setzen, damit die Sitemap nicht Produktions-URLs meldet. |

> **Kein `next build` auf dem Entwicklerrechner** — siehe CLAUDE.md. Geprüft wird
> mit `bunx tsc --noEmit` und `bun run lint`; den Build fährt Coolify.

**Hilfe-Center**: liegt in dieser App (`app/hilfe`), Inhalte als typisierte
TS-Module unter `content/help/<locale>/` (24 Sprachen, gleiche Slugs, nur Texte
übersetzt), Illustrationen in `public/help/illustrations/<kategorie-slug>.svg`.
Es war früher Teil der `web`-App und damit nur über die Dashboard-Domain
erreichbar — obwohl es keinen Login verlangt. Links aus dem Dashboard dorthin
laufen über `web/lib/marketing-url.ts`.

**Suchmaschinen & KI-Assistenten**: `app/sitemap.ts`, `app/robots.ts` und
`app/llms.txt/route.ts` werden aus den Registries (`content/funktionen`,
`content/help`, `content/legal`) erzeugt, nicht von Hand gepflegt — eine
getippte Liste wäre nach dem nächsten Artikel still unvollständig. Alle drei
brauchen `NEXT_PUBLIC_SITE_URL`. Ausgeschlossen sind die Suchergebnisseite und
die Ziele von Einmal-Links aus E-Mails (in Sitemap UND robots.txt).

Neue Icons: `bun run icons` (erzeugt `components/ui/icon-set.ts` aus
`@iconify-json/ph`, nur die tatsächlich verwendeten). Ohne den Lauf ist ein neuer
`ph:*`-Name ein Typfehler.

## builder (`builder/` — White-Label-Site-Renderer)

Eigenständige Next.js-App, die pro Custom-Domain die veröffentlichte
Agentur-Website rendert (Details: [builder/README.md](../builder/README.md)).

```bash
cd builder
bun install
bun run dev                  # → http://localhost:3200
```

`builder/.env.local` (nicht committen):

```ini
NEXT_PUBLIC_SITE_URL=http://localhost:3200
NEXT_PUBLIC_API_URL=http://localhost:8000   # FastAPI (Proxy-Ziel von /api/v1/*)
```

## Storybook (`apps/storybook` — Design-System)

```bash
cd apps/storybook
bun install
bun run storybook            # nur Storybook   → http://localhost:6006
bun run dev                  # mit Auth-Hülle  → http://localhost:6007
```

## Troubleshooting

| Symptom | Ursache / Lösung |
|---|---|
| `supabase_key is required` | `.env` nicht gefüllt oder nicht geladen — Keys aus `supabase status` eintragen. |
| API erreicht Supabase nicht (im Container) | `SUPABASE_URL` muss `host.docker.internal` nutzen, nicht `localhost`. |
| Port belegt (54321/8000/6379) | Anderen Stack stoppen oder Ports in `supabase/config.toml` / `docker-compose.yml` anpassen. |
| `StrEnum`-Fehler | Python < 3.11 — auf 3.12 wechseln (`uv python install 3.12`). |
