# Umsetzungsplan — Channex-Zertifizierung Test #10 (Multiple Date Availability Update)

Stand: 2026-07-17 · Version 3 (Runde 1 eingearbeitet; Ist-Befund auf Zimmer-Modell korrigiert)
Status: Plan (KEINE Code-Änderung) · Zielumgebung: Staging (65.21.144.136)

---

## 1. Ziel

Channex-Zertifizierungstest #10 bestehen. Anforderung laut Doku (verbatim geprüft):

| Room Type   | Date                                | Value |
|-------------|-------------------------------------|-------|
| Twin Room   | 10 November 2026 – 16 November 2026 | 3     |
| Double Room | 17 November 2026 – 24 November 2026 | 4     |

> „This should be 1 or 2 API calls" — und: „You will receive a task ID in a successful
> response from Channex. We need that task ID in the certification form for each test case."

Abzuliefern im Formular: die Channex-**Task-IDs** der Availability-Calls, eine pro Zeile.

## 2. Datenmodell (verbindlich) und Adaption

**Konto/Tenant = der Betrieb** (hier: „Hotel One"). **Jede `properties`-Zeile = genau EIN
Zimmer** (Hotel) bzw. ein Ferienobjekt (FeWo) — unter `/objekte` werden beim Hotel
**Zimmer** geführt. NIE ein „Hotelgebäude mit Zimmerkategorien darunter" (CLAUDE.md,
unverhandelbar; der Hotel-Container-Zweig wurde in `9dba79b`/`1daac8a` vollständig
zurückgebaut). Availability je Zimmer ist **binär 0/1** (synthetischer Channex-Room-Type,
`count_of_rooms=1`).

Für Test #10 braucht es die Zimmer **„Twin Room"** und **„Double Room"**. Vorhanden ist
EIN Zimmer → die zwei benötigten Zimmer werden per **DB-Klon als Entwurf** angelegt (§4).

Die Channex-Doku deckt zwei Abweichungen unterschiedlich ab:

1. **Struktur** (jedes Zimmer = eigene Channex-Property mit einem Room-Type): erlaubt —
   > „**Vacation rental / single-unit products:** if your product models only one unit …
   > configure the Channex staging property to mirror your actual data model … In the
   > certification form, note which tests you adapted and how."
2. **Werte** (3/4 sind mit 1 Einheit je Zimmer nicht darstellbar): allgemeine
   Initial-Steps-Regel —
   > „If you can't support anything please make a note in the certification file."

**Adaption für Test #10:**
- Twin-Range wird **gesperrt (0)**, Double-Range wird **entsperrt (1)** — zwei Calls mit
  zwei UNTERSCHIEDLICHEN Werten, die stärkste Entsprechung von „3 vs. 4" im binären Modell.
- Beides wird im Formular notiert (§10); die Werte-Adaption wird **vor dem Absenden mit
  dem Channex-Support/Zertifizierungskontakt geklärt** (§2-Regel 2 ist eine Notiz-Pflicht,
  keine ausdrückliche Erlaubnis).

## 3. Ist-Zustand (live gegen die Server-DB verifiziert, 2026-07-17)

Quelle: `psql` als `supabase_admin` im Container `db-cdqxi7d0w34sxzr4wr8jy8um`
(Container-Name dynamisch auflösen, kann nach Redeploy wechseln).

- **Vorhandenes Zimmer (Quelle für den Klon):** `properties.id =
  956747c8-fa04-4157-a1c4-b0cb8e0de5d8`, Titel „Twin & Double Testhotel" (historisch —
  es ist EIN Zimmer-Objekt, **kein** Container), `property_type='doppelzimmer'`,
  `status=active`, `max_guests=2`, Mittenwalde/DE, Tenant „Hotel One"
  (`b6409cd7-82d5-444a-9581-55f0c45b13d7`). 500 Tage `availability`-Zeilen vorhanden.
- **Channex-Anbindung des Zimmers:** aktive Map `channex_property_id =
  79d6d58e-368e-4b3a-80b9-6445684ebf9b`. Die Room-Type-Maps der Container-Ära
  (Twin `be9915f7…`, Double `d0ece597…` aus Hotel-Teil 2) sind **soft-deleted**;
  aktiv ist genau EIN synthetischer Room-Type `91a30523-c355-4aa7-becc-1d754299fb98`
  (`local_unit_ref = property_id`) mit **2 aktiven Rate-Plan-Maps**
  (BAR `ecf9d554…`, B&B `51eaed39…`). Tests 1–9 liefen auf dieser Channex-Property
  (teils noch in der Container-Struktur mit Twin/Double-Room-Types).
