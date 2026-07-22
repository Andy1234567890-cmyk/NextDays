# Server-Sizing-Analyse — EIN Hetzner-Server, Backend + self-hosted DB

> **Art:** Reine Architektur- & Ressourcen-Analyse (kein Code geändert).
> **Stand:** 2026-06-20 · Branch `feat/buchhaltung`
> **Annahme (durch Andy bestätigt):** Die **Datenbank läuft self-hosted auf demselben Hetzner-Server** (nicht Cloud-Supabase). Das ist der größte Sizing-Faktor.
> **Quelle für das Sizing:** der **IST-Zustand im Repo** (docker-compose.yml, supabase/config.toml, apps/, plattform/, pyproject.toml) — **nicht** allein CLAUDE.md/PROJECT.md.
> **Methode:** Jeder Service unten ist im Repo belegt (Datei/Image genannt). Wo Zahlen geschätzt sind, ist das **[Schätzung]** markiert.

---

## 1. IST-Zustand der Architektur (aus dem Code gelesen)

### 1.1 `docker-compose.yml` — die eigenen Dienste

Die zentrale Sizing-Quelle. Die Datei definiert **nur zwei eigene Container** und sagt explizit, dass Supabase **separat** über die CLI läuft:

| Service | Image / Build | Ports | Volumes | Limits gesetzt? | Beleg |
|---|---|---|---|---|---|
| `api` (nextdays-api) | Build aus `apps/api/Dockerfile` (`python:3.12-slim`, uvicorn) | `8000:8000` | `./apps/api:/app` (Dev-Reload-Mount) | **Keine** mem/cpu-Limits | `docker-compose.yml:11-35` |
| `redis` (nextdays-redis) | `redis:7-alpine`, `--save "" --appendonly no` (keine Persistenz) | `6379:6379` | keins | **Keine** | `docker-compose.yml:37-44` |

> **Wichtig:** In compose ist **kein** Supabase-Stack, **kein** Worker, **kein** OCR-Container, **kein** Next.js. Die Datei ist als **lokale Dev-Umgebung** geschrieben (`uvicorn --reload`, `host.docker.internal` → CLI-Supabase auf dem Host). Für Prod-Sizing müssen die fehlenden Dienste **bewusst ergänzt** gerechnet werden (Supabase-Stack, Worker, OCR) — siehe §3.

### 1.2 `supabase/` — wie Supabase eingebunden ist

- **Eingebunden über die Supabase CLI** (`supabase start`), konfiguriert in `supabase/config.toml` — **nicht** als Cloud-Anbindung im Code festgeschrieben. Der CLI-Stack zieht einen **vollständigen self-hosted Supabase-Stack** als Docker-Container hoch.
- Aktive Komponenten laut `config.toml`:
  - **Postgres** `major_version = 15`, Port 54322 (`[db]`)
  - **REST-API / PostgREST** Port 54321, `max_rows = 1000` (`[api]`)
  - **Auth (GoTrue)** aktiviert, JWT, Refresh-Token-Rotation (`[auth]`)
  - **Storage** aktiviert, `file_size_limit = "50MiB"` (`[storage]`)
  - **Studio** aktiviert (`[studio]`)
  - **Kong** (API-Gateway, implizit beim CLI-Stack)
  - **Realtime** (implizit; im Repo aktiv genutzt für den Storybook-Chat)
  - **Inbucket** Dev-Mailcatcher aktiviert (`[inbucket]`) — **nur Dev**, in Prod durch echten SMTP zu ersetzen
  - **Pooler (Supavisor/pgBouncer)** `enabled = false` (`[db.pooler]`) — **in Prod einzuschalten**
  - **Analytics (Logflare/Vector)** `enabled = false` (`[analytics]`) — spart RAM
- **48 Tabellen** über **26 Migrationen** (0001–0026), alle mit RLS. ~51 `CREATE TABLE`. Schema ist „schwer", die Datenmenge zum Start klein.
- ⚠️ **Abweichung/Widerspruch:** README + NOTES.md sagen, die Migrationen seien auf ein **echtes Supabase-Cloud-Projekt** (`kfzcllntmizpdxcojpmd`) angewandt. D. h. real wurde **bisher gegen Cloud-Supabase** entwickelt — die jetzt bestätigte **Self-Hosting-Annahme ist eine bewusste Architektur-Änderung** gegenüber dem bisherigen Vorgehen (siehe §2 + §5).

### 1.3 `plattform/` — was das ist

