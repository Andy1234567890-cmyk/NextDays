# NextDays — Projekt-Spezifikation

> Diese Datei ist die stabile Grundlage (Single Source of Truth) für die Erstellung des NextDays-Projekts. Lies sie zuerst. Live-Session-Status gehört in `NOTES.md`, Architektur-Entscheidungen in `docs/decisions/*.md`.

---

## 1. Was ist NextDays?

NextDays ist eine **weltweite Vacation-Rental-Plattform** mit fairem Pricing (ein Preis, voller Funktionsumfang — keine Paket-/Feature-Stufen). Sie kombiniert **zwei Geschäftsmodelle auf einem gemeinsamen Datenkern**:

1. **Vermieter-Werkzeug (Supply-Seite):** PMS + Channel Manager + Direktbuchungs-Website. Vergleichbar mit .., aber einfacher, fairer, stabiler.
2. **Eigenes Buchungsportal (Demand-Seite):** Ein zweiseitiger Marktplatz, auf dem Gäste Unterkünfte suchen und direkt buchen — vergleichbar mit Booking.com selbst.

**Architektur-Leitsatz:** Das **PMS ist der Kern in der Mitte**. Channel Manager (sync nach außen), Direktbuchungs-Website und das öffentliche Portal (Gäste-Buchungen rein) docken alle an denselben PMS-Datenkern an. Eine Unterkunft hat **einen Multi-Kalender** als einzige Wahrheit → verhindert Double-Bookings über alle Kanäle (eigenes Portal + Booking + Airbnb + Vrbo).

### MVP-Fokus (Phase 1)

Tragfähiger PMS-Kern + Vermieter-Seite (PMS, Objektpflege, Channel-Sync-Grundlage, Direktbuchung). Das **öffentliche Portal wird strukturell vorbereitet**, aber funktional erst in Phase 2 ausgebaut (ein Portal ohne Unterkünfte ist leer → Henne-Ei). Das Datenmodell wird von Anfang an so gebaut, dass beide Seiten darauf passen.

---

## 2. Tech-Stack

| Ebene                  | Technologie                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web-Frontend           | **Next.js** (App Router), TypeScript                                                                                                                                            |
| UI-Komponenten         | **shadcn/ui** (Tailwind-v4-Variante)                                                                                                                                            |
| Styling                | **Tailwind CSS v4** über `@theme` in `globals.css` — **kein** `tailwind.config.ts`                                                                                              |
| Icons                  | **Iconify** (`@iconify/react`) — **niemals** lucide-react direkt, auch nicht in shadcn-Komponenten                                                                              |
| Theming                | **Light + Dark Mode** über CSS-Variablen (`.dark`), via `next-themes`                                                                                                           |
| Backend                | **FastAPI** (Python), Vertical Slice Architecture                                                                                                                               |
| Datenbank/Auth/Storage | **Supabase** (Postgres, Auth, Storage), Multi-Tenant mit Row-Level-Security                                                                                                     |
| Zahlungen              | **Stripe Connect Custom** (primäres Gateway: Mieten, Kautionen, Zusatzleistungen, white-label) · **Revolut** sekundär/konfigurierbar — Gateway-Adapter-Pattern (siehe ADR-0011) |
| Sprachen (nativ)       | **DE / DK / EN** — UI + automatisierte Kommunikation (i18n, siehe ADR-0004)                                                                                                     |
| Währungsdarstellung    | **Glatte Beträge** systemweit, keine Cent-/Øre-Anzeige (siehe ADR-0005)                                                                                                         |
| Mobile-App             | **React Native 0.86** (bare, pnpm) — gleiches FastAPI `/api/v1` + Supabase-JWT wie Web; Tokens in Keychain. Siehe `docs/mobile-integration-plan.md`                             |
| Package Manager (Web)  | **Bun**                                                                                                                                                                         |
| Deployment             | Web → Vercel; API → Hetzner (Coolify); DSGVO-konform, self-hosted bevorzugt                                                                                                     |

### Externe Dienste / APIs

NextDays läuft auf **Hetzner** (FastAPI, self-hosted, DSGVO-konform). Externe APIs werden vom FastAPI-Backend als Dienste aufgerufen — die Datenhoheit bleibt bei uns. Jeder externe Dienst wird in `docs/decisions/` mit Rechtsgrundlage (DSGVO/AVV, DPF/SCC) dokumentiert.

