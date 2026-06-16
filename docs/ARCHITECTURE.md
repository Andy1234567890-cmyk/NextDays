# Architektur

> Verbindliche Grundlage: **[PROJECT.md](../PROJECT.md)**. Dieses Dokument erläutert
> die Architektur mit Diagrammen und beschreibt den **tatsächlich umgesetzten** Stand.
>
> **Notation:** [C4-Modell](https://c4model.com) (System Context · Container · Component)
> + ergänzende ER-, Sequenz-, State- und Deployment-Diagramme. Alle Diagramme sind als
> Mermaid (Diagrams-as-Code) eingebettet und werden von GitHub nativ gerendert.

## Inhalt

1. [Leitidee](#1-leitidee-pms-kern-in-der-mitte)
2. [System Context (C4 Level 1)](#2-system-context-c4-level-1)
3. [Container (C4 Level 2)](#3-container-c4-level-2)
4. [Component: Channel Manager (C4 Level 3)](#4-component-channel-manager-c4-level-3)
5. [Datenmodell (ER-Diagramm)](#5-datenmodell-er-diagramm)
6. [Mandantenfähigkeit & RLS](#6-mandantenfähigkeit--rls)
7. [Kritische Flows (Sequenzdiagramme)](#7-kritische-flows-sequenzdiagramme)
8. [Reservierungs-Lifecycle (State)](#8-reservierungs-lifecycle-state)
9. [Deployment & Skalierung](#9-deployment--skalierung)
10. [Backend-Aufbau (Vertical Slices)](#10-backend-aufbau-vertical-slices)

---

## 1. Leitidee: PMS-Kern in der Mitte

NextDays ist kein loses Bündel aus Tools, sondern **ein Datenkern**, an den alle
Kanäle andocken. Der gemeinsame Nenner ist die **`availability`-Tabelle**: eine Zeile
pro `(property_id, date)` mit `UNIQUE`-Constraint — die *eine Wahrheit* und der
strukturelle Schutz gegen Double-Bookings über alle Kanäle hinweg.

---

## 2. System Context (C4 Level 1)

Wer nutzt NextDays, und mit welchen externen Systemen spricht es?

```mermaid
C4Context
    title System Context — NextDays

    Person(landlord, "Vermieter", "Pflegt Objekte, Preise, Kalender, Buchungen")
    Person(guest, "Gast", "Sucht und bucht Unterkunft")

    System_Boundary(nd, "NextDays Platform") {
        System(pms, "PMS Core", "Zentraler Datenkern: Kalender, Buchungen, Mandanten, Zahlungen")
    }

    System_Ext(booking, "Booking.com", "OTA-Kanal")
    System_Ext(airbnb, "Airbnb", "OTA-Kanal")
    System_Ext(vrbo, "Vrbo / Expedia", "OTA-Kanal")
    System_Ext(revolut, "Revolut Business", "Zahlungen (primär)")
    System_Ext(stripe, "Stripe", "Zahlungen (sekundär)")
    System_Ext(google, "Google APIs", "Maps/Places, Translate")

    Rel(landlord, pms, "Verwaltet Listings, Raten, Kalender")
    Rel(guest, pms, "Bucht direkt (Portal/Widget)")
    Rel(pms, booking, "Zwei-Wege-Sync", "Connectivity API")
    Rel(pms, airbnb, "Zwei-Wege-Sync", "Partner API / Webhooks")
    Rel(pms, vrbo, "Zwei-Wege-Sync", "API")
    Rel(pms, revolut, "Zahlungen, Kautionen", "HTTPS/API")
    Rel(pms, stripe, "Zahlungen (Fallback)", "HTTPS/API")
    Rel(pms, google, "Geocoding, Übersetzung", "HTTPS/API")
```

---

## 3. Container (C4 Level 2)

Die ausführbaren Bausteine und Datastores des Systems, mit Technologie und Protokoll.

```mermaid
C4Container
    title Container — NextDays

    Person(landlord, "Vermieter", "Nutzt das Dashboard")
    Person(guest, "Gast", "Bucht über Portal/Widget")

    Container_Boundary(nd, "NextDays") {
        Container(marketing, "Marketing-Website", "Next.js (entkoppelt)", "Landing/Pricing/Blog — KEINE PMS/Auth-Kopplung (ADR-0002)")
        Container(web, "Web Dashboard", "Next.js, TypeScript", "Vermieter-PMS-UI + Portale (Vercel)")
        Container(storybook, "Storybook", "react-vite", "Komponenten-Doku + Design-System (ADR-0008), Light/Dark, Token-Übersicht")
        Container(api, "API Backend", "FastAPI, Python", "Business-Logik, 16 Vertical Slices unter /api/v1")
        ContainerDb(db, "Datenbank", "Supabase / Postgres", "41 Tabellen, Multi-Tenant, RLS, tenant_id")
        ContainerDb(cache, "Cache", "Redis", "Caching-Layer")
        ContainerQueue(queue, "Background Queue", "Redis / Worker", "Channel-Sync, OCR, Messaging-Trigger, wiederkehrende Aufgaben")
    }

    System_Ext(revolut, "Revolut", "Zahlungen (primär)")
    System_Ext(stripe, "Stripe", "Zahlungen (sekundär)")
    System_Ext(booking, "Booking.com", "OTA")
    System_Ext(google, "Google APIs", "Maps/Translate")

    Rel(landlord, web, "Nutzt", "HTTPS")
    Rel(guest, web, "Bucht", "HTTPS")
    Rel(web, storybook, "teilt Komponenten/Tokens", "Build-Zeit")
    Rel(web, api, "Ruft auf", "JSON/HTTPS")
    Rel(api, db, "Liest/schreibt", "SQL (RLS)")
    Rel(api, cache, "Liest/schreibt", "Redis-Protokoll")
    Rel(api, queue, "Reiht Jobs ein", "Redis")
    Rel(queue, booking, "ARI-Push / Reservierungs-Poll", "Connectivity API")
    Rel(api, revolut, "Charges, Kautionen", "API")
    Rel(api, stripe, "Charges (Fallback)", "API")
    Rel(api, google, "Geocoding, Übersetzung", "API")
```

> **Hinweis zur C4-Notation:** „Container" meint hier eine *separat ausführbare App
> oder einen Datastore* (Next.js, FastAPI, Postgres, Redis) — nicht zwingend einen
> Docker-Container. Die Marketing-Website ist bewusst entkoppelt (eigenes Deployment).

### Slice-Landkarte (Component-Ebene, API-Backend)

Die 16 Vertical Slices und ihre Datenbereiche — der Stand der Geschäftslogik:

```mermaid
flowchart TB
    subgraph API["API Backend (FastAPI) — /api/v1"]
        subgraph CORE["core/ (Querschnitt)"]
            CFG["config · logging · supabase · security (JWT ES256/JWKS)"]
        end
        subgraph DONE["Slices mit Logik"]
            AUTH["auth — Register/Login/Me/Invite, Rollen+Capability-Matrix"]
            CAL["calendar — Verfügbarkeit, Double-Booking, Preis-Override"]
            TASKS["tasks — Aufgaben, Checklisten+Foto, Vertretung, Inventar"]
        end
        subgraph SCAFFOLD["Slices als Gerüst (Health) — folgen lt. Roadmap"]
            PROP["properties"]; RATES["rates"]; RES["reservations"]
            GUE["guests"]; INBOX["inbox"]; PAY["payments (Revolut-Adapter)"]
            CM["channel_manager"]; BOOK["booking_engine"]; OCR["ocr"]
            PORTAL["public_portal"]; CRM["crm"]; DASH["dashboard"]; CONT["content"]
        end
    end
    DB[("Postgres — 41 Tabellen, RLS")]
    DONE --> DB
    SCAFFOLD --> DB
    CORE --> DONE
    CORE --> SCAFFOLD
```

---

## 4. Component: Channel Manager (C4 Level 3)

Der `channel_manager`-Slice nutzt ein **Adapter-Pattern** (Anti-Corruption-Layer):
ein einheitliches Interface zum PMS-Kern, dahinter austauschbare Adapter pro Kanal.
So bleibt die Entscheidung *Direkt-Anbindung vs. Aggregator* reversibel
(siehe [ADR-0001](decisions/0001-channel-manager-architektur.md)).

```mermaid
C4Container
    title Component — Channel Manager Slice (Adapter-Pattern)

    Container_Boundary(cm, "channel_manager") {
        Container(facade, "Channel Facade", "Python", "Einheitliches Interface zum PMS-Kern")
        Container(booking_ad, "Booking.com Adapter", "Python", "Adapter+Translator: OTA-XML / Poll")
        Container(airbnb_ad, "Airbnb Adapter", "Python", "Adapter+Translator: Webhooks")
        Container(ical_ad, "iCal Adapter", "Python", "Fallback: nur Sperrzeiten")
        Container(worker, "Sync Worker", "Redis Queue", "Retry, Backoff, DLQ, Idempotenz")
    }

    ContainerDb(cal, "availability (Kalender)", "Postgres", "Single Source of Truth")
    System_Ext(booking, "Booking.com", "OTA")
    System_Ext(airbnb, "Airbnb", "OTA")

    Rel(facade, cal, "Sperrt/aktualisiert Tage atomar", "SQL FOR UPDATE")
    Rel(facade, worker, "Fan-out-Push einreihen")
    Rel(worker, booking_ad, "Ruft auf")
    Rel(worker, airbnb_ad, "Ruft auf")
    Rel(booking_ad, booking, "ARI-Push / Poll", "OTA-XML")
    Rel(airbnb, airbnb_ad, "Webhook: Buchung/Storno", "HTTPS")
```

---

## 5. Datenmodell (ER-Diagramm)

Tatsächliches Schema aus **[supabase/migrations/](../supabase/migrations/)** (Phase 1).

```mermaid
erDiagram
    TENANT ||--o{ PROPERTY : owns
    TENANT ||--o{ USER : employs
    TENANT ||--o{ GUEST : has
    TENANT ||--o{ RESERVATION : has
    PROPERTY ||--o{ RATE_PLAN : has
    PROPERTY ||--|{ AVAILABILITY : tracks
    PROPERTY ||--o{ RESERVATION : "is booked in"
    GUEST ||--o{ RESERVATION : makes
    RESERVATION ||--o{ PAYMENT : "settled by"
    RESERVATION ||--o{ MESSAGE : contains

    TENANT {
        uuid id PK
        string name
        string country
        string currency
    }
    USER {
        uuid id PK "== auth.users.id"
        uuid tenant_id FK
        enum role "owner|staff|cleaner"
        string email
    }
    PROPERTY {
        uuid id PK
        uuid tenant_id FK
        string title
        float lat
        float lng
        int max_guests
        enum status "draft|active|inactive"
    }
    RATE_PLAN {
        uuid id PK
        uuid property_id FK
        numeric base_price
        int min_stay
        jsonb season_rules
    }
    AVAILABILITY {
        uuid property_id FK
        date day "UNIQUE(property_id, day)"
        enum status "open|booked|blocked"
        enum source "direct|portal|booking|airbnb|vrbo|manual"
    }
    GUEST {
        uuid id PK
        uuid tenant_id FK
        string name
        string email
    }
    RESERVATION {
        uuid id PK
        uuid tenant_id FK
        uuid property_id FK
        uuid guest_id FK
        enum channel "direct|portal|booking|airbnb|vrbo"
        date check_in
        date check_out
        enum status "pending|confirmed|cancelled|completed"
        numeric total_amount
    }
    PAYMENT {
        uuid id PK
        uuid reservation_id FK
        numeric amount
        enum type "deposit|full|refund"
        string stripe_ref
    }
    MESSAGE {
        uuid id PK
        uuid reservation_id FK
        string sender
        string channel
    }
```

**Marktplatz-Tabellen (Phase 2, Struktur vorbereitet):** `portal_guests`, `reviews`,
`commissions` — siehe [Migration 0006](../supabase/migrations/0006_marketplace.sql).

**Kardinalität:** `||` = genau eins · `o{` = null bis viele · `|{` = ein bis viele.
`--` = identifizierend (Kind kann ohne Eltern nicht existieren).

### Datenmodell-Erweiterungen aus dem Lastenheft (Migrationen 0009–0019)

Das Modell ist auf **41 Tabellen (alle mit RLS)** gewachsen — verifiziert gegen das
echte Supabase-Projekt. Zur Lesbarkeit hier nach Bereich gruppiert (Details in den
jeweiligen Migrationen):

```mermaid
erDiagram
    TENANT ||--o{ SEASON_TEMPLATE : has
    SEASON_TEMPLATE ||--o{ SEASON : contains
    SEASON ||--o{ SEASON_PERIOD : "gilt an"
    SEASON_TEMPLATE ||--o{ SEASON_ASSIGNMENT : "zugewiesen an"
    TENANT ||--o{ EVENT : has
    EVENT ||--o{ EVENT_PERIOD : "gilt an"
    PROPERTY ||--o{ SURCHARGE : "Aufschläge"

    TENANT ||--o{ TASK : has
    TENANT ||--o{ TASK_RULE : "wiederkehrend"
    TASK ||--o{ CHECKLIST_ITEM : enthaelt
    CHECKLIST_ITEM ||--o{ CHECKLIST_PHOTO : "Foto-Nachweis"
    TASK ||--o{ TASK_SUBSTITUTION : "Vertretung"
    TENANT ||--o{ INVENTORY_ITEM : "Inventar/Pool"
    USER ||--o{ STAFF_PROPERTY_ASSIGNMENT : "Stamm-MA"

    TENANT ||--o{ LEAD : "Akquise"
    TENANT ||--o{ PARTNER : has
    PARTNER ||--o{ DEAL : "Rabatte"

    TENANT ||--o{ MESSAGE_TEMPLATE : has
    MESSAGE_TEMPLATE ||--o{ MESSAGE_TRIGGER : "Timing/Kanal"
    TENANT ||--o{ CONTENT_BLOCK : "dreisprachig"
    CONTENT_BLOCK ||--o{ CONTENT_ASSIGNMENT : "zugewiesen"

    TENANT ||--o{ BLOCK_REQUEST : "Sperrung beantragt"
    PROPERTY ||--o{ METER_READING : "Zählerstand (append-only)"
    PROPERTY ||--o{ CO_OWNER : "Miteigentümer"
    PROPERTY ||--o{ PRICE_OVERRIDE : "Tagespreis"
    USER ||--|| DASHBOARD_LAYOUT : personalisiert

    PLAN ||--o{ SUBSCRIPTION : "unit-basiert"
    TENANT ||--|| SUBSCRIPTION : abonniert
```

**Weitere Änderungen am Bestand:** `property_type` + `type_attributes` an
`properties` (Ökosystem, ADR-0007); Rollen-Enum um `admin`, `co_admin`
erweitert; `payments`: `stripe_ref` → `gateway_ref` + `gateway`-Enum (ADR-0003).
Marktplatz-Tabellen (`portal_guests`, `reviews`, `commissions`) wie oben.

---

## 6. Mandantenfähigkeit & RLS

Jeder Vermieter ist ein **Tenant**. Die Isolation läuft über **Row-Level-Security (RLS)**
in Postgres — nicht über Anwendungslogik. Das ist das **Pool-Modell** (geteiltes Schema,
`tenant_id` auf allen Tabellen).

```mermaid
flowchart LR
    subgraph CP["Control Plane (global, NICHT tenant-isoliert)"]
        AUTH["auth-Slice<br/>Registrierung · Tenant-Anlage · Rollen"]
    end

    subgraph AP["Application Plane (pro Tenant, hinter RLS)"]
        SLICES["properties · calendar · reservations<br/>guests · payments · inbox · ..."]
    end

    JWT["JWT mit app_metadata.tenant_id"]
    DB[("Postgres<br/>RLS: tenant_id = current_tenant_id()")]

    AUTH -->|"create_user(app_metadata)"| JWT
    JWT -->|"Bearer-Token"| SLICES
    SLICES -->|"SQL mit JWT-Claim"| DB
    AUTH -.->|"Service-Role (umgeht RLS)"| DB
```

**Schlüsselpunkte:**
- `tenant_id` steht im **JWT `app_metadata`**; `public.current_tenant_id()` liest sie.
- Jede Policy filtert `tenant_id = current_tenant_id()`. Tabellen ohne eigene
  `tenant_id` (`rate_plans`, `availability`, `messages`, `payments`) leiten ihn über
  den Parent ab.
- **Control Plane vs. Application Plane:** Der `auth`-Slice (Tenant-Anlage, Onboarding)
  ist *global* — er läuft über den **Service-Role-Client**, der RLS bewusst umgeht
  (beim Registrieren existiert noch kein `tenant_id` im JWT → Henne-Ei).

---

## 7. Kritische Flows (Sequenzdiagramme)

### 7.1 Registrierung (atomar mit Rollback)

```mermaid
sequenceDiagram
    actor L as Vermieter
    participant API as FastAPI (auth)
    participant SR as Supabase (Service-Role)
    participant DB as Postgres

    L->>+API: POST /api/v1/auth/register
    API->>+SR: INSERT tenant (Service-Role)
    SR->>DB: tenants
    DB-->>SR: tenant_id
    SR-->>-API: tenant_id
    API->>+SR: create_user(app_metadata={tenant_id, role:owner})
    alt User-Anlage scheitert
        SR-->>API: Fehler
        API->>SR: DELETE tenant (Rollback)
        API-->>L: 409 / 500
    else ok
        SR-->>-API: user_id
        API->>SR: INSERT users-Row
        Note over API,DB: Bei Fehler: User + Tenant zurückrollen
        API->>API: login()
        API-->>-L: 201 + SessionResponse
    end
```

### 7.2 Direktbuchung mit Double-Booking-Schutz

```mermaid
sequenceDiagram
    actor Guest as Gast
    participant Web as Web (Next.js)
    participant API as FastAPI
    participant Cal as calendar-Slice
    participant DB as Postgres

    Guest->>+Web: Buchungsanfrage
    Web->>+API: POST /api/v1/booking-engine/reserve
    API->>+Cal: Verfügbarkeit prüfen
    Cal->>+DB: SELECT availability FOR UPDATE
    DB-->>-Cal: Tages-Status
    alt Termine frei
        Cal-->>API: OK, Tage gesperrt
        API->>DB: INSERT reservation (pending)
        Note over API,DB: EIN Kalender = kein Double-Booking
        API-->>Web: 201 Created
        Web-->>Guest: Bestätigung
    else belegt
        Cal-->>API: Konflikt
        API-->>Web: 409 Conflict
        Web-->>Guest: "Nicht verfügbar"
    end
    deactivate Cal
    deactivate API
    deactivate Web
```

### 7.3 Auto-Aufgaben bei Buchung + Vertretung (§2.5/§4.3)

```mermaid
sequenceDiagram
    participant CM as Channel-Manager / Buchung
    participant API as FastAPI (tasks)
    participant DB as Postgres
    actor MA as Mitarbeiter
    actor Team as Team-Kollege

    CM->>+API: POST /tasks/from-booking (reservation)
    API->>DB: INSERT "Anreise-Check" (due = check_in)
    API->>DB: INSERT "Endreinigung" (due = check_out)
    API-->>-CM: 201 (2 Aufgaben)

    MA->>+API: POST /tasks/substitution (task_id)
    API->>DB: INSERT task_substitution (status=requested)
    API-->>-MA: 201 (Vertretung angefragt)
    Team->>+API: accept_substitution
    API->>DB: UPDATE status=accepted, accepted_by
    API-->>-Team: übernommen
```

---

## 8. Reservierungs-Lifecycle (State)

`reservation.status` ist eine echte State-Machine.

```mermaid
stateDiagram-v2
    [*] --> Pending: Buchung angelegt
    Pending --> Confirmed: Zahlung erhalten
    Pending --> Cancelled: Timeout / Storno

    state Confirmed {
        [*] --> AwaitingCheckIn
        AwaitingCheckIn --> CheckedIn: Gast reist an
        CheckedIn --> Completed: Aufenthalt endet
        Completed --> [*]
    }

    Confirmed --> Cancelled: Stornobedingung
    Cancelled --> [*]

    note right of Pending
        Kalendertage gesperrt
        gegen Double-Booking
    end note
```

---

## 9. Deployment & Skalierung

DSGVO-konform, self-hosted bevorzugt. EU-Datenresidenz als harte Grenze.

```mermaid
flowchart TB
    subgraph EU["EU / Hetzner (Coolify, Docker) — Datenresidenz-Grenze"]
        LB["Load Balancer"]
        subgraph APP["FastAPI Container x1..N (stateless)"]
            A1["API Instance"]
        end
        DB[("Postgres — pooled, RLS, tenant_id")]
        RD[("Redis — Cache")]
        Q["Background Queue / Worker"]
        OCR["OCR / Ausweis-Scan + Storage<br/>verlässt EU nie"]
        LB --> APP
        A1 --> DB
        A1 --> RD
        A1 --> Q
        A1 --> OCR
    end

    VERCEL["Vercel — Next.js Frontend"]
    STRIPE["Stripe — Payments"]
    GOOG["Google APIs — DPF-zertifiziert"]

    VERCEL -->|HTTPS| LB
    A1 -.->|"Transfer: SCC/DPF"| STRIPE
    A1 -.->|"Transfer: DPF"| GOOG
```

**Prinzipien:**
- FastAPI **zustandslos & containerisiert** → horizontale Skalierung (`x1..N` hinter LB).
- Aller State (Postgres, Redis, Queue, Storage) **externalisiert** — alle Instanzen
  teilen ihn, keine lokalen Daten im Container.
- **Kein** Serverless (Cold Starts, DB-Pooling-Probleme bei langlaufendem FastAPI).
- **US-Cloud als Compute bewusst vermieden** (CLOUD Act vs. DSGVO-Positionierung).
- Jede EU-Grenze überschreitende Kante ist mit Transfer-Rechtsgrundlage annotiert.

---

## 10. Backend-Aufbau (Vertical Slices)

Pro Feature ein **in sich geschlossener Slice** unter `apps/api/src/features/<name>/`:

```
features/auth/
├── router.py        # HTTP-Endpoints (FastAPI APIRouter)
├── service.py       # Business-Logik
├── schemas.py       # Pydantic-Modelle (explizit typisiert)
├── dependencies.py  # slice-spezifische Dependencies (optional)
└── tests/           # Tests des Slice
```

Gemeinsame Infrastruktur in `apps/api/src/core/`:

| Modul | Inhalt |
|---|---|
| `config.py` | `Settings` mit `SecretStr` für alle Secrets |
| `logging.py` | structlog (Console lokal, JSON in Produktion) |
| `supabase.py` | Client-Factory — Anon (RLS) und Service-Role (System) getrennt |
| `security.py` | Supabase-JWT-Verifikation (HS256) → `AuthContext`, `CurrentUser` |

**Slices:** `auth` · `properties` · `rates` · `calendar` · `reservations` ·
`guests` · `inbox` · `payments` · `channel_manager` · `booking_engine` · `ocr` ·
`public_portal` · `tasks` · `crm` · `dashboard` · `content`.

Die letzten vier (`tasks`, `crm`, `dashboard`, `content`) ergänzen den durch das
[Lastenheft](LASTENHEFT.md) erweiterten Funktionsumfang (Aufgaben/Checklisten,
Eigentümer-Akquise & Partner, Dashboard-Personalisierung, dreisprachige
Standardtexte). Der `payments`-Slice nutzt ein **Gateway-Adapter-Pattern**
(Revolut primär, Stripe sekundär — [ADR-0003](decisions/0003-zahlungs-gateway-revolut-primaer.md)).

Alle Router unter dem gemeinsamen Prefix **`/api/v1`** (versioniert von Anfang an).
`auth` ist als Referenz-Muster voll implementiert (siehe **[API.md](API.md)**).

---

## 11. Frontend & Design-System (apps/web)

- **Next.js** (App Router, TS) mit **Bun**; UI im **shadcn-Stil** (CVA + Radix-Slot
  + `cn`), Icons über **Iconify** (kein lucide-react, PROJECT.md §2).
- **Tailwind v4** über `@theme` in `styles/globals.css` — **kein**
  `tailwind.config.ts`. Light/Dark via `next-themes` (`.dark`-Klasse).
- **Design-Tokens** sind die einzige Quelle der Wahrheit für Farben/Radius
  (`:root` + `.dark` in `globals.css`). Startwerte aus dem NextDays-Logo
  (Primär `#0a0a0a`, Akzent-Rot `#b82028`) — **vorläufig, vom Designer
  überschreibbar**. Komponenten referenzieren nur semantische Tokens.
- **Storybook** (react-vite) als lebende Komponenten-Doku & Design-System-Brücke
  für den UX/UI-Designer ([ADR-0008](decisions/0008-storybook-design-system.md)):
  Light/Dark-Umschalter, Design-Token-Übersicht (`Design/Tokens`), Stories je
  Komponente. Build verifiziert; statisch deploybar (eigene URL für den Designer).

```
apps/web/
├── app/                 # Route-Gruppen (auth)/(dashboard)/(public)
├── components/
│   ├── ui/              # shadcn-Stil-Komponenten (+ .stories.tsx)
│   ├── theme-provider.tsx · theme-toggle.tsx
├── lib/
│   ├── supabase/        # Browser- + Server-Client (@supabase/ssr)
│   └── utils.ts         # cn()
├── stories/             # Design/Tokens-Übersicht
├── styles/globals.css   # Tailwind v4 @theme — Tokens (Quelle der Wahrheit)
└── .storybook/          # main.ts (react-vite) · preview.tsx (Theme-Switcher)
```

---

## Externe Dienste

Vom FastAPI-Backend als Dienste aufgerufen, Datenhoheit bleibt bei uns. Jeder Dienst
wird in **[docs/decisions/](decisions/)** mit Rechtsgrundlage dokumentiert.

| Dienst | Zweck |
|---|---|
| Google Maps / Places | Adress-Autocomplete, Geocoding, Kartenansicht (Portal) |
| Google Calendar | optionaler Sync persönlicher Sperrzeiten (nicht Kanal-Sync) |
| Google Translate | mehrsprachige Inhalte (server-seitig gecacht) |
| OCR (self-hosted) | Ausweis-/Pass-Scan (Meldepflicht) + Belege — bleibt auf Hetzner |

---

> **Diagramme pflegen:** Alle Diagramme sind Mermaid-Code in dieser Datei — im PR
> diffbar, mit dem Code versioniert. Bei Architektur-Änderungen hier aktualisieren.
> C4Context/C4Container sind in Mermaid „experimental" — nach Änderungen im
> GitHub-Preview gegenprüfen.
