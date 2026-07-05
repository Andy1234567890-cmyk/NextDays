# Deploy-Safety-Plan — nie wieder ein Deploy, der die Produktion killt

**Anlass:** Ein Deploy hat den kompletten Supabase-Stack (inkl. Produktions-DB) heruntergefahren.
Ursache: ein neuer Worker-Service lag im **selben Compose-Stack wie die Datenbank** und crashte;
Coolify behandelt einen Compose-Stack als **eine Einheit** und fährt beim Deploy alles zusammen
herunter/hoch. Nur weil das Postgres-Volume ein separater Bind-Mount ist, gab es keinen Datenverlust.

**Ziel:** Ein fehlerhafter Deploy darf die Produktions-DB **strukturell nicht mehr erreichen können** —
nicht „wir passen besser auf", sondern die Architektur macht es unmöglich.

---

## ⚠️ Kritischer Zusatzbefund (Setup-Analyse) — der Fehler ist bei JEDEM API-Deploy scharf

Der Worker war **nicht** der einzige App-Service im DB-Stack. Noch immer aktiv:

- **`api` (FastAPI) liegt im DB-Stack** (`deploy/supabase/docker-compose.yml:334`) — **ohne Healthcheck**.
- **`redis` liegt im DB-Stack** (`:411`).
- Der Deploy-Workflow (`.github/workflows/deploy.yml:39`) triggert bei **jeder** Änderung unter
  `apps/api/` einen Redeploy des **kompletten `nextdays-supabase`-Stacks = inkl. DB**.

→ **Jeder normale Backend-Release fährt schon heute die Produktions-DB mit herunter** (Compose = kein
Rolling-Update) und teilt das Crash-Schicksal mit der `api`. Der Worker-Vorfall war nur die erste
Zündung derselben Ladung. **Das ist der wichtigste Punkt des ganzen Plans:** `api` + `redis` müssen
aus dem DB-Stack raus, sonst bleibt jeder API-Deploy ein DB-Risiko.

Weitere Befunde: `deploy/docker-compose.prod.yml` ist ein **totes, widersprüchliches Artefakt** (definiert
api+redis mit Healthcheck, wird aber vom Workflow gar nicht genutzt); `RECOVERY.md` deckt nur den
Server-Totalausfall ab, **nicht** das tatsächlich eingetretene „Coolify hat den Stack beim Deploy
heruntergefahren"-Szenario.

**Bereits korrekt (kein Handlungsbedarf):** Worker isoliert, Kong isoliert, Bind-Mounts auf separatem
Volume (datensicher gegen `down -v`), Off-site-Backup + monatlicher Restore-Test + Disk-Alert.

---

## Die 3 Wurzeln (aus Recherche + Vorfall)

1. **DB liegt im selben Compose-Stack wie die App.** Coolify deployt einen Compose-Stack als *eine*
   Einheit (stop-all → start-all, **kein** Rolling-Update). Jede App-Änderung startet also die DB neu.
   Ein crashender App-Service kann den Stack-Deploy scheitern lassen → DB mit unten.
   *(Quelle: Coolify-Community, Mornati „Zero-Downtime", Zenith-Stack „Coolify in Production".)*
2. **Kein Staging.** Alles geht direkt von `main` in die echte Produktion — ungetestet gegen die
   reale Infrastruktur (Coolify/Traefik/Netze), wo genau dieser Fehler erst sichtbar wurde. Lokale
   Tests (676 grün) fangen Deploy-/Infra-Fehler NICHT.
3. **Kein Backup-vor-Deploy + kein Deploy-Runbook.** Backups laufen (Borg, off-site), aber nicht
   garantiert *unmittelbar vor* jedem riskanten Deploy; es gab keine Checkliste, die „neuer Service
   im DB-Stack = Stopp" erzwingt.

---

## Der Plan — 4 Säulen

### Säule 1 — STAGING-ZWISCHENSTUFE (Kernforderung)
*Jeder Deploy wird zuerst auf einer echten, produktionsgleichen Staging-Umgebung getestet, bevor er
die echte Webseite berührt.*