| Dienst                   | Zweck                                                                                                        | Hinweis                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Google Maps / Places** | Adress-Autocomplete & Geocoding (Objekt anlegen → `lat/lng`), Kartenansicht & Umkreissuche (Portal, Phase 2) | Frontend-Key per HTTP-Referrer + API-Restriktion in Google Cloud Console absichern (sonst Fremdkosten). Google ist DPF-zertifiziert. |
| **Google Calendar**      | Optionaler Sync des **persönlichen** Vermieter-Kalenders (private Sperrzeiten)                               | **Nicht** für Kanal-Sync (das machen die Channel-Adapter). Anbindung via iCal-Feed (einfach) oder OAuth (komfortabel).               |
| **Google Translate**     | Mehrsprachige Inhalte (Listings, Nachrichten) für Weltmarkt                                                  | Server-seitig in FastAPI cachen (Übersetzungen persistieren, nicht bei jedem Request neu anfragen → Kosten/Performance).             |

### OCR (eigener Service, Adapter-Pattern)

Zwei Einsatzzwecke mit **unterschiedlicher Datensensibilität** — daher getrennt bewertet:

- **Ausweis-/Pass-Scan (Gast-Check-in, Meldepflicht):** besonders schützenswerte Daten → **self-hosted auf Hetzner** (Tesseract / PaddleOCR im Container; MRZ-Parsing via Open-Source-Lib). Ausweisdaten verlassen **nie** die eigene Infrastruktur. DSGVO-konform und aktives Verkaufsargument ggü. .. ("Gästedaten bleiben in der EU").
- **Rechnungen/Belege (Buchhaltung):** unkritisch → **dieselbe self-hosted Pipeline mitnutzen** (eine OCR-Pipeline, eine DSGVO-Bewertung, keine zusätzliche Abhängigkeit). Cloud-OCR nur erwägen, falls Genauigkeit nicht reicht — dann dokumentierte Einzelfall-Entscheidung.
- Implementierung als **`ocr`-Slice mit Adapter-Interface** (wie Channel Manager): Engines tauschbar, ohne den Rest anzufassen.

### Infrastruktur & Skalierung

- **Start & Dauerbetrieb:** Next.js → Vercel; FastAPI → **Hetzner (Coolify, Docker)**; Supabase als DB/Auth/Storage. DSGVO-konform, self-hosted bevorzugt.
- **Zukunftssicher bauen (kein späterer Rewrite nötig):** FastAPI **containerisiert & zustandslos** (kein lokaler State in der Instanz), DB-Zugriff über **Connection-Pooling**, **Caching-Layer (Redis)** und **Background-Queue** von Anfang an vorgesehen.
- **Skalierung = horizontal:** mehrere zustandslose FastAPI-Container hinter Load Balancer — läuft auf Hetzner genauso wie auf jeder Cloud. **Kein** Lambda/Serverless (passt schlecht zu langlaufendem FastAPI: Cold Starts, DB-Pooling-Probleme).
- **US-Cloud (AWS/GCP/Azure) bewusst vermieden** als Compute-Basis (CLOUD Act) — widerspräche der DSGVO-Positionierung. Falls je nötig: nur EU-Region, als dokumentierte ADR.

### Harte Konventionen (projektweit, nicht verhandelbar)

- **Keine Next.js API-Routes** — alle Business-Logik in FastAPI. Next.js ist reines Frontend (+ Server Components für Rendering).
- **Vertical Slice Architecture** im Backend: pro Feature ein in sich geschlossener Slice (Router + Service + Schemas + Tests).
- **Explizite Pydantic-Typisierung.** Keine `Any`-Schludrigkeit. `SecretStr` für Secrets, niemals als `str`.
- **Kein stilles Exception-Swallowing.** Keine breiten `except: pass`. Fehler werden geloggt und sauber behandelt.
- **Keine optionalen Imports mit None-Fallback** als Workaround.
- **rem** für alle Größen (px nur für Borders ≤2px, SVG-Attribute, Shadow-Offsets ≤2px).
- **Iconify only** — keine hand-codierten SVGs, kein lucide-react.
- **Firebase/DB niemals direkt aus Komponenten** — immer über Service-/API-Layer.
- Git: **niemals direkt auf main** — Feature-Branch → PR → Merge. Pre-Commit: Lint + Tests müssen grün sein.
- Commit-Messages spiegeln den Diff exakt (keine aspirationale Sprache).

---

## 3. Monorepo-Struktur

