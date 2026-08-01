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
- **AirBNB** (Code „AirBNB", `listing`-Mapping, multiple): **OAuth-Kanal — kein
  eingebbares Credential.** Verbindung NICHT per `test_connection`/`create` mit
  Settings, sondern über den white-label IFrame (s. nächster Abschnitt).

## 4a. Airbnb-OAuth (white-label, OHNE IFrame) — verifiziert 2026-06-26

**Ziel:** echte Airbnb-OAuth-URL in der EIGENEN UI relayen (öffnen ODER kopieren &
an Eigentümer senden) — **kein** Channex-IFrame.

**Befund (live gegen Staging + Channex-SPA-Bundle gelesen, kein Raten):**
- Airbnb-Katalog: `code="AirBNB"`, `shortCode="ABB"`. Einziges credential-artiges
  Feld `code` (Typ **`hidden`**) → nichts Einzugebendes → connection_type
  **`oauth`**. Kein `hotel_id`.
- Das Channel-Objekt selbst trägt **keine** OAuth-URL; alle geratenen
  `/channels/:id/oauth*`-Pfade → 404. Die URL kommt aus einem **separaten
  meta-Endpunkt**, den die SPA nutzt (`createAirbnbConnectionLink` im Bundle).

**Verifizierter Flow (alle Schritte live 200/201 gegen Staging):**
1. **One-Time-Token:** `POST /api/v1/auth/one_time_token`
   Body `{property_id, group_id, username}` → `200` `{data:{token:"<uuid>"}}`.
   TTL 15 Min, einmalig nutzbar.
2. **JWT-Exchange:** `GET /api/v1/auth/exchange?oauth_session_key={token}&app_mode=headless`
   → `200` `{data:{attributes:{token:"<JWT>"}}}`. (NUR GET; POST/`exchange_token`
   etc. → 404. `/auth/exchange` ohne `Accept: application/json` liefert die SPA-
   HTML — Header zwingend.) Der JWT autorisiert die folgenden meta-Calls.
3. **Airbnb-Channel inaktiv anlegen:** `POST /channels` (JWT ODER api-key)
   `{channel:{channel:"AirBNB", title, group_id, properties:[pid], is_active:false}}`
   → `201`, `data.id` = `channel_id`. (Kein `rate_plans`, kein `settings.hotel_id`.)
4. **OAuth-URL holen:** `POST /api/v1/meta/airbnb/connection_link` **(JWT-Header)**
   Body **snake_case**, gewrappt:
   ```
   {"connection_link": {
     "group_id": "<uuid>",
     "properties": ["<channex_property_uuid>"],
     "channel_id": "<channel_id aus Schritt 3, optional>",
     "title": "<Kanal-Titel>",
     "request_id": "<eigene uuid zur Realtime-Korrelation>",
     "settings": {
       "booking_amount_settings": "Payout Amount",   // oder "Total Paid Amount"
       "cohost_payout_calculations": false,
       "min_stay_type": "Arrival",                    // oder "Through"
       "send_email_notifications": false,
       "email": "<optional>"
     }
   }}
   ```
   → `200` `{data:{attributes:{url:"https://www.airbnb.com/oauth2/auth?scope=property_management,messages_read,messages_write&state=…&client_id=…&redirect_uri=https://staging.channex.io/api/v1/meta/airbnb/auth_redirect"}}}`.
   **`data.attributes.url` = die echte Airbnb-OAuth-URL** → in der eigenen UI
   öffnen (`window.open`) ODER „Link kopieren" an den Eigentümer.
   ⚠️ Ohne JWT (nur api-key) → `422 group_id can't be blank` (Endpunkt braucht den
   Session-JWT-Kontext). camelCase-Body (`groupId`) → ebenfalls 422.
5. **Callback:** Airbnb leitet nach Autorisierung auf Channex'
   `…/meta/airbnb/auth_redirect` (im URL enthalten) — Channex verarbeitet den
   Token serverseitig; **kein Redirect zu uns nötig**.
6. **Status / Host-ID lesen** (Polling, da Channex keine Channel-Webhooks liefert):
   `get_channel(channel_id)` → `data.attributes.settings`:
   - **verbunden** ⇔ `settings.tokens` ist gesetzt (nicht null/undefined);
   - **Host-ID** = `settings.tokens.user_id`;
   - **Token ungültig** ⇔ `settings.token_invalid === true` (Re-Auth nötig);
   - `settings.scope` = gewährte Airbnb-Scopes.
   (Feldnamen aus dem SPA-Component `j7t`: `l?.tokens?.user_id`, `token_invalid`.)
7. **Re-Auth invalidieren** (optional, Admin): SPA ruft
   `Channels.airbnbInvalidateAuth(channel_id)` — Pfad bei Bedarf analog aus dem
   Bundle ziehen; für den Erst-Connect nicht nötig.
8. **Mapping + Aktivieren:** sobald verbunden, läuft alles über den **bestehenden**
   `/channels`-Pfad: `get_channel_mapping_details` (liefert dann die Airbnb-
   Listings) → `update_channel` mit `rate_plans` → `activate_channel`. **`is_active`
   in unserer DB erst NACH activate true setzen.**

**Architektur (IFrame-frei):** Backend macht 1→4 (Token→JWT→Channel→URL) und gibt
die `url` ans Frontend; Frontend zeigt „Jetzt verbinden" (öffnet url) + „Link
kopieren". Status per Poll auf `get_channel` (Schritt 6) → Realtime über die
`channex_channel_connection`-Tabelle (wir schreiben host_id/connected rein).

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
  (secret-geschützt via `X-Internal-Cron-Secret` = `INTERNAL_CRON_SECRET`,
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

---

# Vollständige Endpunkt- und Feld-Inventur (Stand 2026-07-31)

Jeder unten genannte Endpunkt wurde live gegen `staging.channex.io/api/v1`
aufgerufen; die Feldnamen stammen aus den echten Antworten, nichts abgeschrieben.

**Geltungsbereich:** Die Inventur zeigt, was unser Staging-Konto sieht
(`acc_channels_count: 0` — kein aktiv verbundener OTA-Kanal). Felder hinter einer
Freischaltung (Whitelabel, Channel-API, aktiver Kanal) würden hier nicht
erscheinen. Die Liste belegt also, was es GIBT — nicht, was es nicht gibt.

## Endpunkte mit Antwort (17)

| Endpunkt | Inhalt |
|---|---|
| `/properties` | Objekt (Betrieb/Unterkunft) |
| `/room_types` | Zimmertyp = buchbare Einheit |
| `/rate_plans` | Ratenpläne |
| `/groups` | Kontogruppen (`group_id` beim Kanal-Anlegen) |
| `/channels` | verbundene OTA-Kanäle |
| `/webhooks` | Rückruf-Registrierungen |
| `/property_facilities` | Ausstattungskatalog Objekt (301 Einträge) |
| `/room_facilities` | Ausstattungskatalog Zimmer (191 Einträge) |
| `/currencies` | Währungsliste |
| `/photos` | Bilder |
| `/cancellation_policies` | Stornoregeln |
| `/tax_sets` | Steuersätze (Gruppen) |
| `/taxes` | Steuersätze (einzeln) |
| `/hotel_policies` | Hausregeln |
| `/bookings` | Buchungen |
| `/booking_revisions/feed` | Eingang neuer/geänderter Buchungen |
| `/applications` | Zusatz-Apps des Kontos |

## Endpunkte ohne Antwort — 404 (19)

`/facilities`, `/bed_types`, `/property_types`, `/property_attributes`,
`/room_type_attributes`, `/rate_plan_attributes`, `/attributes`, `/room_kinds`,
`/languages`, `/countries`, `/listings`, `/airbnb_listings`, `/content`,
`/room_type_content`, `/property_content`, `/descriptions`, `/amenities`,
`/meal_types`, `/users`

## Feldnamen je Endpunkt

### `/properties` — 32 Felder

```
acc_channels_count, address, city, content, country, currency,
default_cancellation_policy_id, default_tax_set_id, email,
expected_removal_date, hotel_policy_id, id, is_active, latitude,
location_precision, logo_url, longitude, max_count_of_occupancies,
max_count_of_rate_plans, max_count_of_room_types, max_count_of_users,
min_stay_type, phone, property_category, property_type, settings, state,
timezone, title, website, zip_code
```

Verschachtelt:
- `content` → `description`, `photos[]`, `important_information`
- `settings` → `min_stay_type`, `allow_availability_autoupdate`,
  `allow_availability_autoupdate_on_cancellation`,
  `allow_availability_autoupdate_on_confirmation`,
  `allow_availability_autoupdate_on_modification`, `cut_off_days`,
  `cut_off_time`, `max_day_advance`, `max_price`, `min_price`, `state_length`
- `relationships` → `users`, `groups`

### `/room_types` — 13 Felder

```
capacity, codes, content, count_of_rooms, default_occupancy, id, meta,
occ_adults, occ_children, occ_infants, position, room_kind, title
```

Verschachtelt:
- `content` → `description`, `photos[]`
- `relationships` → `property`, `facilities`

Belegungsbezogene Felder (Bedeutung laut Channex-Doku):

| Feld | Bedeutung |
|---|---|
| `occ_adults` | Anzahl der Betten für Erwachsene |
| `occ_children` | Anzahl der Kinderbetten |
| `occ_infants` | Anzahl der verfügbaren Babybetten |
| `default_occupancy` | Standardbelegung, muss ≤ `occ_adults` sein |
| `capacity` | Anzahl Betten im physischen Zimmer (nur `room_kind: dorm`) |
| `count_of_rooms` | Anzahl gleichartiger Zimmer dieses Typs |

### `/rate_plans` — 29 Felder

```
auto_rate_settings, cancellation_policy_id, children_fee, closed_to_arrival,
closed_to_departure, currency, id, infant_fee, inherit_availability_offset,
inherit_closed_to_arrival, inherit_closed_to_departure,
inherit_max_availability, inherit_max_stay, inherit_min_stay_arrival,
inherit_min_stay_through, inherit_rate, inherit_stop_sell, max_stay, meal_type,
meta, min_stay_arrival, min_stay_through, options, rate_mode, sell_mode,
stop_sell, tax_set_id, title, ui_read_only
```

### `/channels` — 12 Felder

```
actions, channel, currency, expected_removal_date, id, inserted_at, is_active,
properties, rate_plans, settings, title, updated_at
```

### `/webhooks` — 9 Felder

```
callback_url, event_mask, headers, id, is_active, is_global, protected,
request_params, send_data
```

### `/property_facilities` und `/room_facilities` — je 3 Felder

```
category, id, title
```

Kategorien Zimmer: `bathroom`, `general`, `in_room`, `kitchen`, `outside`,
`security`, `view`
Kategorien Objekt: `activites`, `food_and_drink`, `general`, `outdoors`,
`parking`, `pets`, `safety_and_security`, `services`, `sustainable_practice`

Der Katalog kennt keine Mengenangabe — jeder Eintrag ist ein Ja/Nein-Merkmal.
Betten kommen darin nur als Merkmal vor, nicht als Anzahl oder Typ: `Sofa bed`,
`Rollaway bed`, `Children crib/cots`, `Extra long beds`, `Socket near the bed`.

### `/photos` — 8 Felder

```
author, description, id, kind, position, property_id, room_type_id, url
```

### `/applications` — 9 Felder

```
code, description, id, is_configurable, logo_url, price,
representation_settings, title, vr_price
```

### `/groups` — 2 Felder · `/currencies` — 2 Felder

```
id, title                    code, label
```

## Schreibbarkeit einzelner Felder (live geprüft 2026-08-01)

Ein `200` von Channex heißt NICHT, dass der Wert gespeichert wurde — mehrere
Felder quittieren freundlich und verwerfen still. Jede Zeile hier wurde per
PUT/POST gesetzt und danach zurückgelesen.

| Feld | Ebene | schreibbar? | Befund |
|---|---|---|---|
| `facilities` | room_type | **ja** | Relationship; ein PUT mit einer UUID entfernt die übrigen (Wurzel-1-konform) |
| `facilities` | property | **ja** | seit jeher genutzt |
| `property_category` | property | **nein** | `hotel`, `vacation_rental`, `hostel`, `apartment`, `villa` je HTTP 200 → Wert blieb unverändert. Channex leitet ihn selbst aus `property_type` ab. Nicht senden. |
| `room_size`, `size`, `square_meters` | room_type | nein | 200, nicht gespeichert |
| `beds`, `bed_configuration`, `bedrooms`, `bathrooms` | room_type | nein | 201/200, verworfen |

Konsequenz für uns: die Zimmergröße und die Bettenaufstellung sind lokale
Felder (eigene Strecke + myBestDays), `property_category` senden wir nicht.

## Zimmergröße und Bettentypen

Kein Endpunkt und kein Feld dieser Inventur trägt eine **Zimmergröße in m²** oder
eine **Bettentyp-Liste mit Stückzahl** (z. B. 1 Doppelbett + 2 Einzelbetten).
Bettenzahlen erscheinen ausschließlich als Belegungszahlen (`occ_adults`,
`occ_children`, `occ_infants`, `capacity`).

Das gilt für unser Staging-Konto zum genannten Datum. Der `facilities`-Bezug am
Zimmertyp ist bei uns leer und `acc_channels_count` steht auf 0 — ob Channex
weitere Content-Felder freischaltet, sobald ein OTA-Kanal aktiv verbunden ist,
lässt sich von hier aus nicht feststellen.

## Reproduzieren

```bash
curl -s -H "user-api-key: $CHANNEX_API_KEY" \
  "$CHANNEX_BASE_URL/room_types" | jq '.data[0].attributes | keys'
```

## ARI wird NICHT zurückgelesen (Auflage des Aggregators, 01.08.2026)

Der Betreiber hat uns schriftlich untersagt, die ARI zyklisch zurückzulesen:
wir sind die Quelle der Wahrheit, es dürfen nur ÄNDERUNGEN gepusht werden.
Umgesetzt seit `0251_channex_ari_shadow.sql`:

- `channex_ari_shadow` hält den zuletzt ERFOLGREICH gepushten Preis/Min-Stay je
  lokalem Rate-Plan und Tag. `reconcile_rate_plan_prices` diffed das Soll
  (Pricing-Resolver) gegen diesen Schatten — **kein `get_restrictions` mehr**.
  Fortgeschrieben wird der Schatten erst NACH dem erfolgreichen Push, ein
  gescheiterter Push bleibt damit Differenz und wird wiederholt.
- `import_ari_for_property` läuft nur noch beim Verbinden/Re-Aktivieren eines
  Objekts, nicht mehr periodisch.
- Reconcile-Tick: täglich statt alle 15 min; kein Enqueue mehr am Seitenaufruf.
- Eigener 5-Minuten-Tick nur für die ausgehenden Outboxen (Retry) und den
  nächtlichen Full-Sync-Push.
- Einmaliger Umstellungsschritt: `POST /api/v1/channel-manager/internal/seed-ari-shadow`
  füllt den Schatten aus dem Soll, ohne zu senden (am 01.08.2026 gelaufen:
  27 Objekte, 9 Rate-Plans, 3886 Werte). Ein anschließender voller Reconcile
  über alle 4 Tenants erzeugte 0 Lesezugriffe und 0 Pushes.

Prüffrage vor jeder Änderung am Channel-Manager: *Löst das einen Lesezugriff auf
ARI/Verfügbarkeit/Preise aus?* Wenn ja: nicht bauen.