- **Rate-Plans des Zimmers** (beide `rate_mode='manual'`, **USD** — entspricht dem
  Cert-Setup „BAR $100 / B&B $120"):
  - `e7e05a1b-52f4-42f3-9e45-7cc8348696e7` „Best Available Rate", 100.00 USD, min_stay 1
  - `75e0d295-82d3-4907-9773-29a8af9c1b2f` „Bed & Breakfast", 120.00 USD, min_stay 1
- `rate_plans` hat live **14 Spalten** (kein `room_type_id`, keine `room_types`-Tabelle —
  Rückbau vollzogen). `derived_from_rate_plan_id` bei beiden NULL → kein Derived-Remapping.
- `property_type`-Enum enthält die Zimmertypen: u. a. `zweibettzimmer` (= Twin,
  zwei Einzelbetten) und `doppelzimmer` (= Double) — die Klone bekommen die fachlich
  korrekten Typen (§4).
- **Fotos:** Channex-Content-Fotos kommen aus `property_photos`
  ([content_sync.py:205-211](../apps/api/src/features/channel_manager/content_sync.py)),
  NICHT aus `properties.photos`. Das Quell-Zimmer hat dort **0 Zeilen** (live geprüft) —
  seine Channex-Property existiert nachweislich ohne Content-Fotos. Die Klone spiegeln
  das exakt; ein Foto-Klonschritt entfällt.
- `type_attributes` des Quell-Zimmers enthält **weder** `availability` (kein maxStay →
  Publish enqueued keinen max_stay-Job) **noch** `occupancy` (→ `count_of_rooms=1`,
  `occ_adults = max_guests = 2` — passt zum Cert-Setup „Twin/Double, 2 occupancy").
- **Umgebung:** `CHANNEX_BASE_URL` ist auf API- und Worker-Container NICHT gesetzt →
  Code-Default `https://staging.channex.io/api/v1` greift
  ([config.py:91](../apps/api/src/core/config.py)). Worker-Container läuft
  (`worker-ly4w6vw4ffxk2987nyg5z5kt`).
- **Alt-Lasten:** zwei Draft-Zimmer „Doppelzimmer" (`f3c7af30…`, `fc50a7a3…`) mit
  soft-deleteten Channex-Maps und EUR-„Standard"-Plan. Werden **NICHT wiederverwendet**
  (unvollständig, falsche Währung, tote Mappings) — bleiben unberührt.

## 4. Schritt 1 — Zwei Zimmer per DB-Klon anlegen (als **Entwurf**)

Zwei Klone des vorhandenen Zimmers, `status='draft'`:

| Klon | Titel | property_type |
|------|-------|----------------|
| 1 | **Twin Room** | `zweibettzimmer` (Twin = zwei Einzelbetten) |
| 2 | **Double Room** | `doppelzimmer` |

Die Titel entsprechen exakt den Room-Type-Namen des Cert-Setups — der Reviewer erkennt
Twin/Double unmittelbar wieder. Ausführung per SSH auf dem Staging-Server, `psql` als
`supabase_admin` (Service-Pfad; `tenant_id` wird 1:1 übernommen → Tenant-Scope bleibt
korrekt). Keine Unique-Constraints auf `title`/`name`, keine Trigger auf
`properties`/`rate_plans` (gegen Migrationen und Live-Schema geprüft).

**Warum DB-Klon statt UI-Anlage:** identische, sync-fähige Datenbasis (Adresse/Geo/
`type_attributes`) ohne Abweichung durch manuelle Eingabe — und bewusst NICHT über die
UI, denn jedes UI-Update eines Content-Felds enqueued einen Content-Sync (Schutzfenster
§5.1).

### 4.1 Properties klonen (explizite Spaltenliste — kein `SELECT *`)

```sql
BEGIN;

INSERT INTO public.properties
  (tenant_id, title, description, address, lat, lng, amenities, max_guests, photos,
   status, property_type, type_attributes, street, house_number, postal_code, city,
   country, bfe_number, boligtype, platform_description, deposit_amount)
SELECT
   tenant_id, 'Twin Room', description, address, lat, lng,
   amenities, max_guests, photos, 'draft', 'zweibettzimmer'::property_type,
   type_attributes, street, house_number, postal_code, city, country, bfe_number,
   boligtype, platform_description, deposit_amount
FROM public.properties
WHERE id = '956747c8-fa04-4157-a1c4-b0cb8e0de5d8'
RETURNING id;   -- <TWIN_ID> notieren

INSERT INTO public.properties
  (tenant_id, title, description, address, lat, lng, amenities, max_guests, photos,
   status, property_type, type_attributes, street, house_number, postal_code, city,
   country, bfe_number, boligtype, platform_description, deposit_amount)
SELECT
   tenant_id, 'Double Room', description, address, lat, lng,
   amenities, max_guests, photos, 'draft', 'doppelzimmer'::property_type,
   type_attributes, street, house_number, postal_code, city, country, bfe_number,
   boligtype, platform_description, deposit_amount
FROM public.properties
WHERE id = '956747c8-fa04-4157-a1c4-b0cb8e0de5d8'
RETURNING id;   -- <DOUBLE_ID> notieren

COMMIT;
```

### 4.2 Rate-Plans klonen (BAR zuerst, deterministisch)

Reihenfolge-Begründung (präzise): `sync_content` legt die Channex-Rate-Plans in
`rate_plans.created_at`-Reihenfolge an ([content_sync.py:215-221](../apps/api/src/features/channel_manager/content_sync.py));
`_resolve_channex_rate_plan` nimmt danach das älteste **Mapping**
([ari_push.py:622-630](../apps/api/src/features/channel_manager/ari_push.py)) — die
BAR-zuerst-Ordnung überträgt sich transitiv. `now()` ist innerhalb einer Transaktion
konstant, deshalb wird B&B explizit mit `+ interval '1 second'` gestaffelt.

Guard vorab (MUSS 0 liefern, sonst STOPP):

```sql
SELECT count(*) FROM public.rate_plans
WHERE property_id = '956747c8-fa04-4157-a1c4-b0cb8e0de5d8' AND rate_mode <> 'manual';
```

```sql
BEGIN;

INSERT INTO public.rate_plans
  (property_id, name, base_price, currency, min_stay, season_rules,
   weekend_surcharge, rate_mode, created_at)
SELECT '<TWIN_ID>', name, base_price, currency, min_stay, season_rules,
       weekend_surcharge, rate_mode, now()
FROM public.rate_plans WHERE id = 'e7e05a1b-52f4-42f3-9e45-7cc8348696e7';

INSERT INTO public.rate_plans
  (property_id, name, base_price, currency, min_stay, season_rules,
   weekend_surcharge, rate_mode, created_at)
SELECT '<TWIN_ID>', name, base_price, currency, min_stay, season_rules,
       weekend_surcharge, rate_mode, now() + interval '1 second'
FROM public.rate_plans WHERE id = '75e0d295-82d3-4907-9773-29a8af9c1b2f';

INSERT INTO public.rate_plans
  (property_id, name, base_price, currency, min_stay, season_rules,
   weekend_surcharge, rate_mode, created_at)
SELECT '<DOUBLE_ID>', name, base_price, currency, min_stay, season_rules,
       weekend_surcharge, rate_mode, now()
FROM public.rate_plans WHERE id = 'e7e05a1b-52f4-42f3-9e45-7cc8348696e7';

INSERT INTO public.rate_plans
  (property_id, name, base_price, currency, min_stay, season_rules,
   weekend_surcharge, rate_mode, created_at)
SELECT '<DOUBLE_ID>', name, base_price, currency, min_stay, season_rules,
       weekend_surcharge, rate_mode, now() + interval '1 second'
FROM public.rate_plans WHERE id = '75e0d295-82d3-4907-9773-29a8af9c1b2f';

COMMIT;
```

### 4.3 Verifikation Schritt 1 (Pflicht, KEIN Weiter ohne Soll=Ist)

```sql
SELECT id, title, status, property_type, max_guests, city, country
FROM public.properties WHERE id IN ('<TWIN_ID>','<DOUBLE_ID>');
-- SOLL: Twin Room (zweibettzimmer, draft) + Double Room (doppelzimmer, draft)

SELECT property_id, name, base_price, currency, rate_mode, created_at
FROM public.rate_plans WHERE property_id IN ('<TWIN_ID>','<DOUBLE_ID>')
ORDER BY property_id, created_at;
-- SOLL: je 2 Plans, USD, BAR (100.00) vor B&B (120.00)

SELECT count(*) FROM public.channex_property_map
WHERE property_id IN ('<TWIN_ID>','<DOUBLE_ID>');
-- SOLL: 0 (Entwurf = nicht verbunden)
```

UI-Sichtprüfung: beide Zimmer erscheinen unter `/objekte` als **Entwurf**.
**Abbruchkriterium:** irgendeine Abweichung → STOPP, Ursache klären.

## 5. Schutzfenster + Schritt 2 — Veröffentlichen (Entwurf → aktiv)

### 5.1 Schutzfenster zwischen Klon und Publish (Draft ≠ automatisch Channex-frei!)

Kein Sync-Pfad filtert auf `status`. Zwei Pfade würden einen **Draft** vorzeitig mit
Channex verbinden:
- `resync_all_content` iteriert ALLE Zimmer/Objekte des Tenants
  ([content_sync.py:146-155](../apps/api/src/features/channel_manager/content_sync.py)) —
  getriggert u. a. durch **Firmenlogo-Upload**.
- Jedes **UI-Update eines Content-Felds** am Draft enqueued einen Content-Sync
  ([properties/service.py:316-322](../apps/api/src/features/properties/service.py)).

**Regel:** Zwischen Klon und Publish die Klone NICHT im UI bearbeiten, kein Logo/keine
tenant-weiten Content-Änderungen. Unmittelbar VOR dem Publish die Map-0-Prüfung aus §4.3
wiederholen; ist eine Map entstanden → STOPP und Zustand analysieren (nicht blind weiter).

### 5.2 Publish ausführen

Der Publish-Pfad ([properties/service.py:711-852](../apps/api/src/features/properties/service.py)):

1. `status → active` (VOR dem Sync gesetzt — siehe Fehlerbild in §12/Risiko 2)
2. `sync_content` **synchron/blockierend** (Channex-Property + synthetischer Room-Type +
   beide Rate-Plans + Maps). Fehler ⇒ HTTP-Fehler, Publish gilt als gescheitert.
3. `availability`: 500 Tage `open` seeden
4. Jobs: `full_sync_property` (1× Availability-RLE **plus** Rates über 500 Tage — die
   Rate-Seite expandiert per Datum und chunkt à 500 values: 500 Tage × 2 Pläne = 1000
   values ⇒ **2× POST /restrictions je Klon**) **und immer** `recompute_property`
   (No-op ohne Dynamic Pricing, erscheint aber in der jobs-Tabelle).
   Kein min_stay-Job (min_stay=1), kein max_stay-Job (kein `type_attributes.availability`,
   live geprüft — §3).

**Ausführung:** UI `/objekte` → „Veröffentlichen" je Zimmer
(API: `POST /api/v1/properties/{id}/publish`, [router.py:109](../apps/api/src/features/properties/router.py)).

**Voraussetzung vorab:** Worker läuft (§3 verifiziert; vor der Durchführung erneut
prüfen: `docker ps | grep worker`).

### 5.3 Verifikation Schritt 2 (Pflicht)

```sql
-- aktive Maps + Room-Type + 2 Rate-Plan-Maps je Klon:
SELECT p.title, pm.channex_property_id,
       (SELECT count(*) FROM channex_room_type_map rt
         WHERE rt.property_map_id = pm.id AND rt.deleted_at IS NULL)  AS room_types,
       (SELECT count(*) FROM channex_rate_plan_map rp
         JOIN channex_room_type_map rt2 ON rt2.id = rp.room_type_map_id
        WHERE rt2.property_map_id = pm.id AND rp.deleted_at IS NULL)  AS rate_plans
FROM channex_property_map pm JOIN properties p ON p.id = pm.property_id
WHERE pm.property_id IN ('<TWIN_ID>','<DOUBLE_ID>') AND pm.deleted_at IS NULL;
-- SOLL: je Klon 1 Zeile, room_types=1, rate_plans=2
-- Die channex_property_id von Twin und Double NOTIEREN (fürs Formular/Readback).

-- Jobs durchgelaufen — ERWARTET sind je Klon: full_sync_property (done)
-- UND recompute_property (done). Das ist KEIN Fehlerbild.
SELECT job_type, status, attempts, last_error FROM jobs
WHERE payload->>'property_id' IN ('<TWIN_ID>','<DOUBLE_ID>')
ORDER BY created_at DESC;
```

Debug-Log (`/channels`): Steps `property`, `room_type`, `room_type_prune`, `rate_plan`
(×2), `rate_plan_prune`, ggf. `taxes`/`hotel_policy`, danach `full_sync` — alle `ok=true`
(Step-Namen aus [content_sync.py](../apps/api/src/features/channel_manager/content_sync.py)
und [full_sync.py:59-61](../apps/api/src/features/channel_manager/full_sync.py)).
Channex-Staging-Dashboard: zwei neue Properties „Twin Room" / „Double Room" mit je 1
Room-Type und 2 Rate-Plans (BAR 100 / B&B 120 USD).

**Wichtig:** Erst wenn beide Jobs `done` sind und das Debug-Log ruhig ist, mit §6/§7
beginnen — sonst vermischen sich Full-Sync- und Test-Task-IDs.

## 6. Vorbereitung der Test-Aktion (Double-Range vorab sperren)

Damit Test #10 **zwei unterschiedliche Werte** zeigt (0 und 1, §2), wird die
Double-Range VOR dem eigentlichen Test gesperrt:

- Kalender → **Double Room** → Nächte **17.–24.11.2026** sperren.
- Diese Vorbereitung erzeugt einen eigenen availability=0-Push mit eigener Task-ID —
  **diese ID wird NICHT eingereicht** (notieren und verwerfen).
- **≥ 15 Minuten Abstand** zur Test-Durchführung lassen, damit die Debug-Log-Einträge
  zeitlich eindeutig trennbar sind.
- Verifikation: Channex-Inventory Double 17.–24.11.2026 = 0.

## 7. Schritt 3 — Test #10 ausführen (2 UI-Aktionen = 2 API-Calls, Werte 0 und 1)

Kette (verifiziert): Kalender-Sperre/-Freigabe
([calendar/service.py:389-421 bzw. 1495-1530](../apps/api/src/features/calendar/service.py)) →
`try_enqueue_ari(kind=availability)` (bewusst **ohne** Dedup —
[jobs/queue.py:124-157](../apps/api/src/jobs/queue.py)) → Worker `_handle_push_ari` →
`push_availability_for_property` ([ari_push.py:438-570](../apps/api/src/features/channel_manager/ari_push.py)):
RLE-Ranges ⇒ **EIN** `POST /availability` mit `date_from/date_to` pro zusammenhängendem
Zeitraum. (Der Publish-Full-Sync schreibt KEINE `ari_outbox`-Zeilen — kein
Superseding-Risiko, der Test-Range zersplittert nicht.)

1. **Aktion A — Twin Room, Wert 0:** Zeitraum **sperren**, Nächte 10.–16.11.2026 inkl.
   ⇒ 1 Call `POST /availability`, value
   `{date_from: 2026-11-10, date_to: 2026-11-16, availability: 0}`.
2. **Aktion B — Double Room, Wert 1:** die in §6 gesetzte Sperre **aufheben**
   (Nächte 17.–24.11.2026). Der Unblock-Pfad pusht availability=1 nur für real offene
   Tage — die Klone haben keine Buchungen, also den vollen Range
   ([calendar/service.py:1502-1530](../apps/api/src/features/calendar/service.py))
   ⇒ 2. Call, value `{date_from: 2026-11-17, date_to: 2026-11-24, availability: 1}`.

Ergebnis: **2 API-Calls, zwei unterschiedliche Werte** — erfüllt „This should be 1 or 2
API calls" und bildet „3 vs. 4" bestmöglich ab.

**Eingabe-Semantik je UI-Pfad (beide führen zur selben API):**
- **Belegungsplan-Board (Drag-Select):** Zellen = Nächte; für Aktion A die Zellen
  **10.–16.11.** markieren (das exklusive `end=2026-11-17` bildet das Frontend selbst —
  [calendar-board.tsx:1350-1356](../apps/web/components/kalender/calendar-board.tsx)).
- **Bulk-Dialog:** Feld „Bis (einschließlich)" ist INKLUSIV → **16.11.2026** eintragen
  ([bulk-edit-dialog.tsx:125-128](../apps/web/components/kalender/bulk-edit-dialog.tsx)).

**Payload-Kontrolle (Pflicht):** Im Debug-Log `request_body` beider Calls prüfen:
genau EIN values-Eintrag, exakt die o. g. `date_from/date_to` und `availability`-Werte.
Abweichung (z. B. Enddatum ±1 Tag) → Aktion rückgängig machen, korrigiert wiederholen,
falsche Task-ID verwerfen.

## 8. Schritt 4 — Task-IDs ablesen

`/channels` → Debug-Panel ([channex-debug-panel.tsx:119-137](../apps/web/components/channel-manager/channex-debug-panel.tsx)):
die zwei jüngsten Einträge `step=availability`, `POST /availability`, `ok=true`.
Die **„Portal-ID"** je Eintrag ist die Channex-Task-ID (`data[0].id` der Antwort —
[channex_client.py:_emit_trace](../apps/api/src/features/channel_manager/channex_client.py)).

**Verwechslungsschutz:** Full-Sync-Availability-Calls loggen `step='full_sync'` und
fallen aus dem Filter unten heraus. Als `step='availability'`-Konkurrenten bleiben nur:
(a) `process_ari_outbox`-Cron-Retries (nur bei vorherigen Fehlern), (b) eigene Block-/
Unblock-Aktionen — insbesondere die **§6-Vorbereitungs-Sperre** und Wiederholungen aus
der Payload-Kontrolle. Deshalb IMMER Zeitstempel + `request_body`-Range gegen Aktion A/B
abgleichen:

```sql
SELECT created_at, property_id, channex_id, request_body
FROM channex_debug_log
WHERE step='availability' AND channex_path='availability' AND channex_method='POST'
  AND property_id IN ('<TWIN_ID>','<DOUBLE_ID>')
ORDER BY created_at DESC LIMIT 10;
```

## 9. Schritt 5 — Readback-Verifikation (dem 200 wird NICHT vertraut)

1. Channex-Staging-Dashboard → Inventory: Twin 10.–16.11.2026 = **0**;
   Double 17.–24.11.2026 = **1**; Tage außerhalb der Ranges unverändert.
2. Optional API-Readback: `GET /availability?filter[property_id]=<channex_property_id>`
   `&filter[date][gte]=…&filter[date][lte]=…` je Zimmer.

**Abbruchkriterium:** Readback ≠ erwartet → Task-IDs NICHT einreichen; Ursache über
Debug-Log/`ari_outbox` (`status`, `last_error`) klären.

## 10. Schritt 6 — Zertifizierungsformular ausfüllen

- Feld „Provide IDs received from Channex. One ID per line.": die **zwei** Task-IDs
  (Aktion A Twin, dann Aktion B Double), je eine Zeile.
- Extra Notes (Adaption + Property-Mapping — Tests 1–9 liefen auf der Channex-Property
  `79d6d58e…` („Twin & Double Testhotel"), Test #10 auf den zwei neuen Properties;
  das MUSS für den Reviewer nachvollziehbar sein; die neuen `channex_property_id`s
  aus §5.3 mit angeben):

> *Our product models each hotel room (or vacation-rental unit) as its own property —
> 1 property = 1 bookable unit, availability is binary 0/1 per unit. Per the
> certification guide's vacation-rental note we mirror our data model on staging. Our
> model does support multiple rate plans per unit, so each room keeps the two default
> rate plans (Best Available Rate $100 / Bed & Breakfast $120); only the unit/room-type
> level is single.*
> *For test 10 we created two dedicated rooms: "Twin Room" (channex property <ID Twin>)
> and "Double Room" (channex property <ID Double>). Earlier tests ran on our previous
> test property ("Twin & Double Testhotel", 79d6d58e-368e-4b3a-80b9-6445684ebf9b).
> Test 10 was performed as one multi-date range availability update per room, batched
> as a single ranged API call each — 2 calls total: Twin 2026-11-10..2026-11-16 set to 0
> (range closed), Double 2026-11-17..2026-11-24 set to 1 (range reopened). Values 3/4
> are not representable in a single-unit model; we demonstrated both possible values
> (0 and 1) instead, as noted per the "make a note in the certification file"
> instruction.*

- **Vorab-Klärung:** Die Werte-Adaption (0/1 statt 3/4) vor dem Absenden kurz mit dem
  Channex-Support/Zertifizierungskontakt bestätigen lassen (§2).

## 11. Live-Screenshare (Stage 4) und Wiederholbarkeit

Die Zertifizierung endet nicht mit dem Formular — Channex-Doku (verbatim):
*„Every test below will be reproduced on a live call by triggering the corresponding
action in your PMS UI."* (Stage 4: Live screenshare review, inkl. Ad-hoc-Aktionen).

Vorbereitung:
- Test #10 muss **live wiederholbar** sein: Sperren aufheben ⇒ availability=1-Push,
  erneut sperren ⇒ availability=0-Push — jede Wiederholung erzeugt neue, gültige
  Task-IDs. Die Klone bleiben deshalb bis zum Abschluss der Zertifizierung **aktiv**.
- Debug-Panel (`/channels`) im Screenshare geöffnet halten — Task-IDs und Payloads sind
  dort live zeigbar (stärkstes Argument gegenüber dem Reviewer).
- Beanstandet der Reviewer eingereichte Task-IDs: Aktion im Call wiederholen, neue IDs
  direkt aus dem Panel vorlesen/nachreichen; das Formular ist bis zum Absenden editierbar.

## 12. Risiken / Abbruchkriterien (keine Fallbacks, fail-closed)

| # | Risiko | Erkennung | Verhalten |
|---|--------|-----------|-----------|
| 1 | Worker steht | Jobs bleiben `pending` | STOPP vor §6/§7; Worker prüfen/starten lassen |
| 2 | Publish-Sync-Fehler | HTTP-Fehler im UI, Debug-Log `ok=false` | Klon ist dann `active` OHNE Map (status wird vor dem Sync gesetzt). Erneutes Veröffentlichen heilt das (idempotent). VORHER im Channex-Dashboard prüfen, ob die Property dort trotzdem entstanden ist (Map-Upsert-Fehler nach erfolgreichem Create) — dann NICHT blind retryen, sonst Duplikat; Zustand analysieren |
| 3 | Draft vorzeitig gesynct (Logo-Upload/UI-Edit, §5.1) | Map-0-Prüfung vor Publish | STOPP, Zustand analysieren |
| 4 | Enddatum falsch interpretiert | `request_body`-Range im Debug-Log (§7) | Aktion rückgängig, korrigiert wiederholen, falsche Task-ID verwerfen |
| 5 | Task-ID-Verwechslung (§6-Vorbereitung, Retries, Wiederholungen) | Zeitstempel/Range-Abgleich, SQL in §8 | Nur zweifelsfrei zugeordnete IDs einreichen |
| 6 | Channex-Budget/Ratelimit erschöpft | Job-Fehler `ChannexBudgetExhausted`/429 | Outbox/Retry arbeitet nach; warten, NICHT manuell doppelt auslösen (Wurzel 2) |
| 7 | Alt-Drafts „Doppelzimmer" stören die Auswahl | Titel im Kalender-/Objekt-Picker | Ausschließlich <TWIN_ID>/<DOUBLE_ID> verwenden |
| 8 | Billing-Quantity steigt um +2 | 2 neue `active`-Zimmer; nächster Quantity-Sync ([properties/service.py:230-240](../apps/api/src/features/properties/service.py)) | Bewusst akzeptieren (Staging); nach Zertifizierung Rückstellung auf Entwurf senkt die Zahl wieder |
| 9 | Werte-Adaption wird vom Reviewer abgelehnt | Rückfrage von Channex | Vorab-Klärung (§2/§10) minimiert das; sonst Screenshare-Demonstration (§11) |

## 13. Nacharbeiten (nach abgeschlossener Zertifizierung)

- Twin-Sperre 10.–16.11.2026 aufheben (pusht availability=1 nur für real offene Tage —
  Gegenzustand, Wurzel 1).
- Klone optional zurück auf Entwurf (senkt Billing-Quantity). **Kein** Löschen und keine
  Status-Änderung, solange die Zertifizierung (inkl. Stage 4/5) nicht abgeschlossen ist —
  Channex-Reviewer prüfen die Task-IDs gegen die Properties.

## 14. Ausdrücklich NICHT Teil dieses Plans

- Keine Code-Änderungen, keine Schema-Migrationen (reine Daten-INSERTs).
- Keine Commits/Pushes/Deploys.
- Kein Anfassen des Quell-Zimmers oder der Alt-Drafts.
- Kein UI-Edit an den Klonen zwischen Klon und Publish (§5.1).
