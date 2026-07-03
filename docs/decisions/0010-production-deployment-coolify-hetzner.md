# ADR-0010: Production-Deployment via Coolify auf Hetzner CX43

- Status: **akzeptiert** (Frontend-Aussage aktualisiert, siehe Nachtrag unten)
- Datum: 2026-06-20

> **Nachtrag (Juli 2026):** Die ursprüngliche Annahme „Next.js-Frontends bleiben
> auf Vercel" gilt nicht mehr — **alle Frontends laufen inzwischen als
> Coolify-Apps auf demselben Server** (`nextdays-web`, `nextdays-plattform`,
> `nextdays-storybook`, `nextdays-marketing`; der Website-Renderer `builder/`
> bringt ein eigenes Dockerfile mit). Der Rest dieser ADR (Server-Sizing,
> Supabase-Stack, Betrieb) gilt unverändert.

## Kontext

Das Repo hatte bislang **nur ein Dev-Setup**: `docker-compose.yml` (FastAPI mit
`uvicorn --reload` + Redis ohne Persistenz) und einen Supabase-Stack über die
**CLI** (`supabase start`), real entwickelt gegen ein **Cloud-Supabase-Projekt**.
Für den Produktivbetrieb fehlten: ein self-hosted Supabase-Stack als Compose,
ein prod-taugliches FastAPI-Image, eine App-Prod-Compose sowie die Deploy-Doku.

Grundlage für das Ressourcen-Sizing ist
[server-sizing-analyse.md](./server-sizing-analyse.md). Diese ADR hält die
konkreten Betriebsentscheidungen fest.

## Entscheidung