```
nextdays/
├── PROJECT.md                  # diese Datei (stabil)
├── NOTES.md                   # Live-Session-Status (zuerst lesen bei neuer Session)
├── docs/
│   └── decisions/             # ADRs (Architecture Decision Records)
├── marketing/                 # öffentliche Marketing-/Landing-Website — ENTKOPPELT
│   │                          # eigenständig, NICHT unter apps/. Eigenes Deployment.
│   ├── app/                   # Next.js (App Router) — Landing, Pricing, About, Blog
│   ├── components/
│   ├── public/
│   └── package.json           # eigene Dependencies, eigene CI/CD-Strecke
├── apps/
│   ├── mobile/                # React Native (bare) — Host-App = mobiles Dashboard.
│   │   │                      # Spricht NUR FastAPI /api/v1 (Bearer, Keychain).
│   │   ├── lib/               # api.ts, auth.ts, config.ts (einzige URL-Quelle)
│   │   ├── screens/           # Host*- (echt) und Guest*-Screens (Phase 2)
│   │   └── navigation/        # RoleSelect → HostTabs/GuestTabs
│   ├── web/                   # Next.js — Vermieter-Dashboard (eingeloggt)
│   │   ├── app/
│   │   │   ├── (auth)/        # Login, Registrierung
│   │   │   ├── (dashboard)/   # PMS, Objekte, Kalender, Channel Manager, Buchungen
│   │   │   └── (public)/      # öffentliches Portal (Phase 2: Suche, Listings, Gäste-Buchung)
│   │   ├── components/
│   │   │   └── ui/            # shadcn/ui-Komponenten (Icons auf Iconify umgestellt)
│   │   ├── lib/               # API-Client (ruft FastAPI), Supabase-Client, Utils
│   │   ├── styles/
│   │   │   └── globals.css    # Tailwind v4 @theme — Light + Dark Tokens
│   │   └── ...
│   └── api/                   # FastAPI — gesamte Business-Logik
│       ├── src/
│       │   ├── core/          # Config, Auth, Supabase-Client, Middleware, Logging
│       │   ├── features/      # Vertical Slices (siehe Phase 1)
│       │   └── main.py
│       ├── tests/
│       └── pyproject.toml
└── packages/
    └── shared/                # geteilte TS-Typen (aus Pydantic-Schemas generiert)
```

### Marketing-Website bewusst entkoppelt

Die öffentliche **Marketing-/Landing-Website** (`marketing/`) liegt **außerhalb von
`apps/`** und ist vollständig entkoppelt:

- **Eigenständig deploybar** — eigene `package.json`, eigene CI/CD-Strecke, eigenes
  Vercel-Projekt/Domain (z. B. `nextdays.com`), getrennt vom Produkt
  (`app.nextdays.com`).
- **Keine Kopplung an PMS/Auth** — die Marketing-Seite spricht **nicht** die FastAPI
  oder Supabase an. Rein statisch/SSG, maximale Performance & SEO, kein
  Sicherheits-Surface zum Produkt.
- **Unabhängige Release-Kadenz** — Marketing-Änderungen (Texte, Pricing-Seite,
  Kampagnen) brechen nie das Produkt und umgekehrt.
- **Optional geteilt:** lediglich Design-Tokens/Branding dürfen aus `packages/shared`
  übernommen werden — keine Laufzeit-Abhängigkeit.

> Begründung als ADR: siehe `docs/decisions/0002-marketing-website-entkopplung.md`.

---

## 4. Datenmodell (PMS-Kern) — das Fundament

Alle Tabellen mit **Row-Level-Security**. `tenant_id` (Vermieter-Mandant) auf allen vermieterbezogenen Tabellen.

### Kern-Entitäten

- **tenants** — Vermieter-Mandant (Firma/Person). `id, name, country, currency, created_at`
- **users** — gehören zu einem Tenant. Rollen: `admin | co_admin | owner | staff | cleaner` (granulare Toggle-Matrix, siehe §4-Ergänzung & Lastenheft §4). (Gäste sind separat, siehe unten.)
- **properties** — Unterkünfte. `id, tenant_id, title, description, address, lat, lng, amenities[], max_guests, photos[], status`
- **rate_plans** — Preise/Saison. `id, property_id, name, base_price, currency, min_stay, season_rules(jsonb), weekend_surcharge`
- **availability** — Verfügbarkeit pro Tag. `property_id, date, status(open|booked|blocked), source(direct|booking|airbnb|vrbo|manual)` — **die eine Wahrheit, verhindert Double-Bookings**
- **reservations** — zentrale Buchung, kanalunabhängig. `id, tenant_id, property_id, guest_id, channel(direct|portal|booking|airbnb|vrbo), check_in, check_out, status, total_amount, currency, created_at`
- **guests** — Gastprofile (kanalübergreifend). `id, name, email, phone, history`
- **messages** — zentraler Posteingang. `id, reservation_id, sender, body, channel, created_at`
- **payments** — Zahlungen/Anzahlungen. `id, reservation_id, amount, currency, type(deposit|full|refund), gateway(revolut|stripe), gateway_ref, status`