- Eine **eigenständige, dritte Next.js-App** (Next 15, React 19, App Router), `name: "nextdays-plattform"`, `dev --port 3100`.
- Zweck (laut package.json): **„Buchungsplattform (öffentliches Gäste-Frontend, entkoppelt von apps/web)"** — also das **öffentliche Portal / die Demand-Seite** (PROJECT.md Phase 2), hier als separate App ausgelagert.
- Inhalt: Listing-Cards, Such-Leiste, Buchungs-Widget, Checkout-Steps — reines Frontend, bewusst **ohne Backend-Kopplung** (next.config kommentiert: „kein Backend-Coupling, vgl. ADR-0002").
- **Sizing-Relevanz:** Wie `apps/web` und `marketing/` ein **Frontend** → gehört nach Stack-Konvention auf **Vercel**, nicht auf den Hetzner-Server. Nur relevant, falls Andy es bewusst mit-hosten will (Szenario-Vermerk in §3).

### 1.4 `apps/` — tatsächlicher Stand

| App | Stack | Stand | Sizing-Ort |
|---|---|---|---|
| `apps/api` | FastAPI, Python 3.12, `uv`, uvicorn | **6 reale Slices** (auth, buchhaltung, calendar, properties, reservations, tasks) + **11 Health-Stubs** (9 Zeilen je service.py: booking_engine, channel_manager, crm, dashboard, guests, inbox, ocr, payments, public_portal, rates). 17 Router gemountet (`main.py`). | **Hetzner** |
| `apps/web` | Next.js 15, React 19, Bun, 61 Dependencies (tiptap, recharts, pdf-lib, radix, google-maps) | Vermieter-Dashboard, in aktiver Entwicklung | **Vercel** (lt. Stack) |
| `mobile` | React Native 0.86 | 14 Screens, nur `HostListings` verdrahtet | Build-Pipeline, kein Server |
| `apps/storybook` | Next.js | Komponenten-Schau + Realtime-Chat | Vercel |

- **API-Dependencies (pyproject.toml):** fastapi, uvicorn[standard], pydantic, supabase, **redis**, structlog, python-multipart (Uploads), pyjwt, pyotp + qrcode (TOTP-2FA), pillow (über supabase/transitive). **Keine** OCR-Engine (kein pytesseract/paddle), **kein** Worker-Framework (kein celery/arq/rq) installiert.
- **Storage real genutzt:** `properties/service.py:103` Bucket `property-images`, Upload + `get_public_url` → Property-Fotos laufen über **Supabase Storage**.

### 1.5 packages / marketing / docs / .mcp.json / .env

- `packages/shared` — leer bis auf README (geteilte TS-Typen geplant). Kein Server-Impact.
- `marketing/` — nur README + `public/`. Eigenständige Marketing-Site → **Vercel** (ADR-0002), nicht Hetzner.
- `docs/decisions/` — 9 ADRs (0001–0009, inkl. neuer Taskilo-Integration-0009). `.mcp.json` — Supabase-MCP (stdio, `--project-ref`, PAT in env).
- **.env-Variablennamen** (nur Namen, keine Werte): `SUPABASE_URL`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `REDIS_URL`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`, `REVOLUT_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; api-seitig zusätzlich `APP_ENV`, `LOG_LEVEL`.
  - **Implikation fürs Self-Hosting:** Diese Namen zeigen auf **Cloud-Supabase-URLs/Keys**. Beim Umzug auf self-hosted Supabase ändern sich die *Werte* (lokale URL/Keys aus dem CLI-Stack), nicht die Namen.

### 1.6 Projektstand (PROJECT.md / AUDIT / NOTES)

- **Reifegrad ~22 %** (AUDIT): Datenmodell ~80 % fertig, API/UI-Verdrahtung ~20 %. → Aktuelle **Last ist niedrig**, das Sizing muss **headroom für Wachstum** haben, aber nicht für Vollbetrieb aller 16 Module bauen.
- OCR (Ausweis-/Belegscan) ist **konzeptionell fest** (PROJECT.md §OCR, self-hosted Tesseract/PaddleOCR), im Code aber **noch Stub** → Engine-Wahl real **offen** → beide Szenarien rechnen (Auftrag bestätigt).

---

## 2. Soll (CLAUDE.md / PROJECT.md) vs. Ist (Repo)

| Thema | Soll (Doku) | Ist (Repo) | Abweichung |
|---|---|---|---|
| **DB-Hosting** | „Supabase als DB/Auth/Storage" (Cloud-Dienst impliziert) | config.toml = **self-hosted CLI-Stack**; README/NOTES: Migrationen auf **Cloud-Projekt** angewandt | ⚠️ **Zwiespältig.** Doku/README = Cloud; jetzt bestätigte Annahme = **self-hosted auf dem Server**. Das ist der entscheidende Sizing-Treiber und eine echte Architektur-Entscheidung. |
| **Orchestrierung** | „Hetzner (Coolify, Docker)" | **docker-compose.yml** (nur api+redis), **kein Coolify** im Repo | ⚠️ Coolify nur in Doku behauptet. Real liegt eine **plain docker-compose** vor. Coolify-Overhead muss separat eingeplant werden, falls genutzt. |
| **Supabase-Stack-Ort** | nicht spezifiziert | compose sagt **explizit „Supabase NICHT hier"** → läuft via CLI getrennt | ⚠️ Für **Prod** existiert noch **keine** Compose-Definition des Supabase-Stacks. Muss vor Deploy gebaut werden (oder Coolify-Service). |
| **Frontend-Hosting** | Web → Vercel | `apps/web`, `marketing/`, **`plattform/`** sind alle Next.js-Frontends | `plattform/` ist **neu** und in PROJECT.md-Struktur nicht vorgesehen → 3 Frontends statt 2. Alle gehören auf Vercel, nicht Hetzner. |
| **`plattform/`-Ordner** | nicht erwähnt | existiert (öffentliches Buchungs-Portal, Port 3100) | ⚠️ **Zusätzlicher Top-Level-Ordner**, in PROJECT.md §3 nicht gelistet. |
| **Worker / Background-Queue** | „von Anfang an vorgesehen" (PROJECT.md, Redis als Broker) | **kein** Worker-Prozess/Framework im Code | Geplant, **nicht implementiert**. Sizing rechnet 1 Slot ein (Headroom). |
| **OCR-Engine** | Tesseract/PaddleOCR self-hosted | **Stub**, keine Engine-Deps | Engine-Wahl offen → beide Szenarien (§3/§4). |
| **Redis-Persistenz** | „Cache + Queue-Broker" | compose: `--save "" --appendonly no` = **keine Persistenz** | Als Queue-Broker müsste Persistenz/AOF aktiviert werden → minimal mehr RAM/Disk. |

**Von Andy zu klären (Widersprüche):**
1. **Self-hosted Supabase wirklich gewünscht** statt Cloud? (Bestätigt fürs Sizing — aber als ADR festzuhalten, weil README/NOTES noch Cloud sagen.) → bestimmt das gesamte Sizing.
2. **Coolify ja/nein?** (Doku sagt ja, Repo zeigt plain compose.) Coolify kostet ~1–1,5 GB RAM extra.
3. **`plattform/` und `marketing/` auf Vercel** (wie web) — oder bewusst mit auf Hetzner? (Default-Annahme: Vercel.)
4. **Welche OCR-Engine?** Tesseract (leicht) vs. PaddleOCR (genau, schwer) → Faktor ~2× beim RAM.

---

## 3. Server-Sizing — Komponenten (Self-hosted DB auf demselben Server)

Annahme: **Hetzner, EIN Server, Self-hosted Supabase-Stack + FastAPI + Redis + Worker + OCR.** Frontends (web/plattform/marketing) auf **Vercel** (Default). Zahlen sind **konservative Prod-Werte für einen frühen MVP** mit niedriger paralleler Last; **[Schätzung]** wo nicht direkt aus Image/Config ableitbar.

| Service | Image / Quelle | RAM min / empfohlen | vCPU-Last | Storage | Anmerkung |
|---|---|---|---|---|---|
| **OS + Docker-Daemon** | Ubuntu 22.04 + Docker | 0,5 / 1,0 GB | niedrig (Dauer) | 8–12 GB (System+Images) | Grundrauschen, immer reserviert |
| **Coolify** *(falls genutzt)* | coolify | 1,0 / 1,5 GB | niedrig–mittel | 2–4 GB | **Optional.** Nur wenn nicht plain compose. (Klärung §2) |
| **Postgres 15** (Supabase) | `supabase/postgres` (PG15) | **1,5 / 3–4 GB** | **Hauptlast** (Queries, WAL) | Daten + WAL (s. §3.1) | `shared_buffers` ~25 % RAM, `effective_cache_size` ~50–75 %. **Größter RAM-Treiber.** [Schätzung skaliert mit Datenmenge] |
| **PostgREST** | `postgrest/postgrest` | 0,25 / 0,5 GB | mittel (req-abh.) | – | REST-API-Layer, `max_rows=1000` |
| **GoTrue (Auth)** | `supabase/gotrue` | 0,15 / 0,3 GB | niedrig | – | Login/JWT/Refresh |
| **Storage-API** | `supabase/storage-api` | 0,2 / 0,4 GB | niedrig–mittel (Up/Download) | metadaten klein; Files s. §3.1 | Property-Fotos, später Belege/Ausweise |
| **Realtime** | `supabase/realtime` | 0,3 / 0,5 GB | niedrig (idle) bis mittel (viele WS) | – | im Repo genutzt (Chat). [Schätzung] |
| **Kong (Gateway)** | `kong` | 0,25 / 0,5 GB | niedrig–mittel | – | Routing aller Supabase-APIs |
| **Studio** | `supabase/studio` | 0,3 / 0,5 GB | niedrig | – | Admin-UI; in Prod ggf. abschaltbar → spart ~0,5 GB |
| **Meta / Vector / Analytics** | supabase-meta | 0,1 / 0,2 GB | niedrig | – | Analytics/Logflare **disabled** (config) → gespart |
| **FastAPI (`api`) ×1** | eigenes Image (uvicorn) | 0,3 / 0,6 GB je Instanz | mittel (Business-Logik) | – | MVP: **1–2 Instanzen**. PDF/Buchhaltung rechenintensiv (pdf-lib im FE, Decimal im BE) |
| **FastAPI 2. Instanz** *(empfohlen ab Last)* | dito | 0,3 / 0,6 GB | mittel | – | Horizontale Skalierung (PROJECT.md): zustandslos hinter Reverse-Proxy |
| **Redis** | `redis:7-alpine` | 0,2 / 0,5 GB | niedrig | klein (mit AOF s. §3.1) | Cache **+ Queue-Broker**. Für Queue: Persistenz aktivieren |
| **Worker** (Background-Queue) | (noch nicht impl.) | 0,3 / 0,6 GB | mittel–hoch bei OCR-Jobs | – | PROJECT.md vorgesehen. Verarbeitet u. a. OCR-Jobs asynchron |
| **OCR — A) Tesseract** | tesseract im Worker/Container | **0,3 / 0,5–0,7 GB** je paralleler Scan | **CPU-intensiv** (kurz, spiky) | Modelle ~30–100 MB | Leichtgewicht. RAM/Scan klein, CPU spiky |
| **OCR — B) PaddleOCR** | paddleocr-Container | **1,0 / 1,5–2,0 GB** (Modelle geladen) | **CPU-intensiv, länger** | Modelle **1–2 GB** | Genauer, aber RAM-/CPU-schwer. Hält Modelle im RAM |
| **Reverse-Proxy** (Caddy/Traefik) | falls nicht via Coolify | 0,1 / 0,2 GB | niedrig | – | TLS/Routing nach außen |
| **Backup-Agent** | pg_dump / restic | transient 0,2–0,5 GB Peak | spiky (nächtlich) | s. §3.1 | RAM-Peak bei Dump/Komprimierung |

