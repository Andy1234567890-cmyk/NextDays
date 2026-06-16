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

Das spielt alle Migrationen aus `supabase/migrations/` (0001–0019) frisch ein:
Tabellen (41), Enums, Indizes, RLS-Policies und Helper-Funktionen.

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

## Web-Frontend

> Noch nicht eingerichtet — folgt in einem späteren Schritt (siehe [NOTES.md](../NOTES.md)).

```bash
cd apps/web
bun install
bun dev
```

## Troubleshooting

| Symptom | Ursache / Lösung |
|---|---|
| `supabase_key is required` | `.env` nicht gefüllt oder nicht geladen — Keys aus `supabase status` eintragen. |
| API erreicht Supabase nicht (im Container) | `SUPABASE_URL` muss `host.docker.internal` nutzen, nicht `localhost`. |
| Port belegt (54321/8000/6379) | Anderen Stack stoppen oder Ports in `supabase/config.toml` / `docker-compose.yml` anpassen. |
| `StrEnum`-Fehler | Python < 3.11 — auf 3.12 wechseln (`uv python install 3.12`). |