### Marktplatz-Erweiterung (Phase 2, Modell jetzt vorbereiten)

- **portal_guests** — Gast-Accounts des öffentlichen Portals (Demand-Seite, tenant-übergreifend)
- **reviews** — Bewertungen `property_id, portal_guest_id, rating, text`
- **commissions** — Provisionsabrechnung Plattform↔Vermieter pro Portal-Buchung

---

## 5. Phase-1-Module (Vertical Slices) — alle jetzt anlegen

Jeder Slice in `apps/api/src/features/<name>/` mit `router.py`, `service.py`, `schemas.py`, `tests/`.

1. **auth** — Registrierung, Login, Rollen/Rechte (Supabase Auth), Tenant-Zuordnung. Onboarding schlank/selbsterklärend.
2. **properties** — Unterkunfts-CRUD, Fotos (Supabase Storage), Ausstattung.
3. **rates** — Preis- & Saisonregeln, Mindestaufenthalt, Aufschläge.
4. **calendar** — zentraler Multi-Kalender, Verfügbarkeitslogik, Double-Booking-Schutz.
5. **reservations** — Buchungsverwaltung (kanalunabhängig), Status, Check-in/out.
6. **guests** — Gastprofile, Historie.
7. **inbox** — zentrale Gästekommunikation.
8. **payments** — Zahlungs-Gateway mit Adapter-Pattern: **Stripe Connect Custom primär** (white-label, Anzahlungen, Kautionen, Zusatzleistungen, Belege), **Revolut sekundär** konfigurierbar. Der Zeitpunkt der Weitergabe an den Betrieb hängt an `STRIPE_SEPARATE_TRANSFERS` (Default: sofort per Destination Charge; Ziel: nach Abreise über den `payouts`-Slice). Geldfluss nur für eigene Kanäle (direct/portal) — OTA-Buchungen (booking/airbnb/vrbo) werden bei der OTA bezahlt, kein Stripe. Siehe ADR-0011.
9. **channel_manager** — Sync-Grundlage + Adapter-Pattern pro Kanal:
   - Adapter-Interface (einheitlich), konkrete Adapter: **Booking.com**, **Airbnb**, **Vrbo/Expedia** (über Connectivity-Programme; alternativ Aggregator-Adapter z.B. Feondi).
   - Zwei-Wege-Sync (Verfügbarkeit, Preise, Buchungen), robuste Fehlerbehandlung (Retry, Logging, Alarm).
   - **Architektur-Entscheidung offen** (siehe `docs/decisions/`): Direkt-Anbindung vs. Aggregator. Adapter-Pattern hält beide Wege offen.
10. **booking_engine** — Direktbuchungs-Strecke (provisionsfrei), Buchungs-Widget.
11. **ocr** — OCR-Service mit Adapter-Pattern. Ausweis-/Pass-Scan (Check-in/Meldepflicht) + Belege. Self-hosted (Tesseract/PaddleOCR) bevorzugt. Ausweisdaten bleiben auf Hetzner.
12. **public_portal** _(Struktur jetzt, Logik Phase 2)_ — öffentliche Suche, Listing-Seiten, Gäste-Buchung, Gast-Accounts.

### Zusätzliche Module aus Lastenheft (Roadmap, siehe `docs/REQUIREMENTS-GAP.md`)

13. **tasks** — operatives Aufgaben-/Checklistenmanagement: auto-generierte Aufgaben (Endreinigung/Anreise-Check), wiederkehrende Regeln, Foto-Checklisten, Inventar (auch unterkunftslos).
14. **crm** — Eigentümer-Akquise (Leads, Marketing-Attribution) + Partner/Deals (B2B-Rabatte, QR-Codes).
15. **dashboard** — personalisierbares Dashboard (Drag&Drop-Kacheln, White-Labeling/Logo-Upload).
16. **content** — zentralisierte, dreisprachige Standardtexte (Hausregeln, Check-in/out, Reiseguide), pro Unterkunft/Portfolio zuweisbar.

> Rollen & Berechtigungen, Saison-/Event-Management, Messaging-Trigger, Zählerstände,
> Sperrungs-Workflow und das 8-stufige Onboarding sind Erweiterungen bestehender
> Slices (auth, rates, inbox, properties) — Details in `docs/LASTENHEFT.md`.

### Preisstruktur (Geschäftsmodell, Lastenheft-Ergänzung)

