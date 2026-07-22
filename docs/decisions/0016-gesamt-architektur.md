# ADR-0016: Gesamt-Architektur NextDays — 1 Backend, N Frontends, geteilter Code

- Status: **ANGENOMMEN** (Nutzer-Entscheidung 2026-07-22)
- Datum: 2026-07-22
- Grundlage: 8 Recherche-Agenten, ausschließlich deutschsprachige Quellen
  (heise, innoq, informatik-aktuell, Fraunhofer IESE, predic8, Software
  Architecture Summit, robinwieruch, adesso, miragon, German UPA, goNeuland u. a.)

## ENTSCHEIDUNGEN (Nutzer, 2026-07-22)

1. **Ordner-Struktur:** ALLE Frontends auf Top-Level. `apps/web` → `web/`,
   `apps/storybook` → `storybook/`. `apps/` behält nur `api` (Backend).
2. **Code-Sharing:** Echtes Monorepo-Tooling einführen — **bun-Workspaces**
   (bun ist der Projekt-Standard, schneller als pnpm; 4/6 Frontends nutzen bun
   bereits), `packages/` mit geteiltem Code füllen (currency, laender, api-client,
   types, ui). Duplikation beseitigen (Wurzel 4). `web` (pnpm) + `marketing` (npm)
   werden auf bun umgestellt (Dockerfile + Lockfile).
3. **Reihenfolge:** ERST Architektur sauber (Struktur + Duplikation + Tooling),
   DANN Gastgeber-Dashboard weiterbauen.
4. **Build-Kontext:** Coolify `base_directory` je Frontend-App auf `/` (Repo-Root)
   setzen; die Dockerfiles bauen aus dem Root-Kontext und kopieren den
   Projektordner + `packages/` in den Build. So sehen die Builds die shared
   Workspace-Packages (die außerhalb des Projektordners liegen).

## Migrationspfad (schrittweise, jeder Schritt einzeln verifiziert)

STATUS: Phase 1+2 erledigt (Ordner verschoben, Coolify-Pfade angepasst).

- [x] **P1** `apps/web`→`web/`, `apps/storybook`→`storybook/` (git mv), deploy.yml
      angepasst, tsc grün. `apps/` enthält nur noch `api`.
- [x] **P2** Coolify `base_directory`+`watch_paths` von web/storybook auf
      `/web`,`web/**` bzw. `/storybook`,`storybook/**`.
- [ ] **P3** Root-Workspace: Root-`package.json` mit `workspaces`
      (Frontends Top-Level + `packages/*`), bun als einheitlicher PM. `web`
      (pnpm→bun) + `marketing` (npm→bun) umstellen (Lockfile + Dockerfile).
- [ ] **P4** `packages/` füllen: `packages/currency` (formatCurrency/currencySymbol),
      `packages/laender`, `packages/api-types`. Je eigenes package.json + exports.
- [ ] **P5** Duplikate in web/plattform/gastgeber/marketing/mobile durch Imports
      aus den packages ersetzen (Wurzel 4). Alte Kopien löschen.
- [~] **P6** Root-Build-Kontext-Dockerfile-Muster SERVER-VERIFIZIERT an gastgeber
      (docker build + Container-Start + HTTP 200 auf /anmelden). Verifiziertes
      Muster (siehe gastgeber/Dockerfile):
      - 1 Build-Stage (install+build zusammen — bun legt App-.bin unter
        `<app>/node_modules/.bin` ab, NICHT hoisted; getrennter deps-Stage verliert
        `next`).
      - Minimale Root-`package.json` inline erzeugen (`workspaces:[app,packages/*]`)
        — die volle Root-package.json listet alle Frontends, die im App-Build-
        Kontext fehlen → „Workspace not found".
      - `bun install` (ohne --frozen-lockfile, da minimales Manifest).
      - `WORKDIR /repo/<app>` + `bun run build`.
      - Runtime: KOMPLETTEN `standalone/`-Ordner kopieren (enthält `<app>/server.js`
        + `node_modules` + `package.json`), `CMD ["node","<app>/server.js"]`.
      OFFEN: plattform/web/marketing/storybook auf dieses Muster + Coolify
      `base_directory=/` je App. Je App am Server verifizieren vor Deploy.