> Hinweis: Werte sind **Arbeitsspeicher-Footprints unter geringer MVP-Last**. Postgres ist bewusst der einzige Posten, der mit der Datenmenge **wächst** — daher in der Empfehlung großzügig gepuffert.

### 3.1 Storage gesondert (NVMe)

| Posten | Start-Bedarf | Wächst mit | Anmerkung |
|---|---|---|---|
| **OS + Docker-Images** | 12–18 GB | Image-Updates | Supabase-Stack = viele Images (Postgres, gotrue, storage, realtime, kong, studio, vector …) |
| **Postgres-Daten** | 1–3 GB **[Schätzung]** | Buchungen, Belege, Logs | 48 Tabellen, Start klein. Wächst linear mit Buchungen/Rechnungen |
| **Postgres-WAL** | 1–4 GB | Schreiblast | + Reserve für `max_wal_size`. Bei aktivem Backup/Replikation mehr |
| **Supabase Storage — Property-Fotos** | **20–80 GB [Schätzung]** | Anzahl Objekte × Fotos | **Größter, am schwersten schätzbarer Posten.** file_size_limit 50 MiB. Z. B. 200 Objekte × 20 Fotos × ~3 MB ≈ 12 GB; mit Wachstum/Originalen schnell 50 GB+ |
| **Supabase Storage — OCR-Belege** | 5–20 GB **[Schätzung]** | Rechnungen/Belege (Buchhaltung) | PDFs/Scans, GoBD-Aufbewahrung → wächst, wird **nie gelöscht** (10 Jahre) |
| **Supabase Storage — Ausweis-Scans** | 2–10 GB **[Schätzung]** | Check-ins | Besonders schützenswert; Aufbewahrung restriktiv (Meldepflicht) |
| **OCR-Modelle** | A) ~0,1 GB / **B) 1–2 GB** | – | PaddleOCR-Modelle deutlich größer |
| **Backups (lokal vorgehalten)** | 1–2× DB+Storage | Retention-Tage | Restic-/pg_dump-Historie. Hetzner-Backup zusätzlich (s. §4) |
| **Übersetzungs-Cache** | < 0,5 GB | i18n-Nutzung | In DB persistiert (PROJECT.md), klein |

