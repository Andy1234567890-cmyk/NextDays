# Performance-Analyse: Warum es bei 100 Nutzern zusammenbricht

**Stand:** 05.07.2026 · live gemessen gegen den Produktionsserver (65.21.144.136) +
3 unabhängige Code-Analysen (Frontend, Backend, Infra).

---

## Kernaussage in einem Satz

Der Server ist **nicht** zu klein — er ist zu ~5 % ausgelastet. Das Problem ist ein
**Chatty-Muster**: eine einzige Kalender-Öffnung feuert **~340 HTTP-Requests**, jeder
Channex-Push blockiert **synchron im Request** (bis ~52 s), und **keine Liste ist
paginiert**. Bei 100 Nutzern multipliziert sich das zu zehntausenden Requests.

**Ein Load Balancer / zweiter Server hilft NICHT** — er verteilt dasselbe kaputte Muster
auf zwei gleich überlastete Kopien. Der Fix ist Software, nicht Hardware.

---

## Gemessene Fakten (live, nicht geschätzt)

| Messung | Wert | Bedeutung |
|---|---|---|
| Einzelner `/availability`-Call (90 Tage, 1 Objekt) | **35–95 ms** | Backend selbst ist schnell |
| Datenmenge (availability / reservations / dynamic_prices) | 1154 / 17 / 548 Zeilen | **winzig** → Langsamkeit ≠ Datenmenge, sondern Roundtrips |
| Kalender-Öffnung, Test-Betrieb (34 Objekte) | **~340 Requests** | 2 Calls/Objekt × ~5 Prefetch-Chunks |
| Rate-Limit `listings` | **60 / 60 s, pro IP** | 68 Requests reißen es sofort → HTTP 429 |
| Ergebnis meiner Last-Messung (68 parallele Calls) | **68/68 → 429** | der Nutzer rate-limitet sich selbst |
| CPU-Spike bei 1 Kalender-Aufruf | **185 %** | 6+ serielle DB-Roundtrips × 34 Objekte |
| Server | 8 Kerne, 15 GB RAM, ~10 GB frei | reichlich Reserve |
| uvicorn-Worker | **2** | 6 von 8 Kernen brachliegend |
| PostgREST-DB-Pool | **10** (Default, nicht gesetzt) | echter Backend-Durchsatz-Deckel |
| Postgres `max_connections` | 100 (51 belegt) | eng, aber nicht der erste Bruch |

---

## Die drei Wurzeln

### Wurzel 1 — N+1-Requests im Frontend (Chatty Reads)

Der Kalender lädt **pro Objekt 2 Calls** (`/availability` + `/stop-sell`) und zieht per
Prefetch das **ganze Jahr in ~5 Chunks** nach → **~340 Requests pro Öffnung**.
`stop-sell-calendar.tsx` ist noch schlimmer (N×(K+1) synchron beim Mount).

Verstärker: **29 von 57 `useRealtime`-Subscriptions sind ungefiltert** (tenant-weit). Der
Kalender allein hat **8 ungefilterte Subs**, die alle denselben Voll-Reload auslösen.
Ein einziger OTA-Import (schreibt 365 availability-Zeilen) → **jeder** der 100 Nutzer mit
offenem Kalender macht einen Voll-Reload = **~100 × 340 Requests** in einem Zeitfenster.
Das ist der Zusammenbruch-Multiplikator.

Dazu: **keine Liste ist paginiert** — `listReservations`, `listProperties`,
`list_invoices`, Inbox-Threads laden immer den **kompletten** Tenant-Datenbestand, bei
jedem Realtime-Event neu.

### Wurzel 2 — Channex-Pushes blockieren synchron im Request

**Die in Phase 1a gebaute Job-Queue (`jobs/queue.py`, `worker.py`) wird von keinem
Service benutzt** — `grep enqueue features/` = 0 Treffer. Alle Channex-Pushes laufen
**inline im HTTP-Request**:

- `properties.publish()` → `sync_content` = 3 + N Rate-Plans + Steuern sequentielle
  Channex-Calls, **nicht best-effort** → ein Timeout hängt den Publish ~52 s.
- `reservations.create/move/cancel` → Availability-Push + Dynamic-Pricing-Recompute inline
  → der Gast wartet auf externe Calls.
