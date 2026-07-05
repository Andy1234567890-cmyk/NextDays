# Umsetzungsplan — 100 Betriebe bis Jahresende

**Ziel:** myNextDays trägt bis Jahresende **~100 Betriebe** stabil:
- **80 Ferienanbieter (FEWO)** — je ~10 Objekte → **~800 Channex-Properties**
- **20 Hotels** — je ~20 Zimmer(-typen) → echtes Hotel-Modell (1 Property, N Room-Types)

**Gesamt-Größenordnung:** ~800 FEWO-Einheiten + 20 Hotels mit je mehreren Room-Types.
Das liegt über der heutigen Bruchzone (serieller Cron bricht ab ~150 Einheiten) → die
Skalierungs-Bausteine sind Pflicht, nicht optional.

**Grundprinzip:** ordentlich, nicht schnell. Jede Phase hat Gates (ruff/pylint 10.00/pytest,
tsc) und wird gegen die echte Server-DB + Channex-Staging live verifiziert, bevor die
nächste beginnt. Kein Merge ohne grüne Gates. Doku/Diagramme nach jeder Phase aktualisieren.

---

## Ausgangslage (verifiziert gegen echten Code + DB, 05.07.2026)

**Was schon da ist und trägt:**
- FEWO-Modell (Objekt = 1 Property = 1 synthetischer Room-Type) funktioniert und ist getestet.
- Mandantentrennung robust (RLS vollständig seit 0084, kein Cross-Tenant-Leak).
- Rollenmodell sauber (admin/co_admin/owner/staff/cleaner + Permissions).
- Redis läuft bereits (Rate-Limiting, AOF-Persistenz-Volume) → als Queue-Broker nutzbar.
- Worker-Service im Compose vorgedacht (auskommentiert, `command: python -m src.worker`).
- Restrictions/Availability werden gechunkt; 429-Backoff vorhanden.
- `accommodation_type` (`vacation_rental`|`hotel`) existiert; PropertyType kennt Hotel-Zimmertypen (0098).

**Was fehlt / bricht bei 100 Betrieben:**
- **Keine echte Job-Queue** — Channex-Pushes laufen synchron im Request-Pfad (2 Uvicorn-Worker).
- **Serieller Single-Thread-Cron** — `reconcile_all_tenants` überlappt sich ab ~150 Einheiten.
- **Outbox nur für Availability** — Preise/Restriktionen sind best-effort ohne Retry.
- **Kein echtes Hotel-Modell** — 1 Property = 1 synthetischer Room-Type; 20 Zimmer eines Hotels
  müssten heute als 20 Einzel-Objekte gebaut werden (kein gemeinsamer Bestand pro Kategorie).

---

## Phasen-Übersicht & Reihenfolge

Reihenfolge nach Abhängigkeit und Risiko. FEWO (Mehrheit) zuerst absichern, Hotel-Modell als
sauberes eigenes Teilprojekt danach — nicht unter Zeitdruck parallel quetschen.

```
Phase 0  Härtung + Vorbereitung      (klein, sofort)     ──┐
Phase 1  Job-Worker + Queue          (Fundament)          │  FEWO-Skalierung:
Phase 2  Sync raus aus Request-Pfad  (baut auf 1)         │  danach tragen 800 Objekte
Phase 3  Outbox vollständig          (baut auf 1)        ──┘
Phase 4  Echtes Hotel-Modell         (eigenständig, größter Brocken)
Phase 5  Last-/Abnahmetest 100 Betriebe + Doku
```

---

## Phase 0 — Härtung & Vorbereitung
*Klein, sofort, entkoppelt. Räumt bekannte Risiken weg, bevor der Umbau beginnt.*

1. **`rate_limit_trusted_proxy_hops` korrekt setzen** (config/Coolify-Env). Hinter Traefik zählt
   sonst die Proxy-IP → alle Clients teilen einen Bucket. Kritisch bei 100 Betrieben.
2. **`channex_tax_map`-Query härten** — `.eq("tenant_id", …)` ergänzen (content_sync.py:645/660).
   Kein aktives Leak, aber Regel-Einhaltung.
3. **Baseline-Messung** — aktuellen Sync-Durchsatz (Requests/Objekt, Cron-Dauer) dokumentieren,
   damit der Fortschritt der Skalierungs-Phasen messbar ist.

**Gate:** ruff/pylint 10.00/pytest grün. **Verifikation:** trusted-hops live gegen Server prüfen.

---

### Baseline (Phase 0.3, gemessen 05.07.2026 gegen echte Umgebung)