- **All-Inclusive:** kein Feature-Gating, voller Funktionsumfang für alle.
- **0% Buchungsgebühr** im eigenen System (Abgrenzung zu vOffice/..).
- **Skalierung nur über Anzahl verwalteter Unterkünfte** (günstiger Festpreis-Staffel,
  auch bei 10+ Einheiten bezahlbar). Siehe ADR-0006.

### Universelles Unterkunfts-Ökosystem (Cross-Over-SaaS)

Beim Anlegen einer Unterkunft bestimmt ein **Beherbergungs-Typ** (Dropdown) die
dynamisch passenden Checklisten, Shortcodes und Onboarding-Schritte:

- **Ferienhaus / Appartement** — Schlüsselbox, BFE (DK), Endreinigung, Saison-Events.
- **Glamping / Tiny House** — Außenanlagen, Whirlpool/Sauna-Wartung, Brennholz,
  wetterabhängige Sonder-Saisons.
- **Wohnmobilstellplatz / Camping-Pitch** — reduziertes PMS, QR-Check-in,
  Stellplatz-Zuweisung, Schranken-Codes in SMS/E-Mail.
- **Hausboot / Floating Home** — Liegeplatz-Vorschriften, technische Einweisung
  (Fäkalientank, Strom), spezialisierte Handwerker-Kontakte.

Siehe ADR-0007 (Datenmodell: `property_type` + typ-spezifische Felder/Templates).

---

## 6. UI / Theming Setup

### shadcn/ui mit Tailwind v4

- shadcn/ui in der **v4-kompatiblen Variante** initialisieren (CSS-Variablen, **kein** `tailwind.config.ts`).
- Alle Design-Tokens (Farben, Radius, Spacing) als CSS-Variablen im **`@theme`-Block** in `globals.css`.
- Bei jeder generierten shadcn-Komponente: **lucide-react-Imports durch Iconify ersetzen** (`@iconify/react` mit passenden Icon-Sets).

### Light + Dark Mode

- `next-themes` für Mode-Switching (`class`-Strategie, `.dark` auf `<html>`).
- Zwei Token-Sets in `globals.css`: `:root` (Light) und `.dark` (Dark).
- Theme-Toggle-Komponente in der Top-Bar.

### Theme-Tokens (Platzhalter — später durch Jeanines Logo-Farben ersetzen)

```css
@theme {
  /* PLATZHALTER — final: Farben aus Jeanines Logo, dänischer Einschlag */
  --color-primary: #1a5fb4; /* TODO: ersetzen */
  --color-primary-foreground: #ffffff;
  --color-accent: #c01c28; /* TODO: dänischer Akzent */
  --radius: 0.5rem;
}
/* .dark { ... } analog mit dunklen Werten */
```

Design-Prinzip (Jeanines Vorgabe): **„Schweizer Taschenmesser"** — viel Funktion, aber aufgeräumt, einfach, selbsterklärend. Klares Design, dänischer Einschlag darf mitschwingen.

---

## 7. Was zuerst zu tun ist

1. **Monorepo-Gerüst** anlegen (Struktur aus §3), inkl. `PROJECT.md`, `NOTES.md`, `docs/decisions/`.
2. **apps/web**: Next.js (App Router, TS, Bun) + Tailwind v4 (@theme) + shadcn/ui (v4-Variante, Icons auf Iconify) + next-themes (Light/Dark) + Route-Gruppen `(auth)/(dashboard)/(public)`.
3. **apps/api**: FastAPI-Gerüst, `core/` (Config mit SecretStr, Supabase-Client, Logging, Auth-Middleware), leere Vertical Slices für **alle 12 Phase-1-Module** (je `router.py/service.py/schemas.py/tests/`). Caching (Redis) + Background-Queue im Gerüst vorsehen.
4. **Supabase-Migrationen**: alle Kern-Tabellen aus §4 (inkl. RLS-Policies, tenant_id). Marktplatz-Tabellen als vorbereitete Migration.
5. **Erste lauffähige Slice**: `auth` voll implementieren (Registrierung/Login/Tenant/Rollen) als Referenz-Muster für die übrigen Slices.
6. **NOTES.md** mit aktuellem Stand + nächsten Schritten füllen.
7. Pre-Commit-Hooks (Lint + Tests), erste ADR in `docs/decisions/` zur Channel-Manager-Architektur (Direkt vs. Aggregator — offen lassen, Optionen dokumentieren).

### Workflow-Regeln

- **Diff-first → explizite Freigabe → Commit.** Keine blinden Annahmen, bei Unklarheit nachfragen.
- Niemals `flutter run`/Dev-Server selbst starten (macht Andy).
- Feature-Branch → PR → Merge; main bleibt sauber.