- `calendar.bulk_edit` / `adjust_season_price_pct` → bis zu **90 sequentielle Channex-Calls
  in einem Request** (obwohl `push_rates_batch` existiert).

Kostenbasis pro Call: httpx-Timeout **30 s** + `time.sleep`-Backoff bis **22 s**. Bei 100
Nutzern ist der Sync-Threadpool in Sekunden erschöpft → Totalausfall.

### Wurzel 3 — Infra-Defaults zu eng für den heißen Pfad

- **uvicorn 2 Worker** auf 8 Kernen → nur ¼ der CPU nutzbar.
- **PostgREST-Pool 10** → 100 Nutzer stauen sich an 10 DB-Connections.
- **`listings` 60/60 pro IP** → sprengt sich schon bei 1 Nutzer; bei Büro-NAT teilen sich
  Mitarbeiter das Limit.
- Redis ohne `maxmemory-policy` → OOM-Risiko sperrt Logins (Auth ist fail-closed).

---

## Priorisierter Fix-Plan (nach Wirkung/Aufwand)

### Sofort — kleine Änderungen, große Wirkung (Stunden)
1. **`UVICORN_WORKERS=2 → 4`** (Env). 6 → 4 brachliegende Kerne aktiviert.
2. **`PGRST_DB_POOL=10 → 25`** (Coolify-Env; Σ Pools < max_connections). Verdopplung+ des
   Backend-Durchsatzes.
3. **`listings`-Rate-Limit pro Tenant keyen + auf ~240/60** (statt pro IP 60/60). Beendet
   die 429-Selbstsperre sofort.
4. **Redis `maxmemory` + `maxmemory-policy noeviction`** setzen.

### Kurzfristig — der Haupthebel (1–2 Tage)
5. **Batch-Kalender-Endpunkt**: `GET /calendar/board?property_ids=…&start&end` liefert
   Availability + Stop-Sell + Preise für **alle** Objekte in **einem** Call mit **wenigen**
   `.in_()`-Queries. Aus ~340 Requests werden **1–2**. Entschärft Wurzel 1 **und** den
   CPU-Spike **und** das Rate-Limit gleichzeitig.
6. **Prefetch drosseln**: nicht das ganze Jahr laden, nur sichtbares Fenster + Puffer.

### Mittelfristig — die eigentliche Skalierung (= Phase 2 des Skalierungsplans)
7. **Channex-Pushes über die Job-Queue** statt inline (`enqueue` in
   properties/rates/calendar/reservations). Die Infrastruktur steht bereits (Phase 1a).
   Requests antworten sofort, der Worker pusht im Hintergrund mit Token-Budget.
8. **Pagination** auf allen List-Endpunkten (Zeitfenster + limit): reservations.list/
   dashboard, booking_engine.list_listings, buchhaltung-Listen.
9. **Realtime-Subs filtern** (`property_id`/tenant) + inkrementell patchen statt Voll-Reload.

### Ergänzend
10. **Fehlende Indizes**: `reservations(tenant_id, status, check_in)`,
    `rate_plans(property_id, created_at)`, `channex_*_map`-Lookups.
11. **booking_engine.list_listings**: Pagination + gebündelte Preis-Queries (`.in_()`)
    (öffentlicher, unauthentifizierter Marktplatz-Endpunkt → höchstes Volumen).

---

## Warum kein Load Balancer / zweiter Server

Der Screenshot war Hetzners Load-Balancer-Anlage. Ein LB verteilt Traffic auf **mehrere**
Server. Aktuell:
- **1 Server, ~5 % ausgelastet** — kein Kapazitätsmangel.
- Das Problem sind **340 Requests pro Klick**, nicht zu wenig Rechenleistung.
- Ein LB würde diese 340 Requests auf zwei gleich überlastete Kopien verteilen; Rate-Limit,
  PostgREST-Pool-10 und CPU-Spike bleiben — bei doppelten Kosten.

**Fazit:** Bei Hetzner bleiben, ein Server genügt für die 100 Betriebe. Erst die drei
Wurzeln fixen; horizontale Skalierung (LB + 2. Server) ist ein Thema für >>100 Betriebe und
erst sinnvoll, wenn der Server wirklich CPU-limitiert ist (heute nicht).