| Metrik | Wert | Quelle |
|---|---|---|
| 1 Full-Content-Sync eines Objekts | **3,01 s** | live gemessen (Smoke-Testhaus) |
| 800 FEWO-Objekte seriell (Full-Resync) | **~40 min** | Hochrechnung 3,01 s × 800 |
| 1.200 Einheiten seriell | **~60 min** | Hochrechnung 3,01 s × 1.200 |
| Reconcile-Intervall heute | 15 min | jobs/reconcile.py |
| → Selbstüberlappung bei Zielgröße | **3–4×** | 40–60 min ≫ 15 min |

**Messlatte für Phase 1:** Mit Worker-Concurrency (z. B. 10 parallele Jobs) muss der
Full-Resync von 800 Objekten unter das 15-min-Intervall fallen (~4–6 min Ziel), sodass
sich der Reconcile-Zyklus nicht mehr selbst überlappt.

**Phase-0-Ergebnis:**
- 0.1 `trusted_proxy_hops=0` ist **korrekt** (live verifiziert: keine Cloudflare-Schicht,
  Traefik ersetzt XFF) — kein Änderungsbedarf. Bei späterer Cloudflare-Schicht → auf 1 erhöhen.
- 0.2 `channex_tax_map`-Query um `tenant_id`-Filter gehärtet (content_sync.py). Gates grün.
- 0.3 Baseline oben gemessen und dokumentiert.

---

## Phase 1 — Job-Worker + Queue (Fundament)
*Der eine Baustein, der 1.000+ Einheiten überhaupt tragbar macht.*

**Ziel:** persistente Queue auf dem bereits laufenden Redis; ein Worker-Prozess arbeitet Jobs
mit Concurrency-Pool ab. Kein neuer Infrastruktur-Baustein (Redis existiert).

**Bausteine:**
1. **Queue-Bibliothek wählen** — `arq` (asyncio-nativ, Redis, schlank) oder `rq`. Empfehlung `arq`,
   passt zu FastAPI/async und zum vorhandenen redis.asyncio.
2. **`src/worker.py`** als Einstiegspunkt (der auskommentierte Compose-Service erwartet genau das).
3. **Job-Typen definieren:** `sync_property_content`, `push_ari`, `reconcile_tenant`,
   `recompute_property` — jeweils idempotent, tenant-gescopt, mit tenant_id im Job-Payload.
4. **Concurrency-Pool + kontoweites Channex-Budget** — max. gleichzeitige Channex-Requests global
   begrenzen (Token-Bucket in Redis), damit das eine geteilte Channex-Konto nicht überläuft.
5. **Worker-Service im Compose aktivieren** (auskommentierten Block einkommentieren + testen).

**Gate:** ruff/pylint 10.00/pytest (Job-Handler unit-getestet) + tsc.
**Verifikation:** Worker läuft im Container, verarbeitet Test-Jobs, überlebt Neustart (AOF).

---

## Phase 2 — Sync raus aus dem Request-Pfad
*Baut auf Phase 1. Nutzer-Requests dürfen nicht mehr auf Channex blockieren.*

**Ziel:** Jede Stelle, die heute synchron an Channex pusht, reiht stattdessen einen Job ein.

**Betroffen (aus der Analyse belegt):**
- `properties/service.py` — create/update/publish/Foto-Upload → Job statt synchroner Sync.
- `rates/service.py` — Preisänderung löst heute kompletten Content-Sync im Request aus → Job.
- `calendar/service.py` — block/unblock/season_price/stop_sell/min_stay/bulk_edit → Jobs.
- `bulk_edit` — heute 100+ serielle Pushes in einem Request → ein Batch-Job.

**Wichtig:** Debouncing/Coalescing — mehrfaches Speichern desselben Objekts in kurzer Zeit
darf nicht N Full-Syncs auslösen, sondern einen. (Job-Key = tenant+property, letzter gewinnt.)

**Gate:** Gates grün + bestehende Tests unverändert (Verhalten bleibt gleich, nur async).
**Verifikation:** Preisänderung im UI → Response sofort, Channex-Wert kommt kurz danach (Job).

---

## Phase 3 — Outbox vollständig
*Baut auf Phase 1. Geschäftskritische Werte dürfen nicht mehr still auseinanderdriften.*

**Ziel:** Preis-, Min-Stay-, Stop-Sell-, Max-Stay-, CTA/CTD-Pushes bekommen dieselbe
Retry-Garantie wie Availability heute.

**Bausteine:**
1. Outbox-Konzept auf alle Restriction-/Rate-Pushes ausweiten (nicht nur ari_outbox/Availability).
2. `process_ari_outbox` — hartes `limit=200` durch dynamisches/queue-getriebenes Abarbeiten ersetzen,
   damit es bei hohem Aufkommen aufholt.