- [ ] **P7** Root-Build-Orchestrierung (bun-Workspace-Scripts; Turborepo optional
      später, wenn CI-Caching es rechtfertigt).
- [ ] **P8** Erst danach: Gastgeber-Dashboard weiterbauen.

## Kontext

Das Projekt ist ein Ferienobjekt-/Hotel-Buchungsmarktplatz mit EINEM FastAPI-
Backend und MEHREREN Frontends. Während der Arbeit am Gastgeber-Dashboard sind
mir Architekturfehler passiert (Gastgeber-Bereich falsch als Pfad in die Gast-App
gelegt, veraltetes Proxy-Muster kopiert, generische Ordner-Konvention statt der
Projekt-Regel angenommen). Deshalb: komplette Architektur-Überprüfung, bevor
weitergebaut wird.

## Warum die Fehler passierten (deutsch belegt — Selbstdiagnose)

- LLMs **eliminieren die Reflexions-Pausen**, in denen normalerweise über
  Architektur nachgedacht wird → Bau vor Entscheidung (nevercodealone).
- **Trainingsbias zu den häufigsten/älteren Mustern** → veralteter Proxy blind
  kopiert, generische Defaults reflexartig (virtual7).
- **Der Agent startet jede Session bei null** und weiß nicht, ob hinter einer
  Trennung eine bewusste Entscheidung steckt → Projekt-Regel nicht erkannt
  (wabi-tech).
- Einhelliger deutscher Experten-Konsens: **KI setzt um, der Mensch entscheidet
  die Architektur** (heise). Gegenmaßnahme: ADRs als aktive Leitplanke mit
  „Widerspruchsstopp", Spec/Architektur zuerst, Plan-Gate vor Code.

## Ist-Zustand (faktisch erhoben)

- **Backend:** `apps/api` — FastAPI, Vertical-Slice (`features/<slice>/…`),
  Multi-Tenant, Postgres + RLS. Deploy: Coolify `nextdays-api` + `nextdays-worker`.
- **Frontends:** `plattform/` (Gast-Marktplatz), `marketing/`, `builder/`
  (White-Label), `mobile/` (React Native), `gastgeber/` (neu, Gastgeber-Dashboard)
  — auf Top-Level. `apps/web` (PMS-Dashboard) + `apps/storybook` — noch unter `apps/`.
- **Kein Workspace-Tooling** (kein Turborepo/Nx/pnpm-workspaces). `packages/` leer.
- **Code-Duplikation vorhanden:** `formatCurrency`, `laender.ts`, API-Client-Muster
  mehrfach kopiert (u. a. von mir).
- Deploy: Coolify, je App eigene watch_paths (`marketing/`, `plattform/`,
  `apps/web/`, `apps/storybook/`, `apps/api/`), Traefik-Reverse-Proxy, TLS auto.

## Belegte Ziel-Architektur (Konsens der 8 Agenten)

### Backend — bestätigt korrekt, KEINE Änderung nötig
- **VSA + modularer FastAPI-Monolith** ist der deutsch-belegte Standard für genau
  diese Größe (predic8, Software Architecture Summit, informatik-aktuell, INNOQ).
  „Microservices? Monoliths? Modules!" — Modularisierung zählt, nicht die
  Aufteilung. Ein Deployment, eine RLS-DB, fachliche Slices = modularer Monolith.
- **Shared-DB + RLS** ist für „viele kleine Betriebe" der empfohlene Multi-Tenancy-
  Weg (bayram.solutions, webhosting.de). RLS = Sicherheitsnetz, nicht Ersatz für
  App-Checks; administrative Rollen umgehen RLS (innopulse) — deckt Wurzel 6.
- **Größtes belegtes Risiko: verfallende Slice-Grenzen.** Python hat kein ArchUnit
  → Ersatz nötig: CI-Import-Regeln, die verbotene Cross-Slice-Importe erkennen
  (z. B. `guest_*` darf nicht in `payments.service` importieren). → eigener Auftrag.