- **Branch-Strategie:** `main` → **Staging** (Auto-Deploy), Promotion auf **Produktion** erst nach
  grünem Staging-Test. (Coolify unterstützt Multi-Environment staging/production pro Projekt +
  branch-basiertes Deploy.) Konkret zwei Wege:
  - **A (empfohlen, günstig):** Zweite Coolify-*Umgebung* („staging") **auf demselben Server**, eigener
    Stack mit eigener DB (kleiner Datensatz / Kopie). Deploy nach `main`-Push → Staging. Erst wenn
    Staging läuft + Smoke-Test grün → manueller „Promote"/Redeploy der Produktions-Umgebung.
  - **B (sauberste Trennung):** Kleiner zweiter Hetzner-Server nur für Staging. Teurer, aber echte
    Isolation (ein Staging-Fehler kann die Prod-Maschine nie berühren).
- **Automatischer Smoke-Test nach Staging-Deploy** (Skript, Teil des Runbooks): `/health` aller
  Services, ein Login, ein `/calendar/board`-Call, Worker-Container läuft ohne Crash-Schleife.
  Schlägt einer fehl → **kein** Produktions-Deploy.
- **Regel:** Produktion wird NIE direkt deployt. Immer erst Staging, dann promoten.

### Säule 2 — DB AUS DEM COMPOSE-MONOLITH ISOLIEREN
*Die Datenbank bekommt ihren eigenen Deploy-Lebenszyklus. Ein App-/Worker-Deploy kann sie technisch
nicht mehr anfassen.*

- **Zielbild (Recherche Mornati):** getrennte Coolify-Resources über ein **externes, persistentes
  Netz** (`supabase-internal` existiert bereits!):
  - **Infra-Resource:** Postgres, Redis, Storage, Auth, PostgREST, Realtime, Meta — die stabilen,
    selten geänderten Dienste. Eigener Deploy-Lebenszyklus.
  - **App-Resource:** die FastAPI (`api`). Eigener Lebenszyklus, deployt oft.
  - **Worker-Resource:** bereits erledigt — der Worker ist jetzt ein **eigener Stack** (`deploy/worker/`).
  - **Kong-Resource:** bereits getrennt (`deploy/kong/`).
- **Wichtigster Sofort-Schritt:** die **`db`- (Postgres) und `redis`-Services** aus
  `deploy/supabase/docker-compose.yml` in eine eigene Coolify-Resource ziehen, die **nie** durch einen
  App-Deploy angefasst wird. Verbindung über das bestehende `supabase-internal`-Netz per Servicename.
- **Volume-Sicherheit:** Postgres/Storage/Redis liegen als **Bind-Mount auf dem Hetzner-Volume**
  (`/mnt/HC_Volume_.../nextdays/...`) — das hat den Vorfall überlebt. Diese Mounts bleiben; beim
  Split das vorhandene Verzeichnis referenzieren (kein neues Volume, kein Backfill).
- **Nie wieder ein neuer Service in den DB-Stack** (dauerhaft als Regel gespeichert).

### Säule 3 — BACKUP-VOR-DEPLOY + ROLLBACK
- **Automatischer pg_dump/Borg-Snapshot unmittelbar VOR** jedem Produktions-Deploy (Runbook-Schritt 1).
  Coolify macht KEIN automatisches Pre-Deploy-DB-Snapshot — das müssen wir selbst erzwingen.
- **Rollback-Pfad dokumentiert:** Coolify „Deployments"-Tab → vorheriges erfolgreiches Image
  zurückrollen (ohne Rebuild). Für die DB: der Pre-Deploy-Dump ist der Wiederherstellungspunkt.
- **Off-site bleibt** (Borg/Hetzner Storage Box, bereits vorhanden).

### Säule 4 — DEPLOY-RUNBOOK (verbindliche Checkliste)
*Eine Checkliste, die riskante Deploys erzwingt zu stoppen. Liegt in `deploy/DEPLOY-RUNBOOK.md`.*

Vor JEDEM Produktions-Deploy:
1. Betrifft der Deploy den **DB-/Infra-Stack**? Wenn ja → doppelte Vorsicht, Backup zwingend.
2. Wird ein **neuer Service** hinzugefügt? → MUSS eine eigene Resource sein, NIE in den DB-Stack.
3. Wurde ein `networks:`-Block geändert? → prüfen, ob Coolify ihn übernimmt (er überschreibt sie!).
4. **Backup gemacht?** (pg_dump/Borg-Snapshot bestätigt.)
5. **Erst auf Staging deployt + Smoke-Test grün?**
6. Erst dann Produktion promoten.
7. Nach Deploy: Smoke-Test gegen Produktion, Container-Status prüfen.

---

## Umsetzungs-Reihenfolge (Vorschlag)

| # | Schritt | Wirkung | Aufwand |
|---|---|---|---|
| 0 | **AKUT:** DB-Stack wiederherstellen (Worker ist raus) | App wieder online | jetzt |
| 1 | Deploy-Runbook + Smoke-Test-Skript | sofortiger Prozess-Schutz | klein |
| 2 | Backup-vor-Deploy automatisieren | Sicherheitsnetz | klein |
| 3 | **Staging-Umgebung** (Weg A: 2. Coolify-Env auf demselben Server) | Kernforderung erfüllt | mittel |
| 4 | **DB/Redis in eigene Coolify-Resource** aus dem Compose-Monolith lösen | strukturelle Isolation | mittel-groß |
| 5 | (später) eigener Staging-Server (Weg B) | volle Isolation | groß/Kosten |

Schritt 1–3 sind der Kern deiner Forderung („Zwischenstep vor der echten Webseite"). Schritt 4 macht
den ursprünglichen Fehler **strukturell unmöglich**.

---

## Quellen (recherchiert)
- Coolify Docs — Docker Compose & Backups (coolify.io/docs)
- Mornati: „Achieving Zero-Downtime Deployments on Coolify — Monolith to Decoupled" (blog.mornati.net)
- Zenith-Stack: „Coolify in Production: What the Docs Don't Tell You"
- Docker Compose Restart-Policies (Baeldung) — bestätigt: Docker isoliert Crash-Loops; der Stack-Kill
  war Coolify-Deploy-Verhalten, nicht Docker.
