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

### Geändert (Lastenheft-Scope, Stand 13.05.2026)
- Lastenheft + Ergänzungs-Modul aufgenommen (`docs/LASTENHEFT.md`), Gap-Analyse
  & Roadmap (`docs/REQUIREMENTS-GAP.md`).
- Datenmodell erweitert auf **38 Tabellen** (Migrationen 0009–0015), gegen echte
  Postgres-Instanz verifiziert (alle mit RLS). Neu: Saisons/Events, Aufgaben/
  Checklisten/Inventar, CRM/Partner, Messaging-Trigger, Content-Blöcke,
  Sperrungs-Workflow, Zählerstände (append-only), Miteigentümer, Dashboard-Layouts,
  unit-basiertes Preismodell.
- Rollen-Enum: `+ admin`, `+ co_admin`.
- `properties`: `property_type`-Enum + `type_attributes` (Unterkunfts-Ökosystem),
  Adress-Split, DK-Onboarding-Felder.
- `payments`: `stripe_ref` → `gateway_ref` + `gateway`-Enum; Gateway-Adapter
  (Revolut primär, Stripe sekundär).
- Neue Slices: `tasks`, `crm`, `dashboard`, `content` (Health + Struktur).
- Marketing-Website als entkoppelter Top-Level-Ordner `marketing/` (ADR-0002).
- ADRs 0002–0007 ergänzt.

### Offen
- Frontend (Dashboard, Portale, i18n DE/DK/EN) noch nicht implementiert.
- Slice-Geschäftslogik (außer auth) folgt gemäß Roadmap.
- Revolut/Stripe-Gateway-Calls, Channel-Adapter, OCR noch Platzhalter.
