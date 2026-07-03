# myNextDays — FastAPI-Backend (apps/api)

Die gesamte Business-Logik als **Vertical-Slice-Architektur**: 24 Slices unter
`src/features/<slice>/` (je `router.py` / `service.py` / `schemas.py` / `tests/`,
Details je Slice im dortigen README), Querschnitt in `src/core/` (Config, Supabase,
Security/JWT, Redis-Rate-Limiting). Vollständige Endpunkt-Referenz: `docs/API.md`;
Architektur & Diagramme: `docs/ARCHITECTURE.md`.

## Start (macht der Entwickler selbst)

```bash
cd apps/api
uv sync
uv run uvicorn src.main:app --reload --port 8000
```

Supabase-Zugang und Secrets über Umgebungsvariablen (siehe `src/core/config.py`
und — vom Repo-Root aus — `deploy/ENVIRONMENT.md`).

## Gates (vor jedem Push)

```bash
uv run ruff check src tests
uv run pylint src            # Ziel: 10.00
uv run pytest
```

## Grundregeln

- Jede Query auf Tenant-Tabellen trägt ein explizites `.eq("tenant_id", …)` —
  das Backend nutzt den Service-Role-Key, der **RLS umgeht**; RLS ist nur Backstop.
- Jede neue public-Tabelle bekommt RLS (default-deny Tenant-Policy) und wird über
  `supabase/apply-migrations.sh` (Repo-Root) eingespielt (nie Migrationen von Hand einzeln).
- Öffentliche Resolver (z.B. `site_config`-public-Router) laufen bewusst über die
  Service-Role und geben nur veröffentlichte/öffentliche Felder heraus.