> **Empfehlung Storage:** **Separates Hetzner-Volume** für Supabase-Storage (Fotos/Belege/Ausweise) + OCR-Modelle, **getrennt von der OS-NVMe**. So wächst der Foto-/Beleg-Berg unabhängig und ist separat sicherbar/verschlüsselbar (Ausweisdaten!).

---

## 4. Empfehlung

### 4.1 Summen (mit 25–30 % Reserve, ohne Coolify; +1–1,5 GB falls Coolify)

**Szenario A — Tesseract** (leichte OCR):

| Posten | RAM (empfohlen) |
|---|---|
| OS+Docker | 1,0 |
| Supabase-Stack (PG15 + PostgREST + GoTrue + Storage + Realtime + Kong + Studio + Meta) | ~6,2 |
| FastAPI ×2 | 1,2 |
| Redis | 0,5 |
| Worker | 0,6 |
| OCR Tesseract (Peak paralleler Scans) | 0,7 |
| Reverse-Proxy + Backup-Peak | 0,5 |
| **Zwischensumme** | **~10,7 GB** |
| **+ ~30 % Reserve** | **≈ 14 GB** |

**Szenario B — PaddleOCR** (genaue OCR, Modelle resident):

| Posten | RAM (empfohlen) |
|---|---|
| wie A, aber OCR statt 0,7 → **2,0** | – |
| **Zwischensumme** | **~12,0 GB** |
| **+ ~30 % Reserve** | **≈ 16 GB** |

