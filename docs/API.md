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

Jeder der 17 Vertical Slices stellt mindestens einen Health-Endpoint bereit:

| Slice | Health-Endpoint |
|---|---|
| auth | `GET /api/v1/auth/health` |
| buchhaltung | `GET /api/v1/buchhaltung/health` |
| properties | `GET /api/v1/properties/health` |
| rates | `GET /api/v1/rates/health` |
| calendar | `GET /api/v1/calendar/health` |
| reservations | `GET /api/v1/reservations/health` |
| guests | `GET /api/v1/guests/health` |
| inbox | `GET /api/v1/inbox/health` |
| payments | `GET /api/v1/payments/health` |
| channel_manager | `GET /api/v1/channel-manager/health` |
| booking_engine | `GET /api/v1/booking-engine/health` |
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
  "permissions": ["edit_property", "…"]   // Lodgify-Berechtigungen (UI-Gating)
}
```

`role`/`permissions` werden aus der DB gelesen (Quelle der Wahrheit, JWT kann
veraltet sein). `401` ohne/mit ungültigem Token.

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

## calendar (Kern-Logik implementiert)

Herzstück (Lastenheft §2.2). Double-Booking-Schutz über die `availability`-Tabelle.
Alle Endpoints erfordern Auth; `block`/`price-override` zusätzlich die Capability
`manage_calendar`, Leseendpoints `view_calendar`.

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/calendar/availability?property_id&start&end` | Tagesstatus im Zeitraum (fehlende Tage = offen) |
| `GET` | `/api/v1/calendar/check?property_id&start&end` | Verfügbarkeit + Konflikttage (Double-Booking-Prüfung) |
| `POST` | `/api/v1/calendar/block` | Tage sperren — `409`, wenn bereits gebucht |
| `POST` | `/api/v1/calendar/price-override` | Tagespreis setzen; `price: null` nimmt zurück |

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

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/v1/reservations?property_id` | Reservierungen des Tenants (optional je Objekt) |
| `POST` | `/api/v1/reservations` | Reservierung anlegen — `404` (fremdes Objekt), `409` (Tage belegt) |

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
| `POST /api/v1/buchhaltung/number-sequences/next` | Nächste fortlaufende Dokumentnummer (GoBD-lückenlos, `next_document_number()`, Row-Lock) |
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
| `POST` | `/api/v1/tasks/from-booking` | `manage_tasks` | aus Buchung: Anreise-Check + Endreinigung |
| `POST` | `/api/v1/tasks/checklist/item` | `view_own_tasks` | Checklisten-Punkt |
| `POST` | `/api/v1/tasks/checklist/photo` | `view_own_tasks` | Foto-Nachweis (unbegrenzt/Raum) |
| `POST` | `/api/v1/tasks/substitution` | `request_substitute` | Vertretung anfragen (§4.3) |
| `POST` | `/api/v1/tasks/inventory` | `manage_inventory` | Inventar (property_id null = zentraler Pool) |

---

## Authentifizierung allgemein

- Supabase-JWT **ES256 via JWKS** (modernes Supabase), verifiziert in `core/security.py`
  über den JWKS-Endpoint; **HS256-Fallback** gegen `SUPABASE_JWT_SECRET` für lokale/ältere Setups.
- `AuthContext` (`user_id`, `tenant_id`, `role`) wird aus den JWT-Claims gelesen.
- Geschützte Endpoints nutzen die `CurrentUser`-Dependency.

> Die übrigen Slices (properties, calendar, …) werden nach dem auth-Muster
> ausgebaut. Diese Übersicht wird dabei fortgeschrieben.