- **Shared-DB-Kopplung bewusst auf Lesen begrenzen**, schreibende Cross-Slice-Logik
  zentralisieren (deckt Wurzel 1: `_release_nights` zentral statt inline kopiert).

### Frontends — getrennt je Nutzerwelt (Self-Contained Systems)
- **Mehrere eigenständige Frontends je Nutzerwelt**, vertikal fachlich geschnitten,
  je eigene Subdomain, per Links verbunden — KEIN Micro-Frontend-Runtime-Merging
  (Overkill, it-schulungen.com). Das ist das SCS-Prinzip (innoq, heise): jedes
  System autonom, eigene UI + Logik, eigenständig deploybar.
- **Auth strikt getrennt** (Gast `portal_guests` vs. Tenant), getrennte host-only
  Cookies, getrennte Subdomains (ADR-0015). BFF-Prinzip: Token serverseitig halten
  (heise/Kraus) → kein Token im Browser-JS.

### Backend-Anbindung — Server Components + Server Actions (kein Proxy)
- **Lesen** → Server Component (`cookies()` → Bearer → FastAPI direkt).
- **Schreiben** → Server Action.
- **Route Handler** nur für Login/Logout/Refresh, Webhooks, Uploads.
- Zentraler Data Access Layer (`lib/api-server.ts`). (ADR-0015, deutsch belegt.)

### Geteilter Code — der EINE echte Handlungsbedarf
- **Code-Duplikation ist der Auslöser** (nicht die Projektzahl). Echte fachliche
  Duplikation (API-Client, Typen, `formatCurrency`, `laender`) → **teilen**
  (deckt Wurzel 4: „keine dritte Kopie"). UI-Komponenten differenziert — „Mut zur
  Duplikation", wo Nutzerwelten bewusst unterschiedliche Optik brauchen (andrena).
- **Geteiltes lokales Package** ist der belegte Weg (adesso, miragon). Git-Submodule
  „umständlich und fehleranfällig" (abgeraten). Dauer-Kopieren = Code-Smell.
- **Pragmatische Reihenfolge ohne schweres Tooling:** (1) Design-Tokens zentral
  (JSON + Style Dictionary), (2) internes Package für API-Client/Typen/Currency,
  (3) Storybook als Single Source für UI, (4) *optional später* pnpm-workspaces/
  Turborepo, wenn CI-Skalierung es rechtfertigt.

### Deployment — bestätigt korrekt
- Traefik-Reverse-Proxy, je App eigene Subdomain + auto-TLS (Coolify). Blast-Radius:
  jede App eigener Stack/Container, `restart: unless-stopped`. Grenze: Host-Ausfall
  reißt alle Container mit (goNeuland, heise) — deckt „Worker nie in DB-Stack".

## OFFENE ENTSCHEIDUNGEN (nur der Mensch entscheidet — heise)

Die Recherche empfiehlt formal „alles in `apps/` + Workspaces". Der Nutzer hat
aber die verbindliche Regel gesetzt: **Frontends sind eigenständige Top-Level-
Projekte, NICHT unter `apps/`.** Das SCS-Prinzip stützt diese Autonomie. Zu klären:

1. **Ordner-Struktur:** Bleiben alle Frontends Top-Level (dann `apps/web` +
   `apps/storybook` nach Top-Level ziehen für Konsistenz)? Oder anders?
2. **Code-Sharing:** Wird `packages/` mit geteiltem Code gefüllt (Duplikation
   beseitigen)? Mit oder ohne Workspace-Tooling?
3. **Reihenfolge:** Erst Architektur bereinigen (Struktur + Duplikation), dann
   Gastgeber-Dashboard weiterbauen? Oder Dashboard zuerst?

## Konsequenz (nach Entscheidung)

- Ergänzung in CLAUDE.md: „Architektur-Entscheidungen trifft der Mensch; bei
  Struktur-/Architektur-Fragen erst Plan vorlegen, nicht bauen" (belegt gegen die
  KI-Fehler-Ursachen).
- Bei Widerspruch zu einem ADR: anhalten und vorlegen, nicht still überschreiben
  (wabi-tech „Widerspruchsstopp").
