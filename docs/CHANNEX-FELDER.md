# Channex — vollständige Feld-Referenz (live per API verifiziert)

Quelle: direkte Abfrage der Channex-Staging-API (`https://staging.channex.io/api/v1`,
`user-api-key`), 422-Validierungs-Probes + `channels/list`. **Kein Raten.**
Stand: 2026-06-21. Diese Felder muss der Kunde im Onboarding eingeben, damit wir
sie an Channex übermitteln.

## 1. Property (`POST /properties`)

| Feld | Typ | Pflicht | Onboarding |
|------|-----|---------|-----------|
| `title` | string | **JA** | Objektname |
| `currency` | string ISO-4217 | **JA** | aus Land ableitbar |
| `country` | string ISO-3166 | praktisch nötig (OTA) | aus Firmensitz |
| `address` | string | praktisch nötig | ja |
| `city` | string | praktisch nötig | ja |
| `zip_code` | string | praktisch nötig | ja |
| `email` | string | praktisch nötig | ja |
| `phone` | string | praktisch nötig | ja |
| `property_type` | string | optional | Dropdown (Hotel/Apartment/…) |
| `website` | string | optional | ja |
| `latitude` / `longitude` | number | optional | Geocoding |
| `timezone` | string | optional | aus Land |
| `content.description` | string | optional | Beschreibung |
| `content.photos[]` | array | optional | Fotos |
| `content.important_information` | string | optional | Wichtige Infos |
| `settings.min_price` / `max_price` | number | optional | Preisgrenzen |
| `settings.state_length` | int (100–730) | optional, default 500 | Inventartage |
| `settings.min_stay_type` | "arrival"\|"through"\|"both" | optional | Mindestaufenthalt |

## 2. Room-Type (`POST /room_types`)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `property_id` | uuid | **JA** |
| `title` | string | **JA** |
| `occ_adults` | int | **JA** |
| `occ_children` | int | **JA** |
| `occ_infants` | int | **JA** |
| `count_of_rooms` | int | **JA** |
| `default_occupancy` | int | optional |
| `room_kind` | string ("room") | optional |
| `content.description` / `photos[]` | — | optional |

## 3. Rate-Plan (`POST /rate_plans`)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `property_id` | uuid | **JA** |
| `room_type_id` | uuid | **JA** |
| `title` | string | **JA** |
| `options[]` (mind. 1 mit `occupancy`) | array | **JA** |
| `currency` | string | optional |
| `options[].rate` | decimal | Preis je Nacht |
| `options[].is_primary` | bool | optional |
| `meal_type` | string ("none") | optional |
| `sell_mode` | "per_room"\|"per_person" | optional |
| `min_stay_arrival[7]` / `min_stay_through[7]` | int[] | optional |
| `closed_to_arrival[7]` / `closed_to_departure[7]` | bool[] | optional |
| `stop_sell[7]` / `max_stay[7]` | — | optional |
| `children_fee` / `infant_fee` | decimal | optional |
| `cancellation_policy_id` | uuid | optional |
| `tax_set_id` | uuid | optional |

## 4. Channel anlegen (`POST /channels`)

| Feld | Typ | Pflicht |
|------|-----|---------|
| `channel` | string (Code) | **JA** |
| `group_id` | uuid (Property muss in Group sein) | **JA** |
| `property_id` | uuid | **JA** |
| `settings` | object (channel-spezifisch, s. u.) | beim Connect |
| `title` | string | optional |