vCPU: Postgres + OCR sind die Last-Treiber. OCR ist **spiky CPU** (Scan-Bursts). Für ruhigen MVP-Betrieb mit gelegentlichen OCR-Jobs: **4 vCPU (A)** bzw. **6–8 vCPU (B)**, bei PaddleOCR eher **dedizierte vCPU** (CCX) gegen Noisy-Neighbor-Latenz.

### 4.2 Konkrete Hetzner-Empfehlung (Standort DE: Nürnberg/Falkenstein, Backups an)

| Szenario | MVP-Start | Typ | vCPU / RAM / NVMe | Storage-Volume (extra) |
|---|---|---|---|---|
| **A — Tesseract** | **CPX41** (shared vCPU reicht für frühen MVP) | 8 vCPU / 16 GB / 240 GB NVMe | + **100–200 GB Volume** für Fotos/Belege/Ausweise | Backups aktiviert |
| **B — PaddleOCR** | **CCX33** (dedizierte vCPU gegen OCR-CPU-Spikes) | 8 dedi-vCPU / 32 GB / 240 GB NVMe | + **100–200 GB Volume** | Backups aktiviert |

- **Minimal vertretbarer Einstieg (sehr früh, wenig OCR, Tesseract):** **CPX31** (4 vCPU / 8 GB / 160 GB) — **nur** wenn OCR selten, Studio aus, 1 FastAPI-Instanz, Coolify aus. Eng; wenig Headroom für Postgres-Cache.
- **Empfohlener, ruhig fahrbarer MVP:** **CPX41 (16 GB)** für Szenario A. Deckt Supabase-Stack + 2× FastAPI + Worker + Tesseract + 30 % Reserve.
- **Wenn PaddleOCR von Anfang an:** direkt **CCX33 (32 GB, dedizierte vCPU)** — die Modelle (1–2 GB resident) + CPU-intensive Inferenz vertragen sich schlecht mit shared vCPU.
- **Separates Volume** für Storage/OCR-Modelle (nicht auf der OS-NVMe), **Server-Backups aktiviert**, zusätzlich **DB-Dump-Backup** (off-site/restic). Ausweis-Scan-Bucket **verschlüsselt**.
- **Coolify genutzt?** Dann eine Stufe höher RAM (+1,5 GB) → für A eher Richtung CPX41 ausschöpfen, B bleibt 32 GB.

