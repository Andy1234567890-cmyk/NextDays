# ADR-0009: Architektur der Taskilo-Integration (Buchhaltung, Marktplatz, HR, Jobs)

- Status: **akzeptiert — Abschnitt 1 (Frontend) revidiert am 2026-09-12**, siehe Nachtrag unten
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

## Nachtrag (2026-09-12): Frontend-Paradigma für die Buchhaltung revidiert

Abschnitt 1 („NextDays-Paradigma erzwingen … nicht 1:1 kopiert, kein
`@tasko/ui`") gilt für die **Buchhaltung nicht mehr**. Der Stand ist eine
1:1-Übernahme des Taskilo-Finanzwerkzeugs mit `@tasko/ui` als Vendor-Alias
(`web/vendor/tasko-ui/`), festgestellt in
[TASKILO-FINANZ-BESTAND-2026-09-11.md](../buchhaltung/TASKILO-FINANZ-BESTAND-2026-09-11.md)
und bereits am 18.06.2026 in [INTEGRATION-TASKILO-BUCHHALTUNG.md](../INTEGRATION-TASKILO-BUCHHALTUNG.md)
§7 als „Strategie REVIDIERT" beschlossen — nur dieser ADR wurde nie
nachgezogen, sodass drei Monate lang zwei gültige, sich widersprechende
Entscheidungen nebeneinander standen.

**Warum revidiert:** Der Neuaufbau „im NextDays-Design" lieferte dünne
Attrappen ohne die GoBD-Logik, Steuerregeln, E-Rechnung und PDF-Vorlagen des
Originals (Beispiel: `buchhaltung/angebote` als 152-Zeilen-Neuentwicklung neben
einem 4 552-Zeilen-Editor mit vollständiger Fachlogik). Fachlich richtig ist
das Original; neu geschrieben wird nur, was dort Attrappe war (DATEV-API,
finAPI ohne Zugang, Validierung „immer true").

**Was weiterhin gilt (und beim Ausbau am 12.09.2026 durchgesetzt wurde):**

- Abschnitte 2–5 unverändert: ein Backend (Slice `buchhaltung`, seit dem
  12.09.2026 in dreizehn Bereiche unter `bereiche/` gegliedert), ins
  NextDays-Supabase gemergt (`tenant_id`, RLS, Finanztabellen server-only nach
  Wurzel 6), eine Sidebar, eine App unter `/buchhaltung/…`.
- Die Übernahme ist 1:1 in Fachlogik und Bedienung, **nicht** in den
  Verstößen des Originals: kein `EUR`-/`19`-Hardcode (Wurzel 4), keine
  `USING (true)`-Policies, kein Zeitstempel als Belegnummer, Nummern vergibt
  der Server (`next_document_number`), Mail nur über `core/mail.py`.
- Die acht Beleg-Editoren des Originals (40 371 Zeilen, Kopien EINES Editors)
  werden als **ein** parametrisierter Editor geführt
  (`web/components/finance/create-invoice/`, Belegart als Konfiguration) —
  das ist die eine Stelle, an der bewusst NICHT 1:1 kopiert wird.
- Alte Pfade (`/api/v1/expenses` …) bleiben im Frontend und werden zentral
  in `web/lib/api-client.ts` (`BUCHHALTUNG_SEGMENTE`) auf
  `/api/v1/buchhaltung/…` abgebildet; dort greift der Modul-Riegel
  (`enabled_modules`, 0572/0633).
- Die Komplexität des Altbestands ist in `web/eslint-suppressions.json`
  eingefroren, nicht geheilt; neue und umgebaute Dateien unterliegen den
  ESLint-Grenzen (complexity 15, max-depth 4, max-lines-per-function 150).