3. Reconcile bleibt als Sicherheitsnetz, ist aber nicht mehr die einzige Konsistenz-Garantie.

**Gate:** Gates grün. **Verifikation:** simulierter Channex-Ausfall → Werte landen nach
Recovery vollständig (kein Verlust), gegen Channex-Staging gegengelesen.

---

## Phase 4 — Echtes Hotel-Modell (1 Hotel = 1 Property, N Room-Types)
*Eigenständig, größter struktureller Brocken. Läuft parallel zum bestehenden FEWO-Modell.*

**Ziel:** Ein Hotel ist EINE Channex-Property mit MEHREREN Room-Types (Zimmerkategorien),
jeder mit eigener Kapazität/Bestand/Preis — statt jedes Zimmer als eigenes Objekt.

**Bausteine:**
1. **Datenmodell:** neue Struktur „Hotel (property) → room_types → rate_plans". Migration; die
   heutige `channex_room_type_map` (1:1) auf N:1 erweitern. FEWO bleibt unverändert (1 synth.
   Room-Type) — die Betriebsart `accommodation_type` steuert den Pfad.
2. **content_sync:** `_upsert_channex_room_type` von „genau 1 synthetisch" auf „N echte
   Room-Types je Hotel" erweitern; `count_of_rooms`/Belegung pro Kategorie.
3. **ARI/Kalender:** Bestand/Preis/Restriktionen pro Room-Type statt pro Property.
4. **Frontend:** Zimmertyp-Verwaltung im Hotel-Objekt (Dashboard) — nur bei `hotel`.
5. **Betroffene Backend-Dateien (Umbaufläche, verifiziert):** content_sync.py, ari_push.py,
   bookings_sync.py, channels.py, schemas.py, tests.

**Gate:** Gates grün, FEWO-Tests unverändert (kein Regress am bestehenden Modell).
**Verifikation:** Test-Hotel mit 3 Zimmertypen live an Channex-Staging → 1 Property, 3 Room-Types,
Bestand/Preis je Typ korrekt gegengelesen.

---

## Phase 5 — Last-/Abnahmetest & Doku
*Beweis, dass die Zielgröße wirklich trägt.*

1. **Lasttest:** ~1.000 FEWO-Objekte + einige Hotels in Staging anlegen, Full-Resync +
   Reconcile-Zyklus messen (Dauer, Channex-429-Rate, DB-Last, Worker-Durchsatz).
2. **Schwellen prüfen:** Reconcile-Zyklus < Intervall (keine Selbstüberlappung)? Queue holt auf?
3. **Doku/Diagramme aktualisieren** (ER/C4/API) — Worker, Queue, Hotel-Modell einzeichnen.
4. **Recovery testen:** Worker-Neustart mitten im Sync → keine verlorenen/doppelten Pushes.

---

## Meilensteine (grob, bis Jahresende)

| Meilenstein | Inhalt | Ergebnis |
|---|---|---|
| **M0** | Phase 0 | Härtung durch, Baseline gemessen |
| **M1** | Phase 1–3 | **FEWO-Skalierung fertig** → 800 Objekte tragen stabil |
| **M2** | Phase 4 | **Hotel-Modell fertig** → 20 Hotels sauber abgebildet |
| **M3** | Phase 5 | **Abnahme** → 100 Betriebe live-getestet, Doku aktuell |

**Kritischer Pfad:** M1 zuerst (Mehrheit der Betriebe, baut auf funktionierendem Modell).
M2 ist der größte Einzel-Umbau, aber weniger Betriebe — bewusst nach M1, nicht parallel.

---

## Risiken & Gegenmaßnahmen

- **Ein geteilter Channex-Key** → kontoweites Token-Budget (Phase 1) verhindert, dass ein
  Massen-Sync alle Betriebe rate-limitet. Langfristig ggf. Key pro Agentur erwägen (nicht Teil
  dieses Plans).
- **Hotel-Umbau berührt Kernpfade** → FEWO-Tests als Regressionsnetz; Betriebsart-Weiche trennt
  die Pfade sauber, altes Modell bleibt unangetastet.
- **Zeitdruck** → M1 liefert schon den Großteil des Werts; M2 kann notfalls ins neue Jahr
  rutschen, ohne die 80 FEWO-Betriebe zu blockieren.

---

*Dieser Plan ist die verbindliche Reihenfolge. Nach jeder Phase: Gates grün, Live-Verifikation,
Doku aktualisiert — erst dann die nächste Phase.*