### 4.3 Upgrade-Trigger (ab wann größer)

- **Postgres-RAM-Druck:** Cache-Hit-Rate sinkt / `shared_buffers` zu klein für Working-Set → mehr RAM (CCX-Linie 64 GB).
- **OCR-Parallelität:** > ~3–4 gleichzeitige PaddleOCR-Scans → CPU sättigt, Latenz steigt → mehr dedizierte vCPU **oder OCR auf eigenen Server** auslagern.
- **FastAPI-Last:** anhaltend hohe Auslastung beider Instanzen → 3.–4. Instanz → mehr vCPU/RAM, dann **Load Balancer** (PROJECT.md: horizontal).
- **Foto-/Beleg-Storage** füllt das Volume → Volume vergrößern (online möglich) oder Object-Storage (Hetzner/EU-S3) anbinden.
- **DB + OCR konkurrieren um CPU** unter Last → klassischer Trigger, **DB und OCR/Worker auf zwei Server** zu trennen (Self-hosted-Supabase-Server + App/OCR-Server).

---

## 5. Offene Annahmen für Andy (vor finaler Bestellung bestätigen)

Alle folgenden Zahlen sind **Schätzungen** und treiben das Sizing direkt:

1. **DB-Hosting endgültig self-hosted?** README/NOTES dokumentieren bislang **Cloud-Supabase** (`kfzcllntmizpdxcojpmd`). Self-Hosting ist eine **bewusste ADR** — sonst entfällt der größte RAM-Posten (Postgres+Stack) und der Server wird klein. **Das ist die wichtigste Entscheidung.**
2. **OCR-Engine:** Tesseract (→ 16 GB / CPX41) **oder** PaddleOCR (→ 32 GB dedi / CCX33)? Faktor ~2× RAM + CPU-Charakter.
3. **Erwartetes Datenvolumen DB** (Buchungen/Rechnungen pro Monat) — bestimmt Postgres-Wachstum + WAL.
4. **Foto-Mengen & -Größen:** Objekte × Fotos/Objekt × Ø-MB. **Größter Storage-Posten** (20–80 GB+). Werden Originale + Thumbnails gespeichert?
5. **Beleg-/Ausweis-Aufkommen:** Scans/Monat × Aufbewahrung (GoBD 10 J. für Belege; Meldepflicht für Ausweise) — wächst monoton, **wird nie gelöscht**.
6. **Parallele OCR-Scans in der Spitze** (gleichzeitige Check-ins/Buchhaltungs-Stapel): treibt OCR-RAM × N und CPU. Bei PaddleOCR kritisch.
7. **Anzahl FastAPI-Instanzen** für MVP: **1–2** angenommen. Mehr → mehr RAM/vCPU.
8. **Coolify ja/nein** (Doku vs. plain compose): +~1,5 GB RAM, +2–4 GB Disk.
9. **Frontends auf Vercel** (web/plattform/marketing) oder bewusst mit-hosten? Default: Vercel → nicht eingerechnet. Mit-Hosting eines Next-Servers: +~0,5–1 GB je App.
10. **Redis als Queue-Broker mit Persistenz** (AOF an) statt aktuellem `--save "" --appendonly no` → minimal mehr RAM/Disk, aber nötig für verlässliche Jobs.

---

### Kurzfazit

- **Sizing-Treiber:** self-hosted **Supabase-Stack (v. a. Postgres)** + **OCR-Engine-Wahl**.
- **MVP-Empfehlung A (Tesseract):** Hetzner **CPX41** (8 vCPU / 16 GB / 240 GB NVMe) + 100–200 GB Volume, Backups an, DE.
- **MVP-Empfehlung B (PaddleOCR):** Hetzner **CCX33** (8 dedi-vCPU / 32 GB) + Volume.
- **Frontends bleiben auf Vercel** — der Hetzner-Server trägt **Backend + DB + OCR**, nicht die Next.js-Apps.
- Zahlen bewusst **konservativ**; die mit **[Schätzung]** markierten Posten (v. a. Foto-Storage) vor Bestellung mit echten Mengen aus §5 gegenrechnen.

*Ende der Analyse — reiner Lese-/Analyse-Auftrag, kein Code geändert. NOTES.md bewusst nicht verändert (kommt mit der finalen ADR).*
