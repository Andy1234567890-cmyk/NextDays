# ADR-0009: Architektur der Taskilo-Integration (Buchhaltung, Marktplatz, HR, Jobs)

- Status: **akzeptiert**
- Datum: 2026-06-18

## Kontext

Die NextDays-Plattform wird um den gesamten Geschäftsumfang von
[`taskilo-platform`](https://github.com/Andy54411/taskilo-platform) erweitert
(„My Next"): **Buchhaltung/Finanzen** (153 Komponenten, 9 Backend-Slices,
~26 DB-Tabellen), **Marktplatz** (~110), **HR/Personal** (27), **Career/Jobs/
Recruiting** (23). Insgesamt ~612 Frontend-Komponenten, 242 Routen.
Bestandsaufnahme: [TASKILO-INVENTAR.md](../TASKILO-INVENTAR.md).

**NICHT übernommen:** Chat, Admin-Dashboard, SEO/Marketing, WhatsApp,
Taskilo-Advertising, sowie Taskilos eigene Auth (`auth/`) und Onboarding
(`onboarding/`) — NextDays hat eigene Auth + eigenes Konto-/Tenant-Modell.

Die beiden Codebases folgen **gegensätzlichen Paradigmen**:

| Aspekt      | NextDays (`apps/web`)                                           | Taskilo                                                                                         |
| ----------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Next.js     | 15                                                              | 16                                                                                              |
| React       | 19                                                              | 19                                                                                              |
| Tailwind    | v4                                                              | v4                                                                                              |
| Daten holen | **Server Actions** (`"use server"` in `lib/`)                   | **Client** (`"use client"`, `fetch /api/`, react-query) — 91/119 Finanz-Komponenten sind Client |
| UI-Basis    | eigene `components/ui/*` (shadcn-Stil, Token-basiert)           | `@tasko/ui` + Emotion/styled                                                                    |
| Komponenten | klein, server-first                                             | groß (Ø 486, bis 2763 Zeilen)                                                                   |
| Mandant     | `tenant_id` (Vermieter = Tenant), RLS via `current_tenant_id()` | `company_id` (`companies.owner_id = auth.uid()`)                                                |

## Entscheidung

### 1. Frontend — NextDays-Paradigma erzwingen

Jede übernommene Komponente wird ins **NextDays-Muster überführt**, nicht 1:1
kopiert. Taskilo dient als **Logik- und Design-Vorlage**.

- **Daten:** Server Actions in `apps/web/lib/<domäne>.ts` (`"use server"`, ruft
  FastAPI über `currentToken()`), KEIN react-query, KEINE direkten `/api/`-Calls
  aus Client-Komponenten.
- **UI:** ausschließlich `apps/web/components/ui/*` (shadcn-Stil) + Design-Tokens.
  Kein `@tasko/ui`, kein Emotion/styled.
- **Design:** NextDays-Konventionen — `rem` statt `px` (Borders/SVG/Shadow ≤2px
  ausgenommen), Buttons `rounded-full`, `font-display`, semantische Token-Klassen.
- **Server-first:** Seiten als Server Components; `"use client"` nur für echte
  Interaktivität (Formulare, Wizards, Modals).
- Komponenten landen unter `apps/web/components/<domäne>/` (z. B. `buchhaltung/`,
  `marktplatz/`, `hr/`, `jobs/`).

### 2. Backend — ein Backend, viele Vertical Slices

Alle Taskilo-Funktionen werden als **neue Vertical Slices in `apps/api`**
umgesetzt (gleiche Struktur wie bestehende Slices: `router.py`, `service.py`,
`schemas.py`, `dependencies.py`).

- **EIN** FastAPI-Backend, **EIN** Supabase-Projekt, **EINE** Auth (Supabase-JWT,
  `AuthContext`).
- **Mandant vereinheitlicht:** `company_id` → `tenant_id`; RLS via
  `current_tenant_id()`. `companies`-Stammdaten → `tenants` (+
  `tenant_billing_profile` für firmenspezifische Buchhaltungsfelder).
- Geplante Slices: `buchhaltung` (✅ Basis steht), `tax`, `datev`, `einvoice`,
  `banking` (FinAPI/Revolut), `employees` (HR), `jobs` + `job_applications`,
  `marketplace`.

### 3. Datenbank — ins NextDays-Supabase mergen

Taskilo-Tabellen werden als neue Migrationen (`0023+`) übernommen,
`company_id`→`tenant_id` umgeschrieben, RLS auf `current_tenant_id()` gestellt,
Namenskollisionen (`customers`, `invoices`, `payments`) aufgelöst.
(✅ `0023_buchhaltung_fundament.sql` ist der erste Schritt.)

### 4. Navigation — eine große Sidebar

Alles in **einer** Dashboard-Sidebar (`apps/web/components/app-sidebar.tsx`) mit
aufklappbaren Gruppen. Neue Gruppen: **Buchhaltung**, **Marktplatz**, **HR**,
**Jobs** — zusätzlich zu den bestehenden (Objekte, Kalender, …). Menüpunkte
weiterhin per ..-Berechtigung gegated (UI-Gating, ADR-Permissions).

### 5. URL-Struktur — EINE App, Pfade statt Subdomains

Alle Bereiche unter **einer** App-Domain, getrennt per **Pfad**
(`/dashboard`, `/buchhaltung`, `/marktplatz`, `/hr`, `/jobs`) — **keine**
Feature-Subdomains (`buchhaltung.mynextday.*`, `dashboard.mynextday.*`).
Begründung (Web-Recherche 2026, SaaS-Best-Practice): Feature-Subdomains brechen
die geteilte Auth/Session (`nd_access`-Cookie, Google-OAuth-Whitelist,
Supabase-Session — Wildcards unzuverlässig), erzwingen getrennte Code-Pfade für
dev/staging/prod und erhöhen die Komplexität ohne Nutzen, weil alle Bereiche
denselben Stack + dieselbe Auth + dasselbe Backend teilen. Mandant gehört in den
**Pfad**, nicht in die Subdomain (einfacheres SSL/Org-Switching). Subdomains nur
legitim für die **Trennung Marketing-Website ↔ App** (`mynextday.de` vs.
`app.mynextday.de`) — innerhalb der App dann Pfade.

## Konsequenzen

**Positiv**

- Eine konsistente Architektur, eine Codebase, ein Stack (Next 15/React 19/
  Tailwind v4), ein Backend, ein Mandantenmodell → wartbar, kein Paradigmen-Bruch.
- NextDays-Design durchgängig; keine `@tasko/ui`/Emotion-Altlast.
- Berechtigungs-Gating und Tenant-Isolation gelten automatisch auch für die
  neuen Bereiche.

**Negativ / Aufwand**

- **Hoher Portierungsaufwand:** ~600 Komponenten werden neu geschrieben, nicht
  kopiert. Große Taskilo-Komponenten (Wizards bis 2763 Zeilen) müssen in kleinere
  Server/Client-Teile zerlegt werden.
- Schrittweises Vorgehen nötig: Modul für Modul (DB → Slice → Server Actions →
  UI), jeweils lauffähig + im NextDays-Design.

## Vorgehen (Reihenfolge)

Pro Modul der immer gleiche Vier-Schritt: **(1) DB-Migration** (tenant-vereinheitlicht)
→ **(2) Backend-Slice** → **(3) Server Actions** → **(4) UI im NextDays-Design** →
Doku/Diagramme nachziehen. Start: Buchhaltung (Rechnungen-Basis steht), dann
Kunden, Angebote, Ausgaben, … anschließend HR, Jobs, Marktplatz.