### Connect-Settings je Channel
- **BookingCom** (`room_rate_multioccupancy`, single): `hotel_id` **JA**; `send_email_notifications`/`email` optional.
- **Expedia** (`room_rate_multioccupancy`, single): `hotel_id` **JA**; `min_stay_type`, `booking_amount_settings` optional.
- **OpenChannel / Sandbox** (`room_rate_multioccupancy`, single): `endpoint`+`api_key`+`hotel_code` **JA**.
- **AirBNB** (Code „AirBNB", `listing`-Mapping, multiple): OAuth-Token `code`; Mapping per `listing_id` + `airbnb_rate_plan_id`.

### rate_params (pro Mapping-Zeile, Booking/Expedia/OpenChannel)
`rate_plan_code` (string), `room_type_code` (string), `occupancy` (int),
`pricing_type` (Booking/OpenChannel: select [Standard,OBP]; Expedia: freitext),
`primary_occ` (bool), `readonly` (bool; nicht bei Expedia).

## 5. Optional/erweitert (Tabs Richtlinien/Steuer)
- **Stornierungsrichtlinie** (`cancellation_policies`) → `cancellation_policy_id` an Rate-Plan.
- **Steuer-Set** (`tax_sets`) + **Steuern** (`taxes`: title, is_inclusive, logic, type, currency, rate) → `tax_set_id`.
- **Hotelrichtlinie** (`hotel_policies`) → `hotel_policy_id` an Property.

## Channel-Codes (exakt)
`BookingCom`, `AirBNB`, `Expedia`, `OpenChannel`, `VRBO`, `Agoda`, … (116 gesamt via `channels/list`).

## Live-Gap-Analyse (Stand 2026-06-21, Property c6c96f52-…)

Direkt von der Channex-API geprüft — diese Daten muss der Kunde im Objekte-Bereich
liefern, sonst kein Verkauf/Connect:

**KRITISCH (blockiert Verkauf/OTA-Connect):**
- Rate-Plan-Preis = 0.00 → echter Preis nötig
- Tagespreise (Kalender) = alle 0.00 → Verkaufspreise setzen
- Verfügbarkeit/Inventar = alle 0 → Inventar > 0 setzen
- keine Stornorichtlinie (`default_cancellation_policy_id` null) → Booking/Expedia verlangen sie

**WICHTIG (OTA verlangt es praktisch):**
- `property_type`, `timezone`, `latitude`/`longitude`, `state` (Bundesland)
- Property-`description`, Room-Type-`description`
- Fotos (Property + Room-Type) = 0
- Facilities/Ausstattung (Property + Room-Type) = leer
- Hausregeln (`hotel_policy_id` null)

**Datenqualität:** vorhandene Werte sind Testdaten (Adresse „Test 2", Stadt „Test ",
Telefon „1234567890") → müssen echt sein (Geo-Validierung der OTAs).

**Trennung:** Firmendaten (tenant_billing_profile) = Onboarding, korrekt befüllt.
Unterkunfts-/Preis-/Verfügbarkeits-/Policy-Daten = Objekte-Bereich (offen).

## Property-Spiegel Channex → lokale DB (Reconcile)

Channex ist die **Quelle der Wahrheit**; die lokale DB spiegelt Properties
automatisch **1:1** (Existenz **und** Inhalte). Channex liefert **keine**
Property-Webhooks (nur `ari;booking_new;booking_modification;booking_cancellation`),
daher Spiegelung per **Polling**:

- **Trigger 1 — Seitenaufruf:** `list_property_maps()` ruft vor dem Lesen
  `reconcile_properties_for_tenant(tenant_id)` (non-blocking; Channex-Ausfall
  bricht die Seite nie).
- **Trigger 2 — Cron:** `POST /channel-manager/internal/reconcile`
  (secret-geschützt via `X-Internal-Cron-Secret` = `CHANNEX_WEBHOOK_SECRET`,
  `include_in_schema=False`) → `reconcile_all_tenants()`. Server-Cron alle 15 Min:
  `/usr/local/bin/nextdays-reconcile.sh` (root-crontab) ruft den Endpunkt per
  `docker exec` im `api-*`-Container auf; Log `/var/log/nextdays-reconcile.log`.

**Abgleich-Logik** (`service.py` `reconcile_properties_for_tenant`):
- Properties pro Tenant über `GET /properties?filter[group_id]=<channex_group_id>`
  (white-label-sicher; group aus `channex_group_map`).
- Channex-Property ohne aktive Map → lokales `properties` anlegen + Map (bzw.
  soft-gelöschte Map mit lebender Property reaktivieren).
- Bestehende gemappte Property → Titel/Adresse/Koordinaten/Description aus Channex
  überschreiben. **Lokale-nur-Felder** (Fotos, Ausstattung, Preise, `max_guests`,
  `status`, `currency`, Rate-Plans) bleiben unberührt.
- Channex-Property weg → Map soft-löschen (`deleted_at`, `sync_enabled=false`).
- **Kein Fallback:** fehlt der Pflicht-`title` bei Channex → Property überspringen
  (`reconcile_skip_no_title`), nichts erfinden.
- **Channex-Ausfall** (`_live_channex_properties_for_group` → `None`) → keine
  Änderung (kein Insert/Update/Delete; kein Datenverlust).
- `property_type` wird NICHT aus Channex übernommen (Channex-Werte ≠ lokales Enum).

Mapping Channex-attributes → `properties` (invers zu `_property_attrs`):
`title→title`, `address→address`, `city→city`, `zip_code→postal_code`,
`country→country`, `latitude→lat`, `longitude→lng`, `content.description→description`.

## Vollimport beim Portal-Verbinden (Buchungen, ARI, Rooms/Rates)

Beim `connect_channel` (nach activate) läuft ein **best-effort Initial-Import**
(Channel bleibt live, Import nachholbar); laufend über Feed/Webhook + Cron:

- **Buchungen** (`import_bookings_for_property`): `GET /bookings?filter[property_id]`
  paginiert (nur Connect/Recovery, NICHT periodisch — Channex-Doku). Jede Buchung →
  Staging (`channex_booking`) + Projektion in die zentrale **`reservations`** +
  Kalender-Block (`availability` `booked`). Storno → reservation cancelled +
  Nächte dieser OTA-Quelle wieder `open`. Laufend zusätzlich in `sync_bookings`
  (Feed) nach `_upsert_booking`. Idempotent über `reservations.source_channex_booking_id`.
  OTA-Name→Kanal: Booking.com→booking, Airbnb→airbnb, VRBO→vrbo, sonst `portal`
  (echter Name bleibt in `reservations.ota_name` für Kalender/Posteingang).
- **ARI** (`import_ari_for_property`, 90-Tage-Chunks): `GET /availability` →
  `availability` (0/stop_sell→blocked, >0→open; **`booked` wird nie überschrieben**);
  `GET /restrictions?filter[restrictions]=rate,min_stay_arrival,stop_sell` →
  `price_overrides` (rate) + `stop_sell`-Tabelle. Läuft auch im
  `/internal/reconcile`-Cron pro aktiver Property.
- **Rooms/Rates** (`import_rooms_rates_for_property`): `GET /room_types` +
  `GET /rate_plans` → `channex_room_type_map`/`channex_rate_plan_map`; legt lokale
  `rate_plans` an, wo keiner gemappt (Basispreis = Primär-Occupancy; per_person nur
  Primär-Rate, Rest geloggt).

**Frontend:** Kalender zeigt Buchungsherkunft (OTA-Icon/Label statt nur „Gebucht");
Stop-Sell-Seite (`/stop-sell`, Sidebar) verwaltet manuelle Verkaufsstopps
(Channex-Stops read-only); Posteingang (`/posteingang`) listet OTA-Buchungen als
Threads. Backend: stop_sell-Endpunkte im `calendar`-Slice, Threads im `inbox`-Slice.

**Migrationen:** 0031 (reservations `source_channex_booking_id`/`external_ref`/
`ota_name`), 0032 (`stop_sell`-Tabelle).
