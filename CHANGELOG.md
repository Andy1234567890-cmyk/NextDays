# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.
Format orientiert an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased] — konsolidierter Stand Juli 2026

Sammelnachtrag: zwischen dem Eintrag unten (Mai 2026, ~Migration 0015) und heute
sind die Migrationen 0016–0090 sowie das komplette Dashboard entstanden. Die
wichtigsten Punkte konsolidiert:

### Hinzugefügt
- **AGB in allen 24 EU-Amtssprachen** (Vorbereitung Stripe-Custom-Genehmigung):
  Agentur-AGB in `apps/web` (öffentliche Route `/agb`, Sprache folgt dem
  App-Sprachumschalter; Inhalte als TS-Module unter `content/legal/agb/`,
  Loader-Map erzwingt Vollständigkeit aller 24 Sprachen zur Build-Zeit) und
  Gast-AGB in `plattform/` (Route `/agb?sprache=<code>` mit Sprachauswahl).
  § 5 verankert das [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full)
  nach Stripes offiziellem Empfehlungstext; der „Zahlungen aktivieren"-Dialog
  und das Signup verlinken AGB + Stripe-Vertrag (`legal`-Namespace in allen
  24 Message-Katalogen). Betreiber-Firmierung ist bewusst Platzhalter —
  vor Veröffentlichung ergänzen; juristische Prüfung ausstehend.
- **Page-Builder** (Migrationen 0086/0087, [ADR-0013](docs/decisions/0013-page-builder-renderer-editor-trennung.md)):
  visueller craft.js-Editor im Dashboard (`apps/web`, Route `/website`),
  neuer API-Slice `site_config` (Branding, Custom-Domains via Cloudflare for
  SaaS, Seiten/Blöcke, Start-Templates, HMAC-Draft-Token) und eigenständige
  Renderer-App `builder/` (Host→Tenant-Middleware, rendert nur veröffentlichte
  Blöcke; Port 3200, eigenes Dockerfile). Spec: `docs/FRAMER-FEATURES.md`.
- **Betriebsart** `tenants.accommodation_type` (`vacation_rental | hotel`,
  Migration 0090): Wahl im 5-Schritte-Onboarding, steuert Sidebar-Navigation
  und Begriffe im Dashboard.
- **Reisebüro-/Partner-Kartei** `travel_agencies` (Migration 0088): Verträge
  nach Jahren, Saison-Preiszeilen, Kontakte, Vertragsdokumente.
- **Verkaufsstopp (Stop-Sell)** mit Channex-Push (Migration 0089, Endpunkte
  `GET/POST /calendar/stop-sell`, `POST /calendar/stop-sell/clear`) inkl.
  Reisebüro als Adressat der Stop-Sale-Meldung.
- **Redis-Rate-Limiting** für die API (`core/ratelimit*.py`, 429 +
  `Retry-After`/`X-RateLimit-*`) — Betrieb: `deploy/RATE-LIMITING.md`.

### Geändert
- **Zahlungs-Gateway: Stripe Connect Custom ist primär** ([ADR-0011](docs/decisions/0011-zahlungs-gateway-stripe-primaer.md),
  ersetzt ADR-0003); Revolut bleibt sekundär im Adapter-Interface.
- **Realtime-Client-Fix** (`apps/web/lib/use-realtime.ts`): dedizierter
  Supabase-Client nur für Realtime, `realtime.setAuth(App-JWT)` **vor**
  `subscribe()` — vorher liefen Subscriptions als `anon` und RLS filterte
  alle Events weg.

---

## [Unreleased] — Stand Mai 2026

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

### Offen (Stand Mai 2026 — inzwischen überholt, siehe konsolidierten Eintrag oben)
- Frontend (Dashboard, Portale, i18n DE/DK/EN) noch nicht implementiert.
- Slice-Geschäftslogik (außer auth) folgt gemäß Roadmap.
- Revolut/Stripe-Gateway-Calls, Channel-Adapter, OCR noch Platzhalter.
