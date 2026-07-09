# API-Übersicht

Base-URL (lokal): `http://localhost:8000`
Alle Slice-Endpoints liegen unter dem Prefix **`/api/v1`**.

Interaktive Doku (Swagger UI): **http://localhost:8000/docs**

## Meta-Endpoints

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/` | Service-Info |
| `GET` | `/health` | App-Health |

## Slices

Jeder der 24 Vertical Slices stellt mindestens einen Health-Endpoint bereit:

| Slice | Health-Endpoint |
|---|---|
| auth | `GET /api/v1/auth/health` |
| buchhaltung | `GET /api/v1/buchhaltung/health` |
| properties | `GET /api/v1/properties/health` |
| rates | `GET /api/v1/rates/health` |
| pricing | `GET /api/v1/pricing/health` |
| calendar | `GET /api/v1/calendar/health` |
| reservations | `GET /api/v1/reservations/health` |
| guests | `GET /api/v1/guests/health` |
| travel_agencies | `GET /api/v1/travel-agencies/health` |
| inbox | `GET /api/v1/inbox/health` |
| whatsapp | `GET /api/v1/whatsapp/health` (Meta Cloud API, s.u.) |
| payments | `GET /api/v1/payments/health` (Stripe Connect + Zahlungen, s.u.) |
| channel_manager | `GET /api/v1/channel-manager/health` (Channex-Integration, s.u.) |
| booking_engine | `GET /api/v1/booking-engine/health` |
| site_config | `GET /api/v1/site-config/health` (Page-Builder, s.u.) |
| addons | `GET /api/v1/addons/health` |
| owners | `GET /api/v1/owners/health` (Eigentümer-Stammdaten + Objekt-Zuweisung, s.u.) |
| owner_statements | `GET /api/v1/owner-statements/health` (Auszahlungs-Abrechnung, s.u.) |
| ocr | `GET /api/v1/ocr/health` |
| public_portal | `GET /api/v1/public-portal/health` |
| tasks | `GET /api/v1/tasks/health` |
| crm | `GET /api/v1/crm/health` |
| dashboard | `GET /api/v1/dashboard/health` |
| content | `GET /api/v1/content/health` |

Antwort-Schema:

```json
{ "slice": "auth", "status": "ok" }
```

---

## auth (voll implementiert)

Referenz-Slice. Tenant-Anlage + Supabase-Auth, `tenant_id`/`role` im JWT `app_metadata`.

### `POST /api/v1/auth/register` → `201`

Legt **atomar** Tenant + Owner-User an. Bei Fehler in einem Schritt werden
bereits angelegte Artefakte zurückgerollt (kein verwaister Tenant).

```json
// Request
{
  "email": "owner@example.de",
  "password": "mindestens8zeichen",
  "full_name": "Vorname Nachname",
  "tenant_name": "Meine Vermietung",
  "country": "DE",
  "currency": "EUR"
}
```

```json
// Response 201
{
  "access_token": "eyJ...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

| Status | Bedeutung |
|---|---|
| `201` | erstellt + direkt eingeloggt |
| `409` | E-Mail bereits vergeben |
| `500` | Tenant/User-Anlage fehlgeschlagen (mit Rollback) |

### `POST /api/v1/auth/login`

```json
// Request
{ "email": "owner@example.de", "password": "mindestens8zeichen" }
```

Antwort: `SessionResponse` (wie bei register). `401` bei falschen Daten.

### `GET /api/v1/auth/me`

Erfordert `Authorization: Bearer <access_token>`.

```json
// Response 200
{
  "user_id": "uuid",
  "email": "owner@example.de",
  "tenant_id": "uuid",
  "role": "owner",
  "capabilities": ["…"],
  "permissions": ["edit_property", "…"],  // Lodgify-Berechtigungen (UI-Gating)
  "accommodation_type": "vacation_rental" // Betriebsart (0090): vacation_rental | hotel
}
```

`role`/`permissions` werden aus der DB gelesen (Quelle der Wahrheit, JWT kann
veraltet sein). `401` ohne/mit ungültigem Token.

### `PATCH /api/v1/auth/tenant/accommodation-type`

Stellt die Betriebsart des EIGENEN Mandanten um (steuert die Dashboard-
Navigation: „Objekte" vs. „Zimmer", Eigentümer-Modul nur Ferienvermietung).
Erfordert `MANAGE_TENANT` (Admin). Body:
`{ "accommodation_type": "vacation_rental" | "hotel" }` → Antwort: `MeResponse`.

### `POST /api/v1/auth/invite` → `201`

Legt weiteren Nutzer im eigenen Tenant an (Konto → Benutzer-Wizard). Erfordert
`MANAGE_STAFF` (admin/co_admin). Rolle aus dem Request
(`co_admin|owner|staff|cleaner`; `admin` entsteht nur per register). Tenant aus
dem eingeloggten Nutzer. `permissions` ist optional — fehlt es, werden die
Rollen-Defaults gesetzt; ungültige IDs werden gefiltert, Admin erhält immer alle.

```json
// Request
{ "email": "staff@example.de", "password": "min8zeichen",
  "full_name": "Mitarbeiter", "role": "staff",
  "permissions": ["edit_property", "pm_chat"] }
// Response 201
{ "user_id": "uuid", "email": "staff@example.de", "role": "staff",
  "tenant_id": "uuid", "permissions": ["edit_property", "pm_chat"] }
```

**Berechtigungsmodell (Lodgify):** Zwei Ebenen — die rollenbasierte
**Capability-Matrix** (intern, `permissions.py`, schützt Slice-Endpoints) und die
feingranularen **Lodgify-Berechtigungen** (43 IDs, `lodgify_permissions.py`,
pro Nutzer in `users.permissions` JSONB). Letztere werden im Wizard zugewiesen,
per `require_lodgify_permission(...)` an Endpoints durchgesetzt
(z. B. `PATCH /properties/{id}` → `edit_property`,
`POST /properties/{id}/image` → `pm_manage_property_images`,
`POST /calendar/block|price-override` → `edit_calendar_bookings`) und im
Frontend zum Aus-/Einblenden von Menüpunkten genutzt. Admin = immer alle.

### Konto & 2FA (Sicherheit-Seite)

Alle Endpunkte erfordern eine gültige Session (Bearer-Token). Quelle der Wahrheit
ist FastAPI; reine OAuth-Konten (Google) werden beim ersten Zugriff lazy
provisioniert (Tenant + `users`-Row).

| Methode & Pfad | Zweck |
| --- | --- |
| `GET /api/v1/auth/account` | Konto-/Profil-Übersicht (E-Mail, Name, Rolle, Telefon, Sprachen, Website, Beschreibung, Avatar, `has_password`, `totp_enabled`) |
| `GET /api/v1/auth/account/users` | Nutzer des eigenen Tenants (für die Objekt-Kontakt-Auswahl) — `user_id`, Name, E-Mail, Rolle, Telefon, Avatar, `tenant_id`, `permissions` |
| `GET /api/v1/auth/account/managed-users` | Nutzerverwaltung (Konto → Benutzer): **Admin** sieht alle Nutzer plattformweit, Owner/Co-Admin nur den eigenen Tenant; normale Benutzer (staff/cleaner) → `403` |
| `PATCH /api/v1/auth/account/email` | E-Mail ändern (`{ "new_email": "…" }`) |
| `PATCH /api/v1/auth/account/name` | Anzeigename ändern (`{ "full_name": "…" }`) |
| `PATCH /api/v1/auth/account/profile` | Profil-/Kontaktdaten ändern (Lodgify „Edit contact information"): `full_name`, `phone`, `additional_phone`, `hide_phones`, `preferred_language`, `spoken_languages`, `website`, `description`, `avatar_url` — nur gesendete Felder werden geschrieben |
| `POST /api/v1/auth/account/avatar` | Profilbild hochladen (`multipart/form-data`, Feld `file`) → legt in den `avatars`-Bucket (`{user_id}/avatar.<ext>`) und setzt `avatar_url`. Läuft über den Service-Client, daher für beide Login-Wege nutzbar |
| `PATCH /api/v1/auth/account/password` | Passwort ändern (`{ "current_password"?, "new_password" }`) |
| `POST /api/v1/auth/totp/enroll` | TOTP-Enrollment starten → `secret`, `otpauth_uri`, `qr_data_url` |
| `POST /api/v1/auth/totp/verify` | Enrollment per Code bestätigen → `recovery_codes` |
| `POST /api/v1/auth/totp/disable` | 2FA mit gültigem Code (oder Recovery) abschalten |

Die **Profilfelder** (Telefon, Sprachen, Website, Beschreibung, Avatar) liegen
als eigene Spalten in `public.users`. Der **Objekt-Hauptkontakt** (Lodgify
„Contact page") verweist über `type_attributes.contact.userId` des Objekts auf
einen dieser Nutzer. Profilbilder liegen im öffentlichen Storage-Bucket
`avatars` (Lesen öffentlich; Schreiben nur in den eigenen `{user_id}/`-Ordner
bzw. serverseitig über den Avatar-Endpunkt).

2FA läuft als **TOTP im eigenen Backend** (`pyotp`, Tabelle `public.user_mfa`) —
kein externer SMS-Dienst. SMS ist vorgesehen, aber erst mit einem Provider aktiv.

### Rollen-Guard

`require_role(...)` (in `features/auth/dependencies.py`) ist eine
Dependency-Factory, die Endpoints auf bestimmte Rollen beschränkt
(`owner`, `staff`, `cleaner`) und sonst `403` liefert.

```python
from src.features.auth.dependencies import require_role
from src.features.auth.schemas import UserRole

@router.get("/nur-owner", dependencies=[Depends(require_role(UserRole.owner))])
def nur_owner(): ...
```

---

## properties (CRUD implementiert)

Objekt-Verwaltung (Lodgify „Rentals"). Alle Endpunkte erfordern eine Session
(Bearer-Token); der Tenant kommt aus dem JWT, jeder Zugriff ist tenant-scoped.

| Methode & Pfad | Zweck |
| --- | --- |
| `GET /api/v1/properties` | Objekte des Tenants auflisten |
| `POST /api/v1/properties` | Objekt anlegen → `201` |
| `GET /api/v1/properties/{id}` | Einzelnes Objekt |
| `PATCH /api/v1/properties/{id}` | Felder ändern (partiell) |
| `DELETE /api/v1/properties/{id}` | Objekt löschen → `204` |

Felder: `title`, `description`, `property_type`
(`ferienhaus|appartement|glamping|tiny_house|stellplatz|hausboot`), `status`
(`draft|active|inactive`), `max_guests`, strukturierte Adresse
(`street|house_number|postal_code|city|country|lat|lng`), `amenities[]`,
`photos[]`. Sektionen ohne eigene Spalte (Räume, Schlafmöglichkeiten, m²,
Einheiten) liegen flexibel in `type_attributes` (jsonb) — neue Lodgify-Sektionen
brauchen so keine Migration.

**Richtlinien** (Lodgify „Policies") liegen ebenfalls in `type_attributes`
unter dem Key `policies`: strukturierte `policy` (Zahlungsplan, Stornoart,
Kaution, Angebots-Gültigkeit), `bookability` (`instant|request|inquiry`),
`checkInTime`, `checkOutTime`, mehrsprachige `ratesInfo`/`rentalAgreement`
(`{de,en,da}`).

**Preise** (Lodgify „Pricing") liegen in `type_attributes.pricing`:
`currency`, `basePrice`, `dynamicPricing`, `customByWeekday`/`weekdayPrices`,
`markup` (% je externem Kanal `airbnb`/`booking`/`google`), `extraGuestCharge`,
`shortStay*`, `lengthPrices[]` (Wochen-/Monats-/eigene Längenpreise) sowie
`fees[]`, `taxes[]` (USt./lokal), `promotions[]`, `addOns[]`, `businessTaxId`,
`totRegistrationId` und `basePriceLabel`.

**Verfügbarkeit** (Lodgify „Availability") liegt in `type_attributes.availability`:
`minStay`, `minStayByDays`, `maxStay`, sowie pro-Kanal-fähige Werte
(`preparationDays`, `bookingWindowDays`, `advanceNotice` je als
`{custom, global, channels:{direct,airbnb,booking,google}}`) und gesperrte
Wochentage (`unavailableCheckIn`/`unavailableCheckOut`).

**Compliance** (Lodgify „Compliance") liegt in `type_attributes.compliance`:
`registrationNumbers` (komma-getrennter String, max. 100 Zeichen) — eine oder
mehrere Registrierungsnummern für die eigene Website zur Erfüllung lokaler
Vorschriften. Für Airbnb/Booking.com werden die Nummern direkt in deren
Plattform gepflegt.

**Nachrichten-Platzhalter** (Lodgify „Messaging placeholders") liegen in
`type_attributes.messaging`: pro Block (`checkIn`, `checkOut`, `directions`,
`doorInstructions`, `rules`, `wifi`, `localGuide`, `emergency`) ein
mehrsprachiger `LocalizedText` (`{de,en,da}`). Jeder Block hat einen Shortcode
(`{{CheckinInstructions}}` …) für automatische Gästenachrichten.

**Standort-Zusätze** (Lodgify „Location") liegen in `type_attributes.location`
(die Basis-Adresse `street`/`house_number`/`postal_code`/`city`/`country`/`lat`/
`lng` bleibt in eigenen Spalten): `stateProvince`, `useCustomCity`+`customCity`,
`showPreciseLocation`, `distances` (`unit` `km|mi` + `values` je Verkehrsmittel
`airport`/`bus`/`underground`/`train`/`motorway`/`port`), `customMapUrl` (Bild
im `property-images`-Bucket) und mehrsprachige `directions` (`{de,en,da}`).
Objekt-Bilder werden über `POST /api/v1/properties/{id}/image` (multipart, Feld
`file`, optional `?slot=`) in den `property-images`-Bucket geladen
(`{tenant_id}/{property_id}/{slot}.<ext>`).

Alle Bereiche werden über `PATCH /api/v1/properties/{id}` mit
`type_attributes` gespeichert (kein eigener Endpunkt; flexibles jsonb).

---

## pricing (Kern-Logik implementiert — eine Preis-Wahrheit)

Zentraler Preis-Resolver (`pricing/resolver.py`): die EINZIGE Stelle, die Effektiv-
Tagespreise und Buchungs-Quotes berechnet. Kalender, Reservierungs-Wizard und
Buchungsstrecke lesen Preise ausschließlich hierüber. Leseendpoints `view_calendar`.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/pricing/effective?property_id&start&end` | Effektivpreis je Tag — Priorität manueller `price_overrides`(Tag) > `dynamic_prices` (Regel-Engine) > Wochentagspreis > `rate_plans.base_price`; sonst `null` (kein Fallback) |
| `POST` | `/api/v1/pricing/quote` | Vollständige Aufschlüsselung `{property_id, check_in, check_out, guests, channel}` → `lines[]` (Übernachtung, Markup, Gebühren, Rabatt, Steuern), `nightly_total`, `total`, `priceless` |
| `GET` | `/api/v1/pricing/overview` | Alle Objekte des Kontos mit DP-Status (eine Zeile je Objekt: `enabled`, `base_mode`, `base_rate_mode`, effektiver `base_rate`, `min_price`, `max_price`, `currency`) — die Dynamic-Pricing-Objekt-Tabelle. `manage_calendar` |
| `GET` | `/api/v1/pricing/settings/{property_id}` | Dynamic-Pricing-Einstellungen (dp_settings) eines Objekts (Defaults, falls leer). `manage_calendar` |
| `PUT` | `/api/v1/pricing/settings/{property_id}` | Dynamic-Pricing-Einstellungen setzen (Upsert); bei `enabled=true` sofortiger Recompute. `manage_calendar` + `edit_calendar_bookings` |
| `POST` | `/api/v1/pricing/recompute` | Interner Cron (Header `X-Internal-Cron-Secret`): berechnet die dynamischen Preise aller Objekte mit aktiviertem DP neu (Horizont 540 Tage) + Channex-Push |

**Dynamic Pricing (Phase 1, regelbasiert, Migration `0055`):** Eine Regel-Engine
(`pricing/engine.py`, reine Funktionen) berechnet täglich je (Objekt, Tag) einen
dynamischen Preis + Min-Stay aus multiplikativen Faktoren — **Saison**
(`season_periods`), **Event** (`event_periods`), **Wochenende**, **eigene Auslastung**,
**Lead-Time/Last-Minute**, **Orphan-Gap** (1–2-Nächte-Lücken) — geklammert auf
`[min_price, max_price]`. Ergebnis → Tabelle `dynamic_prices` (DP schreibt NIE in
`price_overrides`). Konfiguration je Objekt in `dp_settings` (opt-in, **default AUS**).
Verteilung über den vorhandenen Resolver (Kalender/Quote/Plattform lesen automatisch)
+ Channex-ARI-Push (Preis in Cent + Min-Stay, run-length-kodiert). Der tägliche Lauf
kommt über einen **Coolify Scheduled Task** auf `POST /pricing/recompute`; zusätzlich
werden bei neuer/stornierter Reservierung die betroffenen Tage (±2) neu gerechnet.
**Manuell schlägt automatisch:** ein vom Host gesetzter `price_override` bleibt
unangetastet und gewinnt im Resolver.

**Dynamic Pricing (Phase 2, Markt-Signal + Preis-Erklärung, Migration `0056`):**
Ein zusätzlicher **Markt-/Wettbewerbs-Faktor** über eine pluggable Provider-
Schnittstelle (`pricing/market/`): `MarketSignalProvider.market_signal()` liefert je
Tag `comp_price` (Median vergleichbarer Objekte), `demand_index` (0..1) und
`event_uplift_pct`. Auswahl per Env `MARKET_DATA_PROVIDER` — Default **NullProvider**
(kein Signal → Markt-Faktor neutral 1.0 → identisch zu Phase 1). `AirDnaProvider`
nur aktiv mit `AIRDNA_API_KEY` (B2B-Konto); ohne Key bleibt alles lauffähig. Der
Markt-Faktor zieht den Preis gewichtet (`market_sensitivity`) Richtung Markt-Median
+ Nachfrage, gedeckelt auf ±`market_max_adjust_pct`; Markt-Events werden mit
`event_periods` **gemerged (Maximum, keine Doppelzählung)**. Markt ist opt-in
zusätzlich (`dp_settings.market_enabled`, `market_key`, `comp_refs`). Die Engine
liefert je Tag eine **Faktor-Aufschlüsselung** (`dynamic_prices.factors` jsonb), die
über `GET /pricing/effective` (`factors`) bzw. `GET /calendar/availability`
(`price_factors`) als „Warum dieser Preis?"-Tooltip im Kalender erscheint
(Saison +X %, Wochenende +Y %, Markt +Z %, Auslastung −W %, …).

**Dynamic Pricing (Phase 3, zentrale Steuerung + Basispreis-Modus, Migration
`0057`):** Bedienmodell nach Vorbild gängiger Channel-Manager (Hostaway). Eigener
Hauptmenü-Bereich **`/dynamic-pricing`** mit einer **Objekt-Tabelle** (alle Objekte:
Objekt-ID + Foto, Basispreis + Modus, Min/Max, **Aktiv-Toggle**, **Bearbeiten**-Slider,
**30-Tage-Vorschau** `/dynamic-pricing/{id}`), gespeist aus `GET /pricing/overview`.
Die angezeigte ID ist die **interne Objekt-ID** (lückenlos, kanal-unabhängig) — DP
wirkt über den Resolver auf **beide** Verteilwege: die eigene Buchungsplattform (Pull)
und Channex/OTAs (Push), nicht nur auf einen Kanal. Pro Objekt
wählt der Vermieter, **wie der Basispreis (Anker) zustande kommt** —
`dp_settings.base_mode`: `data_driven` (Anker = `rate_plans.base_price`, Engine passt
an; Aggressivität `base_rate_mode` ∈ `conservative|recommended|aggressive` dämpft/
verstärkt die abweichungsbasierten Faktoren Auslastung+Markt mit ×0,5/×1,0/×1,5) oder
`manual` (fester `manual_base_price` als Anker, „volle Kontrolle"). `min_price`/
`max_price` bleiben die Leitplanken, der manuelle Tages-`price_override` im Kalender
gewinnt weiterhin immer (Resolver-Priorität). Rein additiv; Defaults
(`data_driven`/`recommended`) bilden das bisherige Verhalten ab.

Die Pricing-Konfiguration (Markups je Kanal, Extra-Gast-/Kurzaufenthalts-Aufschlag,
längenabhängige Preise, Gebühren, Steuern, Aktionen, Add-ons) liegt strukturiert in
`property_pricing_config` (Migration `0051`, Backfill aus `type_attributes.pricing`);
`PATCH /properties/{id}` spiegelt jede Pricing-Änderung dorthin. `rate_plans` +
`property_pricing_config` sind in der Realtime-Publication (`0052`) → Preisänderungen
erscheinen live im Kalender. Basispreis setzen: `PUT /api/v1/rates/base-price`
(Upsert — ersten Rate-Plan ändern oder anlegen, in einem Round-Trip).

---

## calendar (Kern-Logik implementiert)

Herzstück (Lastenheft §2.2). Double-Booking-Schutz über die `availability`-Tabelle.
Alle Endpoints erfordern Auth; `block`/`price-override`/`stop-sell` zusätzlich die
Capability `manage_calendar` (Stop-Sell-Schreibpfade außerdem die
Lodgify-Berechtigung `edit_calendar_bookings`), Leseendpoints `view_calendar`.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/calendar/availability?property_id&start&end` | Tagesstatus im Zeitraum inkl. `price` (aus dem pricing-Resolver) + `min_stay` je Tag (fehlende Tage = offen) |
| `GET` | `/api/v1/calendar/check?property_id&start&end` | Verfügbarkeit + Konflikttage (Double-Booking-Prüfung) |
| `POST` | `/api/v1/calendar/block` | Tage sperren — `409`, wenn bereits gebucht |
| `POST` | `/api/v1/calendar/price-override` | Tagespreis setzen; `price: null` nimmt zurück |
| `GET` | `/api/v1/calendar/stop-sell?property_id&start&end` | Verkaufsstopps im Zeitraum: `items[]` je Tag mit `id`, `date`, `reason`, `source` (`manual`\|`channex`), `agency_id` + `total`. `view_calendar` |
| `POST` | `/api/v1/calendar/stop-sell` | Verkaufsstopp setzen: `{property_id, range, reason?, weekdays?, agency_id?}` → `{stopped_days}`. `weekdays` = ISO-Wochentagsmaske (0=Mo…6=So, nur passende Tage), `agency_id` = Adressat der Stop-Sale-Meldung (`travel_agencies`, `null` = alle Kanäle). Wird als `stop_sell`-Restriction an Channex gepusht |
| `POST` | `/api/v1/calendar/stop-sell/clear` | Verkaufsstopp aufheben: `{property_id, range, weekdays?}` → `{status:"ok"}`. Löscht **nur manuelle** Stopps (`source=manual`); Channex-Stopps spiegeln den OTA-Stand und bleiben unangetastet. `stop_sell=false` geht nur für Tage an Channex, die danach wirklich frei sind |
| `POST` | `/api/v1/calendar/bulk-edit` | Preis/Min-Stay/Sperre/Stop-Sell über mehrere Objekte × Zeitraum — `404` (fremdes Objekt) |

```json
// GET /check → 200
{ "property_id": "uuid", "available": false, "conflicting_days": ["2026-05-02"] }
```

`start` inklusive, `end` exklusiv (Check-out-Tag ist wieder frei).

---

## reservations (implementiert)

Reservierungen anlegen/listen. Eine Reservierung belegt den Zeitraum im
Kalender (`availability` = `booked`) → derselbe Double-Booking-Schutz wie der
calendar-Slice. tenant_id stammt aus dem JWT. Leseendpoint erfordert
`view_calendar`, Anlegen `manage_calendar`.

**DSGVO-Daten-Split (Lastenheft §4):** Die Gast-Felder werden serverseitig je
Rolle maskiert. Rollen **mit** `view_guest_full` (admin, co_admin) erhalten
vollen Gastnamen + Beträge. Rollen **ohne** (owner, staff, cleaner — bzw.
unbekannte/fehlende Rolle, fail-closed) erhalten nur den **Vornamen**;
`total_amount` ist `null` und `currency` leer. Gilt für `list`, `dashboard` und
die Anlage-Antwort gleichermaßen (im Posteingang analog: `guest_email`/`phone`
werden zusätzlich unterdrückt).

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/reservations?property_id` | Reservierungen des Tenants (optional je Objekt); inkl. `num_guests` |
| `GET` | `/api/v1/reservations/dashboard` | Startseiten-Kennzahlen (echte Daten, im Backend berechnet) |
| `GET` | `/api/v1/reservations/{id}` | Vollständige Detailansicht (Slider): Belegung, Quote, Zahlung, Policy-Zeiten, Kontakt — maskierungskonform |
| `POST` | `/api/v1/reservations` | Reservierung anlegen — `404` (fremdes Objekt), `409` (Tage belegt) |
| `PATCH` | `/api/v1/reservations/{id}/move` | Verschieben (Objekt/Zeitraum) oder resizen (Check-in/out) — `409` bei Doppelbuchung, eigene Alt-Tage ausgenommen |
| `POST` | `/api/v1/reservations/{id}/cancel` | Stornieren mit Pflicht-`reason` (`422` ohne) — kanal-agnostisch (Direkt/Plattform/alle Channex-OTAs), gibt Tage frei (auch an Channex zurück), Audit in `reservation_cancellation_log`. Lokal: hebt OTA-Buchung NICHT beim Portal auf |

```json
// POST /reservations
{
  "property_id": "uuid",
  "check_in": "2026-05-01",
  "check_out": "2026-05-04",
  "channel": "direct",
  "source": "Telefon",
  "guests": { "adults": 2, "children": 0, "infants": 0, "pets": 0 },
  "contact": { "first_name": "Max", "last_name": "Muster", "email": "m@x.de", "phone": "", "country": "DE", "language": "Deutsch" },
  "total_amount": 540,
  "status": "confirmed"
}
```

Beim Anlegen wird der Gast in `guests` angelegt bzw. per E-Mail wiederverwendet;
alle Übernachtungstage werden auf `booked` ge-upsertet. `check_out` ist exklusiv.
Die Währung der Reservierung stammt vom Rate-Plan des Objekts (`rate_plans.currency`);
`properties` hat keine eigene Währungsspalte.

`GET /reservations/dashboard` liefert die Startseiten-Kacheln aus echten
Reservierungen (kein Fallback, stornierte Reservierungen ausgenommen):

```json
{
  "today": "2026-06-22",
  "checkouts_today": [ { "reservation_id": "uuid", "guest_name": "…", "property_title": "…", "channel": "booking", "ota_name": "Booking.com", "check_in": "…", "check_out": "…", "status": "confirmed" } ],
  "checkins_today": [ … ],
  "upcoming": [ … ],
  "checkins_30d":  { "value": 6,       "change_pct": 500.0 },
  "revenue_30d":   { "value": 2560.50, "change_pct": null },
  "confirmed_30d": { "value": 6,       "change_pct": 12.5 },
  "currency": "EUR"
}
```

- Listen: Check-outs/-ins mit `check_out`/`check_in == heute`, `upcoming` = künftige Anreisen.
- KPIs: laufende 30 Tage (inkl. heute) vs. die 30 Tage davor; `change_pct = null`,
  wenn keine Vorperiode existiert (keine erfundenen 0 %).

---

## booking_engine (öffentliche Plattform — implementiert)

Öffentliche Buchungsstrecke der eigenen Plattform (`/plattform`). **KEIN JWT** —
bewusst public (Gäste suchen/buchen). tenant_id wird serverseitig aus der Property
abgeleitet. Listings zeigen STRIKT nur `status='active'` (draft/inactive nie) und
NUR gast-sichere Felder (keine exakte Adresse, kein Eigentümer/Tenant, keine
internen Preisdetails). Preis kommt aus dem Pricing-Resolver.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/booking-engine/listings?q&guests&start&end&tenant` | Liste buchbarer (active) Objekte. Optional: `q` (Titel/Ort), `guests` (Kapazität), `start`/`end` (Verfügbarkeit + Effektivpreis), `tenant` (Default: alle active tenant-übergreifend) |
| `GET` | `/api/v1/booking-engine/listings/{id}?start&end` | Detail eines active Objekts (`404` wenn nicht active): Beschreibung, Fotos, Ausstattung, ungefähre Lage (gerundete lat/lng), Preis via Resolver |
| `GET` | `/api/v1/booking-engine/availability?property_id&start&end` | Öffentliche Tagesverfügbarkeit (buchbar/belegt) |
| `POST` | `/api/v1/booking-engine/reservations` | Gastbuchung (Double-Booking-Schutz `409`, sperrt Kalender + Channex-Push). Body kann `guests` + `addons` (Auswahl) enthalten → Zusatzleistungen werden serverseitig bepreist + als `reservation_addons` angelegt |
| `GET` | `/api/v1/booking-engine/reservations/{id}/addons?email` | Nach-Buchung-Sicht des Gasts: buchbare `guest_portal`-Zusatzleistungen (unter Beachtung der „wann anzeigen"-Regel) + bereits gekaufte. Verifikation über die Buchungs-E-Mail |
| `POST` | `/api/v1/booking-engine/reservations/{id}/addons` | Nachträglicher Add-on-Kauf durch den Gast (`email` + `addons`); serverseitig bepreist, Verkaufsfläche `guest_portal` |

Gast-sichere Felder: `id, title, property_type, city, country, photos, max_guests,
bedrooms, baths, amenities, price_from, currency` (+ Detail: `description, lat/lng
gerundet, price, nights, addons`). `price_from` = „ab"-Basispreis (None ohne
hinterlegten Preis — kein Fallback); Bewertungen nur bei echten Daten (sonst
weggelassen). `addons` (Detail) = für die Buchungsseite freigegebene Upsells.

---

## addons (Zusatzleistungen/Upsells — implementiert)

Optionale Extras, die Gäste dazubuchen (Früh-Check-in, Reinigung, Frühstück …).
Katalog-CRUD + Medien sind `MANAGE_PROPERTIES`-geschützt; der Verkauf läuft public
über `booking_engine` (s. o.). Tabellen `property_addons` + `reservation_addons`
(Migrationen 0074/0075).

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/api/v1/addons/properties/{property_id}` | Katalog eines Objekts (inkl. inaktiver) |
| `POST` | `/api/v1/addons/properties/{property_id}` | Zusatzleistung anlegen (Name/Beschreibung i18n, Preis, Basis, optional/pflicht, `appears_in`, `available_until`) |
| `PATCH` | `/api/v1/addons/{addon_id}` | bearbeiten |
| `DELETE` | `/api/v1/addons/{addon_id}` | löschen |
| `POST` | `/api/v1/addons/{addon_id}/media` | ein Medium hochladen (multipart, JPEG/PNG/WebP, max. 5) |
| `GET` | `/api/v1/addons/reservations/{reservation_id}` | gekaufte Extras einer Reservierung (Dashboard) |
| `GET` | `/api/v1/addons/reservations/{reservation_id}/available` | aktive Katalog-Add-ons des Objekts dieser Reservierung (Schnell-Auswahl) |
| `POST` | `/api/v1/addons/reservations/{reservation_id}/addons` | **Schnelltaste:** Zusatzleistung zu einer bestehenden Buchung hinzufügen — jeder Kanal, auch OTA (z. B. Booking), provisionsfrei am OTA vorbei |
| `POST` | `/api/v1/addons/reservation-addons/{id}/mark-paid` | manuell als bezahlt markieren (ohne Payment-Provider: „zahlbar bei Anreise") |

Abrechnungsbasis: `per_stay` · `per_night` · `per_guest` · `per_unit`. Verkauf
provisionsfrei am OTA vorbei; **Zahlstatus** `pending`/`paid`/`cancelled`. Beim
Kauf: Auto-Aufgabe (Task-Trigger `addon_purchased`) + Extra-Umsatz im
Owner-Statement. Preise werden **immer serverseitig** aus dem Katalog berechnet.

---

## guests (Gästekarte — implementiert)

Enterprise-Gästeprofil (vgl. OPERA Cloud „Manage Profile" / protel Gästekartei):
Stammdaten + Sub-Ressourcen (Adressen, Kontakte, Identitätsdokumente, Präferenzen,
Consents, Notizen, Dokumente) + Joins (Reservierungen, Posteingang-Threads,
Rechnungen). Tenant-isoliert (expliziter Filter + RLS via `current_tenant_id()`).

**Zugriff:** alle Endpoints erfordern `pm_guest_details` (sonst `403`). **Feld-
Maskierung** über den zentralen `auth/guest_masking.py` (Single Source of Truth,
identisch zu reservations/inbox): voller Name nur mit `view_guest_name` (sonst
Vorname), Kontakt mit `view_guest_contact`, Beträge/Umsatz mit `pm_booking_total`
& nicht `hide_prices`, **Ausweisnummern nur mit `view_guest_id_docs`** (sonst
`••• 1234`). Admin = immer alles.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/guests?q&vip&segment&blocked&limit&offset` | Liste + Suche (Name/E-Mail/Telefon/Firma) + Filter |
| `POST` | `/api/v1/guests` | Gast anlegen (`name` aus first/last_name ableitbar) |
| `GET` | `/api/v1/guests/{id}` | Detail (maskiert) |
| `PATCH` | `/api/v1/guests/{id}` | Stammdaten ändern |
| `DELETE` | `/api/v1/guests/{id}` | DSGVO: anonymisiert bei Reservierungsbezug, sonst Hard-Delete |
| `GET/POST/DELETE` | `/api/v1/guests/{id}/addresses[/{aid}]` | Adressen (1:n) |
| `GET/POST/DELETE` | `/api/v1/guests/{id}/contacts[/{cid}]` | Kontakte (1:n) |
| `GET/POST/DELETE` | `/api/v1/guests/{id}/identity-documents[/{did}]` | Ausweise (DSGVO; Schreiben braucht `view_guest_id_docs`) |
| `GET/PUT` | `/api/v1/guests/{id}/preferences` | Präferenzen (1:1, upsert) |
| `GET/POST` | `/api/v1/guests/{id}/consents` | Einwilligungen (append-only Historie) |
| `GET/POST/DELETE` | `/api/v1/guests/{id}/notes[/{nid}]` | interne Notizen |
| `GET/POST/DELETE` | `/api/v1/guests/{id}/documents[/{did}]` | Dokumente (Storage-Referenz) |
| `GET` | `/api/v1/guests/{id}/reservations` | Reservierungshistorie (Join) |
| `GET` | `/api/v1/guests/{id}/threads` | verknüpfte Posteingang-Threads (Join) |
| `GET` | `/api/v1/guests/{id}/invoices` | Rechnungen (Brücke guest.email → customers.email → invoices) |
| `POST` | `/api/v1/guests/merge` | Dubletten zusammenführen: Sub-Ressourcen + Reservierungen/Buchungen/WhatsApp-Konvos source→target umhängen, Quell-Gast anonymisieren |

**Tabellen (Migration 0046):** `guests` erweitert (Stammdaten, VIP/Segment,
`is_blocked`, Loyalty-Aggregate, `created_by/updated_by`, `anonymized_at`) +
`guest_addresses`, `guest_contacts`, `guest_identity_documents`,
`guest_preferences`, `guest_consents` (append-only), `guest_notes`,
`guest_documents`. Alle RLS via `current_tenant_id()`. Neue Permission
`view_guest_id_docs`.

---

## inbox (Posteingang — implementiert)

Gäste-Kommunikation pro OTA-Buchung (`channex_booking` = Thread). Nachrichten über
Channex-Messaging (Booking.com/Airbnb/Expedia) bzw. im Sandbox-Modus über den lokalen
Mock-Speicher. White-label (kein Provider-Branding für Endkunden).

**Enterprise-Zugriffsmodell (drei unabhängige Achsen, pro Nutzer über
`users.permissions` steuerbar — nicht an die Rolle gekoppelt; Quelle der Wahrheit
ist die DB, nicht das JWT; `inbox/authz.py`):**

- **Access** — jeder Endpoint erfordert `pm_chat` (sonst `403`). Admin immer.
- **Scope** — `inbox_view_all` → alle Tenant-Threads; ohne → nur die dem Nutzer
  zugewiesenen (`assigned_user_id == user_id`). Ein fremder Thread liefert im
  assigned-Scope bewusst `404` (keine Existenz preisgeben), nicht `403`.
- **Actions** — Senden/Planen erfordert `inbox_reply`, Zuweisen `inbox_assign`,
  Vorlagen/Automationen/KI-Settings (POST/PUT/DELETE) `inbox_manage_config`
  (sonst je `403`). Lesen ist davon unabhängig.
- **Field-Masking** — Gastname/-kontakt/Beträge/Quelle werden serverseitig je
  Berechtigung maskiert (zentraler `auth/guest_masking.py`, identisch zu
  reservations/dashboard): nur Vorname ohne `view_guest_name`, kein Kontakt ohne
  `view_guest_contact`, kein Betrag ohne `pm_booking_total` bzw. mit `hide_prices`,
  keine Quelle ohne `view_booking_source`.

Zuweisung ist gehärtet: Ziel-Nutzer muss `pm_chat` haben (sonst `422`); `list_team`
liefert nur Nutzer mit Posteingang-Zugriff; jede Zuweisung setzt `assigned_by`/
`assigned_at` und schreibt einen `inbox_assignment_log`-Eintrag (Audit).

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/inbox?unassigned` | Threads des Tenants (Filter „nicht zugewiesen") |
| `GET` | `/api/v1/inbox/team` | Team-Benutzer (mögliche Bearbeiter) |
| `GET/POST` | `/api/v1/inbox/{id}/messages` | Verlauf lesen / Nachricht senden |
| `GET` | `/api/v1/inbox/{id}/reservation` | Reservierungs-Kontext rechts |
| `PUT` | `/api/v1/inbox/{id}/flags` | Favorit/Notiz/Lesen/Archiv/Erinnerung |
| `PUT` | `/api/v1/inbox/{id}/assign` | Konversation einem Benutzer zuweisen (`user_id: null` hebt auf) |
| `PUT` | `/api/v1/inbox/{id}/guest` | Korrektur: Thread einem Gast zuordnen (`guest_id`); `null` → Gast aus Thread anlegen (Resolver). Braucht `inbox_manage_config` |
| `POST` | `/api/v1/inbox/{id}/notes` | Interne Notiz (gelb im Verlauf, `sender="note"`) |
| `GET/POST` | `/api/v1/inbox/{id}/scheduled` | Geplante Nachrichten auflisten / planen (`send_at` ISO) |
| `DELETE` | `/api/v1/inbox/scheduled/{sid}` | Geplante Nachricht abbrechen |
| `POST` | `/api/v1/inbox/bulk-update` | Massenaktion: `{action: read\|archived, before: YYYY-MM-DD}` |
| `POST` | `/api/v1/inbox/{id}/ai-reply` | KI-Antwortvorschlag (Groq) |
| `…` | `/api/v1/inbox/templates\|ai-settings\|automations` | Vorlagen / KI-Einstellungen / Automatisierungen |

**Interner Cron (kein JWT, Secret-Header `X-Internal-Cron-Secret` = `INTERNAL_CRON_SECRET`):**
Eigenes Secret, bewusst getrennt vom `CHANNEX_WEBHOOK_SECRET` (das geht outbound
an Channex und darf keine internen, tenant-übergreifenden Endpunkte
autorisieren). Ohne gesetztes `INTERNAL_CRON_SECRET` antworten diese Endpunkte
mit **503** (deaktiviert, kein Fallback).

| `POST` | `/api/v1/inbox/internal/dispatch-scheduled` | Versendet fällige geplante Nachrichten (alle Tenants) |
| `POST` | `/api/v1/inbox/internal/dispatch-automations` | Versendet fällige Automails (Buchungsbestätigung, Anreise-/Check-out-Info; alle Tenants) |

Per Coolify-Scheduled-Task / crontab regelmäßig aufrufen, analog zu
`/channel-manager/internal/reconcile`:

```
*/5 * * * * curl -fsS -X POST https://<api-host>/api/v1/inbox/internal/dispatch-scheduled \
  -H "X-Internal-Cron-Secret: $INTERNAL_CRON_SECRET"
# Automails (planbare Auto-Nachrichten) — minütlich, damit die Uhrzeit (z. B.
# 07:45) zeitnah getroffen wird:
* * * * * curl -fsS -X POST https://<api-host>/api/v1/inbox/internal/dispatch-automations \
  -H "X-Internal-Cron-Secret: $INTERNAL_CRON_SECRET"
```

**Tabellen (Migration 0040):** `channex_booking.assigned_user_id` (Zuweisung),
`inbox_scheduled_message` (geplante Nachrichten, `status` pending→sent|failed|cancelled),
`inbox_thread_note` (interne Notizen). RLS via `current_tenant_id()`.
**Migration 0045 (Audit):** `channex_booking.assigned_by`/`assigned_at` +
`inbox_assignment_log` (from/to/by-User, Historie). RLS via `current_tenant_id()`.

**Posteingang-Berechtigungen (Lodgify-Permissions, `users.permissions`):**
`pm_chat` (Zugriff), `inbox_view_all` (Scope), `inbox_reply`, `inbox_assign`,
`inbox_manage_config`. Default: admin/co_admin alle; staff/owner/cleaner ohne
(staff erhält `pm_chat`/`inbox_reply` nur, wenn im Benutzer-Wizard aktiviert).

---

## whatsapp (WhatsApp-Kanal — implementiert, Credentials erforderlich)

Bidirektionaler WhatsApp-Kanal über die **Meta WhatsApp Cloud API**. Eine
Konversation je Gast-Telefonnummer; Nachrichten in beide Richtungen. Versand über
die Cloud API (oder Sandbox-Mock bei `WHATSAPP_SANDBOX=true` — kein realer
Versand). Eingehende Nachrichten + Zustellstatus kommen per Meta-Webhook.
Geschützte Endpoints erfordern `view_guest_full`.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/whatsapp/status` | Konfig-Status (white-label, kein Token): konfiguriert / Sandbox |
| `GET` | `/api/v1/whatsapp/conversations` | Konversationen des Tenants |
| `GET` | `/api/v1/whatsapp/conversations/{id}/messages` | Verlauf (markiert als gelesen) |
| `POST` | `/api/v1/whatsapp/send` | Senden: `{conversation_id?\|to_phone?, body}` |

**Webhook (kein JWT, von Meta aufgerufen):**

| `GET` | `/api/v1/whatsapp/webhook` | Verify-Handshake (`hub.challenge`, prüft `WHATSAPP_VERIFY_TOKEN`) |
| `POST` | `/api/v1/whatsapp/webhook` | Eingehende Nachrichten + Status; idempotent über Meta-Message-ID |

Webhook in der Meta-App-Konfiguration eintragen:
`https://<api-host>/api/v1/whatsapp/webhook`, Verify-Token = `WHATSAPP_VERIFY_TOKEN`,
Feld `messages` abonnieren.

**Tenant-Auflösung eingehender Nachrichten:** bestehende Konversation (per Nummer)
→ deren Tenant; sonst `WHATSAPP_DEFAULT_TENANT_ID`. Ohne beides wird die Nachricht
protokolliert verworfen (kein Raten).

**Tabellen (Migration 0041):** `whatsapp_conversation` (je Tenant+Nummer, `is_read`,
optional `reservation_id`), `whatsapp_message` (`direction` in|out, `status`
sent|delivered|read|failed|received, Meta-ID-Unique für Idempotenz). RLS via
`current_tenant_id()`.

**Env:** `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_GRAPH_VERSION` (v21.0), `WHATSAPP_SANDBOX`, `WHATSAPP_DEFAULT_TENANT_ID`.

---

## payments (Stripe Payment-Kern — implementiert)

Online-Zahlungen über **Stripe** (primär; Revolut sekundär/NotImplemented). Connect
ist **Custom** (voll white-label, kein Stripe-Branding/-Onboarding). Geldfluss =
**Destination Charge**: der Gast zahlt über den Plattform-Account, das Geld geht an
den Connected Account des Tenants (`transfer_data.destination`).

**0% Buchungsgebühr (ADR-0006):** Auf PMS-/Direktbuchungen der Vermieter erhebt
myNextDays **keine** Provision — `STRIPE_PLATFORM_FEE_PCT` ist 0. Eine Provision
(`application_fee_amount`) ist nur für den eigenen Marktplatz (Portal-Buchungen,
Phase 2) vorgesehen.

**OTA-Gate (nur eigene Kanäle):** Ein PaymentIntent (Buchung **und** Kaution) wird
**nur** für eigene Kanäle erzeugt — `channel` ∈ {`direct`, `portal`} **ohne**
`source_channex_booking_id`. OTA-Buchungen (`booking`/`airbnb`/`vrbo` oder über
Channex importiert) kassiert die OTA selbst und zahlt den Vermieter direkt aus →
`booking/.../intent` und `deposit/.../hold` antworten dafür mit **409** (keine
doppelte Belastung). Add-ons/Upsells am OTA vorbei sind separat (addons-Slice).

| Methode | Pfad | Zugriff |
|---|---|---|
| `POST` | `/api/v1/payments/connect/accounts` | MANAGE_BILLING — Custom-Account anlegen |
| `GET` | `/api/v1/payments/connect/accounts/{id}` | MANAGE_BILLING — KYC-Status + Requirements |
| `PATCH` | `/api/v1/payments/connect/accounts/{id}` | MANAGE_BILLING — Geschäfts-/Inhaberdaten (eigene UI) |
| `PUT` | `/api/v1/payments/connect/accounts/{id}/bank` | MANAGE_BILLING — Auszahlungs-IBAN |
| `POST` | `/api/v1/payments/booking/{reservation_id}/intent` | **public** (Gast) — PaymentIntent, `{client_secret}` |
| `POST` | `/api/v1/payments/deposit/{reservation_id}/hold` | MANAGE_BILLING — Kaution vorautorisieren |
| `POST` | `/api/v1/payments/deposit/{payment_id}/capture` | MANAGE_BILLING — Kaution einziehen (Schaden) |
| `POST` | `/api/v1/payments/deposit/{payment_id}/release` | MANAGE_BILLING — Kaution freigeben |
| `POST` | `/api/v1/payments/{payment_id}/refund` | MANAGE_BILLING — (Teil-)Erstattung |
| `POST` | `/api/v1/payments/webhook` | Stripe-Signatur (kein JWT) |

**Kaution** = manual-capture PaymentIntent über `properties.deposit_amount`.
**Webhook** (idempotent über `stripe_webhook_event`): `account.updated` →
`tenant_billing_profile`; `payment_intent.succeeded|payment_failed|
amount_capturable_updated` + `charge.refunded` → `payments.status` +
`reservations.payment_status` (Enum `unpaid|pending|paid|refunded|deposit_held`).

**Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
(→ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` im Frontend), `STRIPE_PLATFORM_FEE_PCT`
(Default 0). **Offen:** Owner→Owner-Stripe-Transfer, Revolut-Adapter.

---

## buchhaltung (Rechnungen + Kunden implementiert)

Aus Taskilo übernommen, auf das NextDays-Mandantenkonzept vereinheitlicht
(`tenant_id` statt `company_id`). Tenant-scoped; schreibende Endpoints erfordern
die Lodgify-Berechtigung `owner_reporting`. Beträge werden serverseitig aus den
Positionen berechnet (Decimal, kaufmännisch gerundet) — der Client kann sie nicht
fälschen. GoBD-gesperrte Rechnungen (`is_locked`) sind nicht mehr änderbar/löschbar.

| Methode & Pfad | Zweck |
| --- | --- |
| `GET /api/v1/buchhaltung/customers` | Kunden/Lieferanten des Tenants |
| `POST /api/v1/buchhaltung/customers` | Kunde anlegen → `201` |
| `PATCH /api/v1/buchhaltung/customers/{id}` | Kunde ändern |
| `DELETE /api/v1/buchhaltung/customers/{id}` | Kunde (soft) löschen → `204` |
| `GET /api/v1/buchhaltung/invoices` | Rechnungen (schlanke Liste) |
| `GET /api/v1/buchhaltung/invoices/company/{id}` | Rechnungen im `InvoiceData`-Format (für den übernommenen Bestand) |
| `GET /api/v1/buchhaltung/invoices/{id}` | Einzelne Rechnung inkl. Positionen |
| `POST /api/v1/buchhaltung/invoices` | Rechnung anlegen — nimmt das reiche camelCase-Payload der Erstellen-Seite, Beträge serverseitig → `201` |
| `PATCH /api/v1/buchhaltung/invoices/{id}` | Rechnung ändern / E-Rechnung-XML nachtragen (`409` wenn GoBD-gesperrt) |
| `DELETE /api/v1/buchhaltung/invoices/{id}` | Rechnung (soft) löschen (`409` wenn gesperrt) |
| `GET /api/v1/buchhaltung/number-sequences/{company_id}` | Vorschau der nächsten Nummer (nicht-inkrementierend). Die echte GoBD-Nummer wird nur beim Speichern eines Belegs gezogen — es gibt bewusst keinen inkrementierenden Endpunkt, der eine Nummer ohne Beleg verbrennt. |
| `GET /api/v1/buchhaltung/companies/{id}` | Firmen-/Rechnungsprofil des Tenants (`tenant_billing_profile`) |
| `PATCH /api/v1/buchhaltung/companies/{id}` | Firmenprofil anlegen/ändern (Upsert) |
| `GET /api/v1/buchhaltung/companies/{id}/transaction-links` | Beleg↔Bank-Verknüpfungen (Stub → leer, Bankabgleich folgt) |
| `GET /api/v1/buchhaltung/booking-accounts/{id}` | Kontenplan (Stub → leer, Modul folgt) |
| `POST /api/v1/buchhaltung/inline-invoice-services` | Service-Usage-Tracking (No-Op, Analytics folgt) |

**Frontend-Anbindung (übernommener Bestand):** Die Bestands-Komponenten rufen
`/api/v1/invoices…`, `/customers`, `/companies` etc. auf dem **eigenen Origin** auf.
Ein Next.js-Proxy (`apps/web/app/api/v1/[...path]/route.ts`) injiziert server-seitig
das Session-Token (`currentToken()`) und leitet an FastAPI weiter; der api-client
mappt die Pfade auf den `buchhaltung`-Slice. Damit bleibt der Bestand 1:1 und nutzt
die echte NextDays-Session.

```json
// POST /buchhaltung/invoices
{ "customer_id": null, "currency": "EUR", "notes": "…",
  "items": [
    { "description": "Reinigung", "quantity": "2", "unit_price": "100", "tax_rate": "19" }
  ] }
// Antwort 201: vollständige Rechnung mit berechnetem net_amount/tax_amount/gross_amount
```

Kleinunternehmer (§19 UStG) wird aus `tenant_billing_profile.is_kleinunternehmer`
gezogen; ist es gesetzt, wird die Steuer auf 0 gesetzt. Tabellen siehe Migrationen
`0023_buchhaltung_fundament.sql` (`tenant_billing_profile`, `customers`, `invoices`,
`invoice_line_items`), `0024_buchhaltung_angebote.sql` (`quotes`, `quote_line_items`)
und `0025_buchhaltung_nummernkreise.sql` (`number_sequences` + Funktion
`next_document_number()` für GoBD-lückenlose Nummern) — alle RLS via
`current_tenant_id()`. `0026_buchhaltung_firmenprofil.sql` erweitert
`tenant_billing_profile` um Adresse, Kontakt (Tel/E-Mail/Web), Handelsregister
(HRB/Amtsgericht/Rechtsform), Geschäftsführer und Logo — diese Felder füllen den
Rechnungskopf und den GoBD-Pflichtfooter. `GET/PATCH /companies/{id}` liefert/
speichert sie als camelCase (`companyName`, `companyStreet`, `phoneNumber`, `vatId`,
`companyRegister`, `districtCourt`, `firstName`/`lastName`, `iban` …).

---

## channel_manager (Channex-Integration implementiert)

Channel-Manager-Anbindung für OTA-Distribution (Booking.com, Airbnb, Expedia …)
über **Channex** (https://docs.channex.io). Channex ist der konkrete Provider
hinter dem `channel_manager`-Slice; der HTTP-Client kapselt die Channex-API
(`channex_client.py`, Auth-Header `user-api-key`, Body-Wrapping `{"<entity>": …}`,
429-Backoff). Tenant-scoped; verwaltende Endpoints erfordern die Lodgify-
Berechtigung `manage_property_settings`. Beträge laufen durchgängig in **Cent**
(eindeutig, keine Rundungsfehler).

| Methode & Pfad | Zweck |
| --- | --- |
| `GET /api/v1/channel-manager/health` | Slice-Status + `channex_configured` (API-Key gesetzt?) |
| `GET /api/v1/channel-manager/properties` | Property-Mappings des Tenants |
| `POST /api/v1/channel-manager/properties` | Property mit Channex verbinden (bestehende anbinden **oder** neu anlegen) → `201` |
| `DELETE /api/v1/channel-manager/properties/{map_id}` | Mapping (soft) trennen → `204` |
| `POST /api/v1/channel-manager/ari` | Verfügbarkeit + Preise/Restriktionen gebündelt pushen (Channex-ARI) |
| `GET /api/v1/channel-manager/bookings` | Eingegangene OTA-Buchungen des Tenants |
| `POST /api/v1/channel-manager/bookings/sync` | Buchungs-Revisions-Feed ziehen → speichern → bei Channex bestätigen (ack) |
| `GET /api/v1/channel-manager/portals` | Verbindbare Buchungsportale + Eingabefelder (white-label; Felder live aus dem Provider-Katalog) |
| `POST /api/v1/channel-manager/channels/prepare` | Schritt 1+2: Zugangsdaten prüfen + Portal-Zimmer/Raten holen (legt nichts an) |
| `GET /api/v1/channel-manager/channels` | Verbundene Kanäle des Tenants (white-label) |
| `POST /api/v1/channel-manager/channels` | Schritt 3+4: Kanal mit Zimmer/Raten-Zuordnung anlegen **und aktivieren** → `201` |
| `DELETE /api/v1/channel-manager/channels/{channel_id}` | Kanal trennen (erst deaktivieren, dann löschen) → `204` |
| `GET /api/v1/channel-manager/properties/{property_id}/connections` | Gespeicherte OTA-Verbindungen eines Objekts (Hotel-ID + Status pro Portal, white-label) |
| `POST /api/v1/channel-manager/webhook` | Webhook-Empfang (ohne JWT, via geteiltem Secret-Header `X-Channex-Webhook-Secret`) |

**ARI-Push (Best-Practice: batchen, nicht einzeln).** Availability und Preise
werden getrennt zu Channex gesendet (Channex priorisiert die Availability-Queue).
Rate-Limits: 20 ARI/Min pro Property (je 10 Availability/Restrictions) → der Client
fängt `429` mit Backoff ab.

```json
// POST /channel-manager/ari
{
  "availability": [
    { "room_type_map_id": "…", "date_from": "2026-07-01", "date_to": "2026-07-31", "availability": 5 }
  ],
  "rates": [
    { "rate_plan_map_id": "…", "date_from": "2026-07-01", "date_to": "2026-07-31",
      "rate_cents": 12000, "min_stay_arrival": 2, "stop_sell": false }
  ]
}
// Antwort: { "availability_tasks": 1, "rate_tasks": 1, "warnings": [] }
```

**Buchungen (Pull statt Push).** Channex empfiehlt den `booking_revisions/feed`
als primären Weg: Revisionen holen, lokal speichern, **erst dann** acken (gegen
Duplikate). Webhooks dienen nur als Trigger — wegen unsicherer Reihenfolge wird
immer der aktuelle Stand gezogen, nicht der Webhook-Payload verarbeitet.

**Whitelabel & Auto-Onboarding.** EIN Whitelabel-Konto (unser API-Key), darin
**pro Tenant eine Group** (`channex_group_map`, Migration `0028`). Der Flow läuft
automatisch und **non-blocking** (Provider-Fehler dürfen Registrierung/Objekt-
Anlage nie scheitern lassen):

1. **Registrierung** (`auth.register`) → legt automatisch die Tenant-Group an.
2. **Firmendaten** (Onboarding-Schritt 1, Pflicht) → der Kunde (= Admin seines
   Tenants) erfasst Firma/Adresse/Kontakt + Steuer (USt-ID/VAT-ID **oder**
   Steuernummer, oder „Kleinunternehmer"). Gespeichert via
   `PATCH /buchhaltung/companies/{id}` in `tenant_billing_profile`; Status-Flag
   `company_data_set` in `tenant_onboarding`. Länderneutral (DACH + EU, ISO-Land
   + Währung). Pflicht, BEVOR Objekt/Anbindung möglich sind.
3. **Objekt anlegen** (`POST /properties`) → löst den **Content-Sync** aus: Provider-
   Property (in der Tenant-Group) + **ein synthetischer Room-Type** (`count_of_rooms=1`)
   + je lokalem Preisplan **ein Rate-Plan** werden angelegt; alle Mapping-Tabellen
   gefüllt. Idempotent (POST wenn kein Mapping, sonst PUT) → beliebig wiederholbar.
   Die **Firmen-Adresse/Kontakt** (aus `tenant_billing_profile`) wird an die
   Provider-Property mitgegeben (`address`, `zip_code`, `city`, `country`, `email`,
   `phone`, `website`) — OTAs verlangen das zur Aktivierung.

NextDays modelliert **keine Zimmerkategorien** (eine `property` IST die buchbare
Einheit, Ferienwohnungs-Modell). Channex verkauft aber Room-Types — daher der
synthetische 1:1-Room-Type pro Property. Geld: `rate_plans.base_price` (Euro) →
Cent-Integer **nur an der Provider-Grenze** (`_euro_to_cents`).

**Kanäle verbinden (inhouse, KEIN Provider-iFrame).** Eigener 4-Schritt-Flow über
die Channel-API, damit der Kunde nie den Provider sieht:

1. **`channels/prepare`** ruft `test_connection` (Zugangsdaten prüfen — Achtung:
   Provider liefert HTTP 200 auch bei Fehler, Erfolg steht in `data.success`) und
   `mapping_details` (Portal-Zimmer/Raten) und liefert sie + die lokalen Preispläne
   zur Zuordnung zurück.
2. Die UI lässt **OTA-Zimmer+Rate ↔ lokalen Preisplan** zuordnen.
3. **`POST /channels`** legt den Kanal mit `group_id` (Pflicht), `properties:[…]`
   und `rate_plans:[{rate_plan_id, settings:{room_type_code, rate_plan_code, …}}]`
   an — **Codes als Integer** (Strings → „Not mapped"). Kanäle starten **inaktiv**.
4. Der Slice **aktiviert** den Kanal direkt (`/channels/:id/activate`). Trennen geht
   nur über vorheriges `deactivate` (sonst `422 "is active"`).

**Sandbox-Test (OpenChannel).** Mit `CHANNEX_SANDBOX_PORTALS=true` erscheint ein
Test-Portal, das den selbst bereitgestellten Mock-OTA (`…/channel-manager/
sandbox-ota/`) nutzt — so läuft der komplette Connect-Flow ohne echtes OTA-Konto.
Nur Dev/Test; in Prod aus.

**White-Label (Pflicht):** Der Kunde darf den Provider nie sehen. Daher enthält
**keine** Frontend-Antwort den Provider-Namen oder die Provider-IDs — die
`PropertyMapResponse` liefert `property_title` statt `channex_property_id`, die
`BookingResponse` nutzt `external_id` (neutral). UI-Texte sprechen nur von
„Kanälen" / „Channel-Manager".

**Mapping-Tabellen** (Migrationen `0027_channex.sql` + `0028_channex_groups.sql`,
alle RLS via `current_tenant_id()`): `channex_group_map` (Tenant ↔ Group),
`channex_property_map` (lokale property ↔ Provider-Property), `channex_room_type_map`
(Einheit ↔ Room-Type), `channex_rate_plan_map` (Preisplan ↔ Rate-Plan) und
`channex_booking` (eingehende OTA-Buchungen mit `revision_id`/`system_id` zur
Dedup + voller `raw`-Payload).

**OTA-Verbindungen** (`0035_channex_channel_connection.sql`): `channex_channel_connection`
persistiert pro (Objekt, Portal) die vom Vermieter eingegebene **OTA-Hotel-ID**, den bei
Channex erzeugten `channex_channel_id` und den Aktiv-Status. So bleibt die Verbindung
sichtbar/verwaltbar (Status, Trennen, Re-Connect mit vorbefüllter Hotel-ID).
`connect_channel`/`disconnect_channel` schreiben sie; `list_channel_connections` liest
sie white-label (nur Portal-Label, Hotel-ID, Status — keine Credentials). Unique
`(property_id, ota_portal_code)`.

**Zertifizierung (Channex PMS, 14 Tests):** Full-Sync (500 Tage in ≤2 Calls),
**nur Delta-Updates** (Full-Sync max. 1×/Tag), Batching mehrerer Änderungen pro
Call, Rate-Limit-Treue (429-Backoff), Booking-Receiving via Webhook→Feed→Ack.
Per-Person-Rate-Pläne nutzen (Limits: Hotel 20 Room-Types/200 Rate-Plans).

**Frontend-Anbindung:** `apps/web/lib/channex.ts` (Server-Actions nach
`Result<T>`-Muster) ruft den Slice über den Proxy auf; das Session-Token wird
server-seitig injiziert (`currentToken()`).

**Secrets (Coolify-Env / `.env`):** `CHANNEX_API_KEY`, `CHANNEX_BASE_URL`
(Staging `https://staging.channex.io/api/v1`, Prod `https://app.channex.io/api/v1`),
`CHANNEX_WEBHOOK_SECRET` (eigenes Zufalls-Secret, im Webhook-Receiver geprüft —
Channex signiert nicht via HMAC).

---

## content (Übersetzung implementiert)

Texte übersetzen (Mietvertrag, Raten-Info) über die Google Cloud Translation
API. Der API-Key bleibt serverseitig (`GOOGLE_TRANSLATE_API_KEY`). Nur für
eingeloggte Nutzer.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/api/v1/content/translate` | Text/HTML übersetzen (da/en/de) |

```json
// POST /content/translate
{ "text": "<p>Willkommen …</p>", "target": "en", "source": "de", "fmt": "html" }
// → 200
{ "text": "<p>Welcome …</p>", "detected_source": "de" }
```

`source` ist optional (auto-Erkennung). `fmt` ist `html` (Rich-Text) oder
`text`. Fehlt der Key → `503`; API-/Netzwerkfehler → `502`.

---

## tasks (Logik implementiert — Lastenheft §2.5/§4.3)

Aufgaben, Checklisten mit Foto-Nachweisen, Vertretung, Inventar.

| Methode | Pfad | Capability | Beschreibung |
|---|---|---|---|
| `POST` | `/api/v1/tasks` | `manage_tasks` | Aufgabe anlegen |
| `GET` | `/api/v1/tasks/mine` | `view_own_tasks` | eigene Aufgaben |
| `GET` | `/api/v1/tasks/by-reservation/{id}` | `view_calendar` | Aufgaben zu einer Buchung (PM-Detailseite) |
| `PATCH` | `/api/v1/tasks/{id}/status` | `manage_tasks` | Aufgaben-Status setzen (offen/in Arbeit/erledigt/abgebrochen) |
| `POST` | `/api/v1/tasks/from-booking` | `manage_tasks` | aus Buchung: Anreise-Check + Endreinigung |
| `POST` | `/api/v1/tasks/checklist/item` | `view_own_tasks` | Checklisten-Punkt |
| `POST` | `/api/v1/tasks/checklist/photo` | `view_own_tasks` | Foto-Nachweis (unbegrenzt/Raum) |
| `POST` | `/api/v1/tasks/substitution` | `request_substitute` | Vertretung anfragen (§4.3) |
| `POST` | `/api/v1/tasks/inventory` | `manage_inventory` | Inventar (property_id null = zentraler Pool) |

---

## owners (Eigentümer-Stammdaten — implementiert)

Eigentümer (Lead → Vermieter) + Objekt-Zuweisung mit Anteil und Provisions-
Override je Objekt (Basis für den Eigentümer-Objekt-Scope, Lastenheft §4.2).
Tenant-geschützt (`MANAGE_OWNERS`).

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/owners` | Eigentümer-Liste |
| `POST` | `/api/v1/owners` | Eigentümer anlegen |
| `GET` | `/api/v1/owners/{owner_id}` | Eigentümer-Detail |
| `PATCH` | `/api/v1/owners/{owner_id}` | Eigentümer aktualisieren |
| `DELETE` | `/api/v1/owners/{owner_id}` | Eigentümer löschen |
| `POST` | `/api/v1/owners/{owner_id}/properties` | Objekt zuweisen (Anteil + Provisions-Override) |
| `DELETE` | `/api/v1/owners/{owner_id}/properties/{property_id}` | Zuweisung aufheben |

---

## owner_statements (Auszahlungs-Abrechnung — implementiert)

Rechnerische Eigentümer-Abrechnung je Zeitraum: Buchungssatz
`(total_amount − channel_fee) × (1 − Provision)` je Reservierung (Provisionssatz
des Objekts), EU-Steuer-Kategorien (S / AE Reverse-Charge / E Kleinunternehmer),
GoBD-Nummernkreis, Stornorechnung statt Löschen, Mehrwährung via ECB-Tageskurs
am Check-out (kein Fallback → 502). Reporting-/Billing-geschützt.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/owner-statements` | Abrechnungen auflisten |
| `POST` | `/api/v1/owner-statements` | Abrechnung erzeugen (Zeitraum) |
| `POST` | `/api/v1/owner-statements/preview` | Vorschau ohne Persistenz |
| `GET` | `/api/v1/owner-statements/{id}` | Detail (eingefrorene Summen) |
| `PATCH` | `/api/v1/owner-statements/{id}` | Entwurf bearbeiten |
| `POST` | `/api/v1/owner-statements/{id}/finalize` | Finalisieren (Nummernkreis) |
| `POST` | `/api/v1/owner-statements/{id}/cancel` | Stornieren (Stornorechnung) |
| `DELETE` | `/api/v1/owner-statements/{id}` | Entwurf löschen |
| `POST` | `/api/v1/owner-statements/expenses` | Eigentümer-Ausgabe anlegen |
| `PATCH` | `/api/v1/owner-statements/expenses/{id}` | Ausgabe ändern |
| `DELETE` | `/api/v1/owner-statements/expenses/{id}` | Ausgabe löschen |
| `POST` | `/api/v1/owner-statements/auto-run` | Periodische Auto-Abrechnung auslösen |

---

## Authentifizierung allgemein

- Supabase-JWT **ES256 via JWKS** (modernes Supabase), verifiziert in `core/security.py`
  über den JWKS-Endpoint; **HS256-Fallback** gegen `SUPABASE_JWT_SECRET` für lokale/ältere Setups.
- `AuthContext` (`user_id`, `tenant_id`, `role`) wird aus den JWT-Claims gelesen.
- Geschützte Endpoints nutzen die `CurrentUser`-Dependency.

### Rate-Limiting

Alle Endpunkte laufen durch einen **Redis-backed Rate-Limiter** (ASGI-Middleware,
`core/ratelimit.py` + `ratelimit_middleware.py`) mit gestaffelten Buckets
(Default/IP, Auth, Payments, Listings, pro Tenant — per Env konfigurierbar). Bei
Überschreitung antwortet die API mit **HTTP `429`** + Headern **`Retry-After`**
(Restsekunden des Fensters), **`X-RateLimit-Limit`** und
**`X-RateLimit-Remaining`** — Clients sollten `Retry-After` respektieren. Bei
Redis-Ausfall gilt fail-open, für sensible Pfade (Auth/Payments) fail-closed
(`503` + `Retry-After`). Limits, Env-Schalter und Betriebsdetails:
**[deploy/RATE-LIMITING.md](../deploy/RATE-LIMITING.md)**.

> Die übrigen Slices (properties, calendar, …) werden nach dem auth-Muster
> ausgebaut. Diese Übersicht wird dabei fortgeschrieben.

## travel_agencies — Reisebüro-/Partner-Kartei

Alle Endpunkte hinter der Lodgify-Permission `manage_partners`. Verträge sind
nach Jahren gruppierbar (Jahr = `valid_from`); Vertragsdateien liegen im
privaten Bucket `agency-contracts` (Download nur als signierte URL).

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/api/v1/travel-agencies?q&include_inactive` | Partner-Liste |
| `POST` | `/api/v1/travel-agencies` | Partner anlegen |
| `GET/PATCH/DELETE` | `/api/v1/travel-agencies/{id}` | Kartei lesen/ändern/löschen |
| `GET/POST` | `/api/v1/travel-agencies/{id}/contacts` · `DELETE …/{cid}` | Kontaktpersonen |
| `GET/POST` | `/api/v1/travel-agencies/{id}/contracts` · `PATCH/DELETE …/{cid}` | Verträge (Art, Gültigkeit, Währung, Kommission, Release) |
| `POST` | `…/contracts/{cid}/file` | Vertragsdokument hochladen (multipart, PDF/JPG/PNG/DOCX/XLSX, 25 MB) |
| `GET` | `…/contracts/{cid}/file-url` | signierte Download-URL (TTL 1 h) |
| `GET/POST` | `…/contracts/{cid}/rates` · `DELETE …/{rid}` | Saison-Preiszeilen (Zeitraum × Objekt × Preis/Nacht, net/gross, min_stay) |

Verknüpfung Verkaufsstopp: `POST /api/v1/calendar/stop-sell` akzeptiert
`agency_id` (Adressat der Stop-Sale-Meldung) und `weekdays` (ISO 0=Mo…6=So);
manuelle Stopps werden als `stop_sell`-Restriction an Channex gepusht.

---

## site_config (Page-Builder — implementiert)

Backend des Page-Builders (Architektur + Datenmodell:
[ARCHITECTURE.md §12](ARCHITECTURE.md#12-page-builder)).
Der Slice mountet **zwei Router**: den Dashboard-Router `/api/v1/site-config`
(JWT + Capability `MANAGE_SITE_CONFIG`, tenant-gescoped — jeder Zugriff wird
explizit auf den Tenant aus dem JWT gefiltert; ohne Tenant im Konto → `400`)
und den öffentlichen Resolver `/api/v1/site` (**kein JWT**, service-role) für
den `builder/`-Renderer der myNextDays-Websites.

### Branding & Custom-Domains (`/api/v1/site-config`)

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/site-config/health` | Slice-Status |
| `GET` | `/api/v1/site-config` | Branding lesen (`site_name`, `tagline`, `logo_url`, `hero_image_url`, `primary_color`/`secondary_color` (Hex `#rrggbb`), `font_family`, `about_text`/`contact_text`/`social_links` (i18n-/Key-Objekte), `booking_mode` `instant\|inquiry\|both`); leere Config → Defaults/None |
| `PUT` | `/api/v1/site-config` | Branding setzen — Teil-Update, nur gesendete Felder werden geschrieben |
| `GET` | `/api/v1/site-config/domains` | Custom-Domains des Tenants (`status` `pending\|active\|error`, `ssl_status`, `dns_records[]`; die interne Cloudflare-Hostname-ID wird bewusst nicht exponiert) |
| `POST` | `/api/v1/site-config/domains` | Domain verbinden → `201`; legt den Cloudflare-Custom-Hostname an und liefert die zu setzenden DNS-Records (CNAME + TXT-Validierung). `409` Domain bereits vergeben (global unique); `503` Cloudflare nicht konfiguriert |
| `POST` | `/api/v1/site-config/domains/{domain_id}/sync` | Status/SSL-Status frisch von Cloudflare spiegeln (`pending` → `active`). `409` wenn nicht mit Cloudflare verknüpft |
| `DELETE` | `/api/v1/site-config/domains/{domain_id}` | Domain trennen → `204` (Cloudflare-`404` wird toleriert) |

### Seiten (`/api/v1/site-config/pages`)

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/site-config/pages` | Seiten des Tenants (sortiert nach `nav_order`) |
| `POST` | `/api/v1/site-config/pages` | Seite anlegen → `201`. Body `{title, slug?}`; `slug` nur `a-z 0-9 -`, leer = Home-Slug. Die **erste** Seite eines Tenants wird automatisch Home. `409` Slug bereits vergeben |
| `PUT` | `/api/v1/site-config/pages/{page_id}` | Seite ändern (Teil-Update): `title`, `slug`, `seo_title`, `seo_description`, `og_image_url`, `nav_order`. `409` Slug-Kollision |
| `POST` | `/api/v1/site-config/pages/{page_id}/home` | Seite zur Home-Seite machen (genau eine je Tenant, partieller Unique-Index) |
| `POST` | `/api/v1/site-config/pages/{page_id}/publish` | veröffentlichen (`is_published=true`) |
| `POST` | `/api/v1/site-config/pages/{page_id}/unpublish` | Veröffentlichung zurücknehmen |
| `DELETE` | `/api/v1/site-config/pages/{page_id}` | Seite löschen → `204` (Blöcke per FK-Cascade) |
| `POST` | `/api/v1/site-config/pages/{page_id}/draft-token` | Kurzlebigen Vorschau-Token erzeugen → `{token}` (s. u.) |

### Blöcke (`/api/v1/site-config/…/blocks`)

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/site-config/pages/{page_id}/blocks` | Blöcke einer Seite (nach `position` sortiert) |
| `POST` | `/api/v1/site-config/pages/{page_id}/blocks` | Block anlegen → `201`. Body `{type, content?, settings?}`; wird ans Ende positioniert |
| `PUT` | `/api/v1/site-config/blocks/{block_id}` | `content`/`settings` ändern (der `type` ist unveränderlich) |
| `POST` | `/api/v1/site-config/pages/{page_id}/blocks/reorder` | Neu ordnen: `{ordered_ids}` muss **exakt** die Block-Menge der Seite sein, sonst `400` |
| `DELETE` | `/api/v1/site-config/blocks/{block_id}` | Block löschen → `204` |
| `POST` | `/api/v1/site-config/templates/apply` | Start-Template anwenden: `{template_id}` (`bergchalet`\|`kueste`\|`stadt`) → Seitenliste; `404` unbekanntes Template |

**Block-Typen (10) + Content-Validierung:** `hero` · `rich_text` · `image` ·
`gallery` · `button` · `spacer` · `contact` · `search` · `properties_grid` ·
`featured_properties`. Der `content` wird **pro Typ** gegen ein eigenes
Pydantic-Schema validiert und normalisiert (`validate_block_content`) — Felder
außerhalb des Schemas werden verworfen, ungültiger Inhalt → `400`. Texte sind
i18n-Objekte (`{locale: text}`). `settings` sind typunabhängig
(`background_color` Hex, `padding` `none|sm|md|lg`, `full_width`, `opacity`,
`visible`, `radius`, `rotation`).

**Font-Katalog:** Die Schriftauswahl des Editors (voller Google-Fonts-Katalog)
läuft **nicht** über FastAPI, sondern über die server-seitige Next.js-Route
`/api/google-fonts` in `apps/web` (Key `GOOGLE_FONTS_API_KEY`; ohne Key → `503`).

### Öffentlicher Resolver (`/api/v1/site`, KEIN JWT)

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/site/by-domain?host=` | Host → Tenant + **öffentliches** Branding (`PublicSiteResponse`: `tenant_id`, Branding-Felder — keine Domain-/Cloudflare-Interna). Nur Domains mit `status=active`; `422` fehlender/zu kurzer Host (Query-Validierung `min_length=3`), `400` Whitespace-Host, `404` unbekannte Domain. Wird von der `builder/`-Middleware je Request aufgerufen |
| `GET` | `/api/v1/site/page?host=&slug=` | Veröffentlichte Seite + Blöcke + Branding (`PublicPageResponse`) für den Renderer. Nur `is_published`; leerer `slug` → Home-Seite; unbekannt → `404` |
| `GET` | `/api/v1/site/page/draft?page_id=&token=` | Entwurfs-Render für die Editor-Vorschau — liefert auch **unveröffentlichte** Seiten. `403` bei ungültigem/abgelaufenem Token |

**Draft-Token-Mechanik:** `POST /site-config/pages/{id}/draft-token` signiert
`tenant_id.page_id.exp` per **HMAC-SHA256** mit `SITE_DRAFT_SECRET`
(Token-Format `{exp}.{sig}`, **TTL 3600 s**); `GET /site/page/draft` verifiziert
konstant-zeitig (`hmac.compare_digest`). So kann der Editor eine Vorschau ohne
JWT rendern lassen, ohne unveröffentlichte Inhalte öffentlich zu machen.

**Frontend-Anbindung:** Server-Actions in `apps/web/lib/site-pages.ts` +
`lib/site-config.ts` (u. a. `syncBlocks()` als Diff-Orchestrator des Editors —
es gibt bewusst keinen Bulk-Endpunkt); der `builder/`-Renderer ruft den
öffentlichen Resolver über seinen eigenen Proxy (`builder/app/api/v1/[...path]/route.ts`).
