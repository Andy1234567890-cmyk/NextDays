# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.
Format orientiert an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Hinzugefügt
- Monorepo-Gerüst (`apps/web`, `apps/api`, `packages/shared`, `docs/`).
- Infrastruktur: `docker-compose.yml` (FastAPI + Redis), `supabase/config.toml`,
  `.env.example`-Vorlagen.
- FastAPI `core/`: Config (`SecretStr`), Logging (structlog), Supabase-Client-Factory
  (Anon + Service-Role), JWT-Sicherheit (HS256 → `AuthContext`, `CurrentUser`).
- 12 Vertical Slices mit `router`/`service`/`schemas`/`tests` und Health-Endpoints
  unter `/api/v1`.
- `auth`-Slice voll: Registrierung (Tenant + Owner, atomar mit Rollback), Login,
  `/me`, `require_role`-Guard.
- Supabase-Migrationen `0001`–`0008`: Kern-Tabellen + Marktplatz-Tabellen (Phase 2),
  Enums, Checks, Indizes, `current_tenant_id()`, RLS auf allen Tabellen,
  `availability` `UNIQUE(property_id, date)` gegen Double-Bookings.
- Vollständige Dokumentation: README, `docs/ARCHITECTURE.md`, `docs/SETUP.md`,
  `docs/CONTRIBUTING.md`, `docs/API.md`, `LICENSE`, `.github/`-Templates.
- ADR-0001: Channel-Manager-Architektur (Direkt vs. Aggregator).

### Offen
- Supabase-Migrationen noch nicht gegen eine laufende DB verifiziert.
- Web-Frontend (shadcn/ui, Iconify, Themes) noch nicht eingerichtet.
- Übrige Slices (properties, calendar, …) noch nicht ausimplementiert.