**Single-Server-Deployment** über **Coolify** (Self-hosted PaaS, „Diese
Maschine") auf **einem Hetzner-Server**. Backend + DB + Cache laufen als
Container auf demselben Host; die Next.js-Frontends bleiben auf Vercel
(ADR-0002, nicht Teil dieses Servers).

### Server

- **Hetzner CX43** — 8 vCPU (x86, shared), **16 GB RAM**, 160 GB lokale SSD
  **+ 200 GB separates Volume**, Standort **Helsinki (EU)**, **Backups an**.
- **Bewusste Wahl statt CPX41:** Entscheidend war die **verfügbare x86-Option
  zum besten Preis**, *nicht* mehr RAM-Reserve. **ARM/CAX wurde vermieden**, weil
  der self-hosted Supabase-Stack (mehrere Images) auf x86 am verlässlichsten
  läuft (Image-/Kompatibilitäts-Risiko bei ARM).

### RAM-Budget (16 GB, konservativ)

Coolify selbst belegt **~1,5 GB**. Daher ist das Compose-Sizing knapp gehalten:

| Posten | RAM-Limit (Compose) |
| --- | --- |
| Coolify + OS/Docker | ~2,5 GB |
| Postgres 15 (`shared_buffers=512MB`, `effective_cache_size=2GB`) | 4 GB |
| übrige Supabase-Services (rest/auth/storage/realtime/kong/studio/meta/pooler) | ~3,4 GB |
| FastAPI (api) | 1 GB |
| Redis (AOF) | 0,5 GB |
| **Summe (Limits)** | **~11,4 GB** → ~4,6 GB Reserve |

`shared_buffers` bewusst **konservativ** (512 MB statt der Faustregel 25 % =
4 GB), weil sich App, Stack und Coolify den Host teilen. Hochziehen erst, wenn
Postgres real der Engpass ist (siehe Upgrade-Trigger).

### Storage

- **200-GB-Volume** trägt Postgres-Daten + Supabase-Storage-Objekte
  (Property-Fotos, später Belege/Ausweise) + Redis-AOF, getrennt von der
  OS-SSD → unabhängig wachsend, separat sicherbar.
- **Mount-Mechanik (wichtig, im Live-Deploy verifiziert):** Persistenz läuft über
  **Bind-Mounts mit absolutem Host-Pfad** auf das Hetzner-Volume
  (`/mnt/HC_Volume_106086998/nextdays/{postgres,storage,redis}`) — Coolifys
  dokumentierte Persistent-Storage-Methode („Source Path from the host system,
  no docker volume created").
  - **Warum absolut statt `${DATA_ROOT}`:** Coolify expandiert Umgebungsvariablen
    im `volumes:`-`source` **nicht**. Ein erster Versuch mit Named Volumes +
    `driver_opts` bzw. `${DATA_ROOT}/…` führte dazu, dass Coolify eigene Named
    Volumes unter `/var/lib/docker/volumes/` (= **OS-SSD**) anlegte — der Live-Test
    zeigte `…/cdqxi7…_data-rootpostgres/_data`. Daher der **absolute Pfad**.
  - **Konsequenz:** Der Volume-Pfad ist **server-spezifisch** und bewusst in den
    Compose-Dateien (Header-Kommentar) dokumentiert. Bei einem Server-/Volume-
    Wechsel ist er an drei Stellen anzupassen (db, storage, redis). Verifikation
    per `docker inspect <db> --format '{{.Mounts}}'` → muss den Volume-Pfad zeigen,
    nicht `/var/lib/docker`.
- **Kong-Konfiguration:** `kong.yml` wird über einen docker-compose **`configs:`**-
  Block mit Inline-`content` bereitgestellt (Coolify-Methode für Config-Dateien),
  statt per relativem Datei-Mount (`./kong.yml`) — letzterer legte unter Coolify
  ein leeres Verzeichnis an („kong.yml: Is a directory"). Die separate Datei
  `deploy/supabase/kong.yml` bleibt als lesbare Referenz im Repo.

### Supabase: self-hosted statt Cloud

- **Self-hosted Supabase-Stack** (`deploy/supabase/docker-compose.yml`) statt
  Cloud-Projekt. Begründung: **Wirtschaftlichkeit** (keine laufende Cloud-Gebühr)
  + **DSGVO/Datenhoheit** (EU-Server, eigene Kontrolle über Auth-/Beleg-/
  Ausweisdaten). Prod-Abweichungen ggü. Dev: **Pooler (Supavisor) aktiv**,
  **Analytics/Logflare aus** (RAM), **echter SMTP statt Inbucket**.

### OCR

- **Tesseract** als OCR-Engine (leichtgewichtig, CPU-spiky). Anbindung über das
  bestehende **Adapter-Pattern** (analog `payments`/`channel_manager`), damit
  später auf PaddleOCR o. Ä. **tauschbar** ohne Eingriff in die Aufrufer.
  Läuft im (vorerst gestubten) Worker-Container.

### Payments

- **MVP startet OHNE Payment-Provider.** Stripe Connect ist geplant und kommt
  **später**. Die **Revolut-Anbindung war Altlast** (`REVOLUT_API_KEY` in alten
  `.env`-Dateien, `RevolutAdapter`-Stub via ADR-0003) → für den MVP **raus**.
- Verifiziert: Die FastAPI-Config (`src/core/config.py`) hält alle Payment-Keys
  als `SecretStr("")` mit Default, kein Key wird beim Start ausgelesen →
  **die App fährt ohne Payment-Keys sauber hoch**. `deploy/.env.example` listet
  `STRIPE_*` daher **auskommentiert/optional**; `REVOLUT_API_KEY` ist nicht mehr
  enthalten.

### Netzwerk / Firewall

- Eingehend offen: **22 (SSH), 80, 443**. **8000 nur temporär** (direktes Testen
  von API/Kong) und danach schließen — im Normalbetrieb routet Coolifys Proxy
  (Traefik) TLS auf 443. DNS + HTTPS richtet Andy ein.

### Staging

- **Coolify-Environment „staging"** getrennt von „prod", plus
  **GitHub-App-Preview-Deployments** für PRs. Staging bekommt **eigene**
  Supabase-/Redis-Secrets und **TEST-Stripe-Keys** — **nie** Zugriff auf die
  Prod-DB oder echte Zahlungs-Kunden (siehe `deploy/.env.example`,
  `[staging-eigen]`).

## Konsequenz

Neu unter `deploy/` (Dev-Dateien bleiben unangetastet):

- `deploy/supabase/docker-compose.yml` (+ `README.md`) — self-hosted SB-Stack.
- `deploy/api/Dockerfile` — Prod-Image: Multi-Stage, **kein `--reload`**, kein
  Code-Mount, **Multi-Worker**, **Non-Root** (uid 10001), `HEALTHCHECK /health`.
- `deploy/docker-compose.prod.yml` — api (gebautes Image, 1–2 Instanzen via
  Coolify-Replicas) + Redis **mit AOF** (Queue-Broker) + Worker-Stub.
- `deploy/.env.example` — alle Prod-Variablennamen (Platzhalter), Staging-Hinweise.
- `apps/api/.dockerignore` erweitert: schließt `.env*`, `.git`, `tests`, Caches,
  `*.md` aus (Secret-Leak-Schutz beim `COPY . .`).

Aufgabenteilung beim Go-Live:
- **Andy (Browser/Server):** Coolify-GitHub-App verbinden, DNS/HTTPS,
  `kong.yml` + Env-Werte auf dem Server, Volume mounten, Migrationen fahren.
- **Repo (diese Dateien):** liefern alle versionierbaren Deploy-Artefakte.

## Upgrade-Trigger (aus server-sizing-analyse.md)

- **Postgres-RAM-Druck** (Cache-Hit-Rate sinkt) → `shared_buffers` hoch / größere
  Instanz (CCX-Linie).
- **OCR-Parallelität** > ~3–4 gleichzeitige Scans → mehr vCPU oder OCR auf
  eigenen Server.
- **FastAPI-Dauerlast** beider Instanzen → 3.–4. Instanz + Load Balancer.
- **Volume füllt sich** (Fotos/Belege) → Volume vergrößern oder EU-Object-Storage.
- **DB + OCR konkurrieren um CPU** → DB und App/OCR auf zwei Server trennen.

## Offene Punkte

- **Zwei Payment-Provider klären:** In alten Env-Vars stand `REVOLUT_API_KEY`
  neben `STRIPE_*`, die Doku (ADR-0003) nennt Revolut primär, neuere Planung
  nennt Stripe Connect. Für den MVP ohne Payments unkritisch; vor der
  Payment-Implementierung final entscheiden (ein Provider vs. Adapter-Beibehalt).
- **Image-Tag-Kompatibilität** des SB-Stacks vor Deploy gegen ein offizielles
  Supabase-Release-Set gegenprüfen (`deploy/supabase/README.md`).
