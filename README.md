<div align="center">

# NextDays

**Weltweite Vacation-Rental-Plattform mit fairem Pricing.**
Ein PMS-Kern, der Channel Manager, Direktbuchung und ein eigenes Buchungsportal vereint.

[![Status](https://img.shields.io/badge/status-in%20Entwicklung-orange)](NOTES.md)
[![Backend](https://img.shields.io/badge/backend-FastAPI-009688?logo=fastapi&logoColor=white)](apps/api)
[![Frontend](https://img.shields.io/badge/frontend-Next.js-000000?logo=nextdotjs&logoColor=white)](apps/web)
[![DB](https://img.shields.io/badge/db-Supabase-3FCF8E?logo=supabase&logoColor=white)](supabase)
[![Python](https://img.shields.io/badge/python-3.12+-3776AB?logo=python&logoColor=white)](apps/api/pyproject.toml)
[![License](https://img.shields.io/badge/license-Proprietär-red)](LICENSE)

</div>

---

## Was ist NextDays?

NextDays kombiniert **zwei Geschäftsmodelle auf einem gemeinsamen Datenkern**:

1. **Vermieter-Werkzeug (Supply-Seite)** — PMS + Channel Manager + Direktbuchungs-Website. Vergleichbar mit Lodgify, aber einfacher, fairer, stabiler.
2. **Eigenes Buchungsportal (Demand-Seite)** — ein zweiseitiger Marktplatz, auf dem Gäste Unterkünfte suchen und direkt buchen.

**Architektur-Leitsatz:** Das **PMS ist der Kern in der Mitte**. Channel Manager, Direktbuchung und das öffentliche Portal docken alle an denselben Datenkern an. Eine Unterkunft hat **einen Multi-Kalender** als einzige Wahrheit → verhindert Double-Bookings über alle Kanäle.

> **Fairer Preis:** ein Preis, voller Funktionsumfang — keine Paket- oder Feature-Stufen.

---

## Architektur auf einen Blick

```
                    ┌─────────────────────────────────────┐
   Gäste  ───────►  │           Öffentliches Portal        │  (Phase 2)
                    │        (Suche · Listing · Buchung)    │
                    └───────────────────┬─────────────────┘
                                        │
   Vermieter ─────►  ┌─────────────────▼──────────────────┐
   (Dashboard)       │            PMS-Datenkern             │
                     │  Kalender · Reservierungen · Gäste   │
                     │   Preise · Zahlungen · Posteingang   │
                     └───┬───────────────────────────┬─────┘
                         │                            │
              ┌──────────▼─────────┐      ┌──────────▼──────────┐
              │  Direktbuchung      │      │   Channel Manager   │
              │  (provisionsfrei)   │      │  Booking · Airbnb   │
              └─────────────────────┘      │  Vrbo (Adapter)     │
                                           └─────────────────────┘

   ┌───────────────────────────────────────────────────────────┐
   │  Marketing-Website (entkoppelt, eigenes Deployment)         │
   │  Landing · Pricing · Blog  —  KEINE Kopplung an PMS/Auth    │
   └───────────────────────────────────────────────────────────┘
```

Details: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

---

## Tech-Stack

| Ebene | Technologie |
|---|---|
| Web-Frontend | Next.js (App Router), TypeScript, **Bun** |
| UI | shadcn/ui (Tailwind v4 via `@theme`), **Iconify**, Light/Dark via `next-themes` |
| Backend | **FastAPI** (Python 3.12), Vertical Slice Architecture |
| Datenbank/Auth/Storage | **Supabase** (Postgres, Auth, Storage), Multi-Tenant mit Row-Level-Security |
| Cache & Queue | **Redis** |
| Zahlungen | **Stripe** (Connect für Marktplatz-Auszahlungen) |
| Deployment | Web → Vercel · API → Hetzner (Coolify, Docker) · DSGVO-konform, self-hosted bevorzugt |

---

## Schnellstart

> **Voraussetzungen:** [Bun](https://bun.sh), [uv](https://docs.astral.sh/uv/), Docker, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# 1. Supabase-Stack lokal starten (Postgres, Auth, Storage, Studio)
supabase start

# 2. Migrationen anwenden
supabase db reset

# 3. Backend-Env vorbereiten
cp apps/api/.env.example apps/api/.env   # Werte aus `supabase status` eintragen

# 4. Backend + Redis starten
docker compose up
# → API auf http://localhost:8000 · Docs auf http://localhost:8000/docs
```

Ausführliche Anleitung: **[docs/SETUP.md](docs/SETUP.md)**

---

## Projektstruktur

```
nextdays/
├── PROJECT.md              # verbindliche Spezifikation (zuerst lesen)
├── NOTES.md                # Live-Session-Status
├── docs/
│   ├── ARCHITECTURE.md     # System-Architektur & Datenmodell
│   ├── SETUP.md            # lokales Setup, Schritt für Schritt
│   ├── CONTRIBUTING.md     # Arbeitsweise, Konventionen, Git-Flow
│   ├── API.md              # API-Übersicht (Slices, Endpoints)
│   └── decisions/          # ADRs (Architecture Decision Records)
├── marketing/              # öffentliche Marketing-Website (ENTKOPPELT, eigenes Deployment)
├── apps/
│   ├── web/                # Next.js — Vermieter-Dashboard + Portal
│   └── api/                # FastAPI — gesamte Business-Logik
│       └── src/
│           ├── core/       # Config, Auth, Supabase, Logging
│           └── features/   # Vertical Slices
└── packages/
    └── shared/             # geteilte TS-Typen
```

---

## Stand der Entwicklung

| Bereich | Status |
|---|---|
| Monorepo-Gerüst + Infra (Docker, Supabase-Config) | ✅ |
| FastAPI `core/` (Config, Logging, Supabase, Auth) | ✅ |
| 12 Vertical Slices (Health-Endpoints) | ✅ |
| `auth`-Slice voll (Register/Login/Me/Rollen) | ✅ |
| Supabase-Migrationen (Kern + Marktplatz, RLS) | ✅ geschrieben · ⏳ DB-Verifikation offen |
| Web-Frontend (shadcn/Iconify/Themes) | ⏳ geplant |
| Übrige Slices (properties, calendar, …) | ⏳ geplant |

Aktueller Detail-Stand & nächste Schritte: **[NOTES.md](NOTES.md)**

---

## Dokumentation

- **[PROJECT.md](PROJECT.md)** — verbindliche Spezifikation (Stack, Architektur, Konventionen)
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — System-Aufbau, Datenmodell, RLS
- **[docs/SETUP.md](docs/SETUP.md)** — lokales Entwicklungs-Setup
- **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** — Arbeitsweise & Konventionen
- **[docs/API.md](docs/API.md)** — API-Übersicht
- **[docs/decisions/](docs/decisions/)** — Architecture Decision Records

---

## Lizenz

Proprietär — © NextDays. Alle Rechte vorbehalten. Siehe **[LICENSE](LICENSE)**.
