# API-Übersicht

Base-URL (lokal): `http://localhost:8000`
Alle Slice-Endpoints liegen unter dem Prefix **`/api/v1`**.

Interaktive Doku (Swagger UI): **http://localhost:8000/docs**

## Meta-Endpoints

| Methode | Pfad      | Beschreibung |
| ------- | --------- | ------------ |
| `GET`   | `/`       | Service-Info |
| `GET`   | `/health` | App-Health   |

## Fehlerantworten

Jede Fehlerantwort trägt eine `request_id` (auch als `X-Request-Id`-Header) —
damit findet der Support den Fall im Backoffice wieder. Zentrale Handler in
`main.py`:

- **422** bei Schema-Verstoß (`RequestValidationError`, mit Feldliste) **und**
  bei einem Pfad-/Query-Wert, den Postgres nicht parsen kann (`22P02`, z. B.
  eine abgeschnittene UUID). Letzteres war früher ein 500 — ein kaputter
  Client-Wert ist aber ein Eingabefehler des Aufrufers (Wurzel 5).
- **500** nur bei echten Serverfehlern; der Client bekommt ausschließlich
  `internal_error` + `request_id`, nie Exception-Typ oder Stacktrace.

## Slices

Jeder der 26 Vertical Slices stellt mindestens einen Health-Endpoint bereit:

| Slice            | Health-Endpoint                                                              |
| ---------------- | ---------------------------------------------------------------------------- |
| auth             | `GET /api/v1/auth/health`                                                    |
| buchhaltung      | `GET /api/v1/buchhaltung/health`                                             |
| properties       | `GET /api/v1/properties/health`                                              |
| rates            | `GET /api/v1/rates/health`                                                   |
| pricing          | `GET /api/v1/pricing/health`                                                 |
| calendar         | `GET /api/v1/calendar/health`                                                |
| reservations     | `GET /api/v1/reservations/health`                                            |
| guests           | `GET /api/v1/guests/health`                                                  |
| travel_agencies  | `GET /api/v1/travel-agencies/health`                                         |
| reviews          | `GET /api/v1/reviews/health` (Bewertungs-Cockpit über alle Kanäle, s.u.)     |
| guest_reviews    | `GET /api/v1/guest-reviews/health` (myBestDays-Gast-Seite, s.u.)             |
| inbox            | `GET /api/v1/inbox/health`                                                   |
| whatsapp         | `GET /api/v1/whatsapp/health` (Meta Cloud API, s.u.)                         |
| payments         | `GET /api/v1/payments/health` (Stripe Connect + Zahlungen, s.u.)             |
| channel_manager  | `GET /api/v1/channel-manager/health` (Channex-Integration, s.u.)             |
| booking_engine   | `GET /api/v1/booking-engine/health`                                          |
| site_config      | `GET /api/v1/site-config/health` (Page-Builder, s.u.)                        |
| addons           | `GET /api/v1/addons/health`                                                  |
| owners           | `GET /api/v1/owners/health` (Eigentümer-Stammdaten + Objekt-Zuweisung, s.u.) |
| owner_statements | `GET /api/v1/owner-statements/health` (Auszahlungs-Abrechnung, s.u.)         |
| ocr              | `GET /api/v1/ocr/health`                                                     |
| public_portal    | `GET /api/v1/public-portal/health`                                           |
| tasks            | `GET /api/v1/tasks/health`                                                   |
| crm              | `GET /api/v1/crm/health`                                                     |
| dashboard        | `GET /api/v1/dashboard/health`                                               |
| content          | `GET /api/v1/content/health`                                                 |

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

| Status | Bedeutung                                        |
| ------ | ------------------------------------------------ |
| `201`  | erstellt + direkt eingeloggt                     |
| `409`  | E-Mail bereits vergeben                          |
| `500`  | Tenant/User-Anlage fehlgeschlagen (mit Rollback) |

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
  "permissions": ["edit_property", "…"], // ..-Berechtigungen (UI-Gating)
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

**Berechtigungsmodell (..):** Zwei Ebenen — die rollenbasierte
**Capability-Matrix** (intern, `permissions.py`, schützt Slice-Endpoints) und die
feingranularen **..-Berechtigungen** (43 IDs, `.._permissions.py`,
pro Nutzer in `users.permissions` JSONB). Letztere werden im Wizard zugewiesen,
per `require_.._permission(...)` an Endpoints durchgesetzt
(z. B. `PATCH /properties/{id}` → `edit_property`,
`POST /properties/{id}/image` → `pm_manage_property_images`,
`POST /calendar/block|price-override` → `edit_calendar_bookings`) und im
Frontend zum Aus-/Einblenden von Menüpunkten genutzt. Admin = immer alle.

### Konto & 2FA (Sicherheit-Seite)

Alle Endpunkte erfordern eine gültige Session (Bearer-Token). Quelle der Wahrheit
ist FastAPI; reine OAuth-Konten (Google) werden beim ersten Zugriff lazy
provisioniert (Tenant + `users`-Row).

| Methode & Pfad                           | Zweck                                                                                                                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/auth/account`               | Konto-/Profil-Übersicht (E-Mail, Name, Rolle, Telefon, Sprachen, Website, Beschreibung, Avatar, `has_password`, `totp_enabled`)                                                                                                                  |
| `GET /api/v1/auth/account/users`         | Nutzer des eigenen Tenants (für die Objekt-Kontakt-Auswahl) — `user_id`, Name, E-Mail, Rolle, Telefon, Avatar, `tenant_id`, `permissions`                                                                                                        |
| `GET /api/v1/auth/account/managed-users` | Nutzerverwaltung (Konto → Benutzer): **Admin** sieht alle Nutzer plattformweit, Owner/Co-Admin nur den eigenen Tenant; normale Benutzer (staff/cleaner) → `403`                                                                                  |
| `PATCH /api/v1/auth/account/email`       | E-Mail ändern (`{ "new_email": "…" }`)                                                                                                                                                                                                           |
| `PATCH /api/v1/auth/account/name`        | Anzeigename ändern (`{ "full_name": "…" }`)                                                                                                                                                                                                      |
| `PATCH /api/v1/auth/account/profile`     | Profil-/Kontaktdaten ändern (.. „Edit contact information"): `full_name`, `phone`, `additional_phone`, `hide_phones`, `preferred_language`, `spoken_languages`, `website`, `description`, `avatar_url` — nur gesendete Felder werden geschrieben |
| `POST /api/v1/auth/account/avatar`       | Profilbild hochladen (`multipart/form-data`, Feld `file`) → legt in den `avatars`-Bucket (`{user_id}/avatar.<ext>`) und setzt `avatar_url`. Läuft über den Service-Client, daher für beide Login-Wege nutzbar                                    |
| `PATCH /api/v1/auth/account/password`    | Passwort ändern (`{ "current_password"?, "new_password" }`)                                                                                                                                                                                      |
| `POST /api/v1/auth/totp/enroll`          | TOTP-Enrollment starten → `secret`, `otpauth_uri`, `qr_data_url`                                                                                                                                                                                 |
| `POST /api/v1/auth/totp/verify`          | Enrollment per Code bestätigen → `recovery_codes`                                                                                                                                                                                                |
| `POST /api/v1/auth/totp/disable`         | 2FA mit gültigem Code (oder Recovery) abschalten                                                                                                                                                                                                 |

Die **Profilfelder** (Telefon, Sprachen, Website, Beschreibung, Avatar) liegen
als eigene Spalten in `public.users`. Der **Objekt-Hauptkontakt** (..
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

Objekt-Verwaltung (.. „Rentals"). Alle Endpunkte erfordern eine Session
(Bearer-Token); der Tenant kommt aus dem JWT, jeder Zugriff ist tenant-scoped.

| Methode & Pfad                   | Zweck                         |
| -------------------------------- | ----------------------------- |
| `GET /api/v1/properties`         | Objekte des Tenants auflisten |
| `POST /api/v1/properties`        | Objekt anlegen → `201`        |
| `GET /api/v1/properties/{id}`    | Einzelnes Objekt              |
| `PATCH /api/v1/properties/{id}`  | Felder ändern (partiell)      |
| `DELETE /api/v1/properties/{id}` | Objekt löschen → `204`        |

Felder: `title`, `description`, `property_type`
(`ferienhaus|appartement|glamping|tiny_house|stellplatz|hausboot`), `status`
(`draft|active|inactive`), `max_guests`, strukturierte Adresse
(`street|house_number|postal_code|city|country|lat|lng`), `amenities[]`,
`photos[]`. Sektionen ohne eigene Spalte (Räume, Schlafmöglichkeiten, m²,
Einheiten) liegen flexibel in `type_attributes` (jsonb) — neue ..-Sektionen
brauchen so keine Migration.

**Richtlinien** (.. „Policies") liegen ebenfalls in `type_attributes`
unter dem Key `policies`: strukturierte `policy` (Zahlungsplan, Stornoart,
Kaution, Angebots-Gültigkeit), `bookability` (`instant|request|inquiry`),
`checkInTime`, `checkOutTime`, mehrsprachige `ratesInfo`/`rentalAgreement`
(`{de,en,da}`).

**Preise** (.. „Pricing") liegen in `type_attributes.pricing`:
`currency`, `basePrice`, `dynamicPricing`, `customByWeekday`/`weekdayPrices`,
`extraGuestCharge`, `shortStay*`, `lengthPrices[]` (Wochen-/Monats-/eigene
Längenpreise) sowie `fees[]`, `taxes[]`, `businessTaxId`, `totRegistrationId` und
`basePriceLabel`. Portal-Aufschläge stehen NICHT hier — sie sind Kanal-Pläne
(`rate_plans.portal_scope`, 0272). Aktionen liegen in `property_discounts` (0276)
und Extras im addons-Slice (`property_addons`, 0074/0075): die alten Blob-Felder
`promotions[]` und `addOns[]` waren Attrappen, die niemand las, und werden nicht
mehr gepflegt.

`lengthPrices[]` je Eintrag: `id`, `kind` (`weekly`/`monthly`/`custom`),
`minNights`, `pricePerNight`. Gespeichert ist der NACHTPREIS — die Oberfläche
lässt (wie der Branchenstandard) den GESAMTPREIS des Aufenthalts eintippen und
rechnet ihn um. Grund: die Regel heißt „ab N Nächten", ein Gesamtpreis wäre für
eine längere Buchung nicht definiert.

Diese Preise gehen an die PORTALE, nicht nur an die eigenen Strecken: ein
Wochen-/Monatspreis IST ein Längenrabatt, und Airbnb kennt ihn als
`STAYED_AT_LEAST_X_DAYS` (`channel_manager/airbnb_aktionen.py`, dieselbe
Pipeline wie eine Aktion mit Mindestaufenthalt — höherer Rabatt gewinnt um die
EINE Regel dieser Art). Airbnbs Regel ist prozentual, unser Längenpreis
absolut: der Prozentsatz wird aus dem Grundpreis des Objekts abgeleitet
(`rate_plans`, bei mehreren Plänen gibt es keinen einen Grundpreis → nicht
darstellbar) und ABWÄRTS gerundet, damit bei Airbnb nie billiger verkauft wird
als eingestellt. Bleibt 0 % übrig, wird nichts gesendet und die Zeile meldet
„Manuelle Synchronisierung". Alle anderen Portale haben kein Feld dafür und
tragen denselben Chip. Eine Änderung an `lengthPrices` reiht
`sync_airbnb_aktionen` ein (`gebuehren.laengenpreise_geaendert`) — sonst bliebe
ein gelöschter Wochenpreis bei Airbnb als Rabatt stehen.

`taxes[]` je Eintrag: `id`, `kind` (`vat` — genau EINE je Objekt, serverseitig
erzwungen — oder `local`), `mode` (`percent`/`amount`), `value`,
`includedInPrice`, `name` plus optional `names` (gastseitiger Name je Locale,
alle 24), `descriptionHtml` (beim Speichern mit `nh3`-Allowlist gesäubert). Bei
`kind=local` zusätzlich `taxType` (Airbnb-Taxonomie: `HotelTax`, `LodgingTax`,
`RoomTax`, `TourismAssessment`, `TouristTax`, `TransientOccupancyTax`,
`Unknown`); bei `mode=amount` `chargeBasis` (`SingleCharge`/`PerPerson`) ×
`period` (`PerStay`/`PerNight`) — die vier Kombinationen bilden das
Kurtaxen-Modell und gehen als Channex-`logic` (`per_booking`, `per_night`,
`per_person`, `per_person_per_night`) an die Portale (Channex-`type`:
`city_tax` mit Unterstrich — live gemessen, die Doku-Schreibweise „city tax"
wird abgelehnt); bei `mode=percent` optional `taxableBase[]` — `base_price`
und/oder Gebühren**kategorien** (`cleaning`, `linen`, `resort`, `management`,
`community`, `pet`). Alt-Datensätze trugen dort Gebühren-IDs; sie werden beim
nächsten Speichern auf ihre Kategorie gehoben. Die Grundlage wirkt NUR auf das,
was an Airbnb geht — für alle anderen Kanäle rechnen Prozent-Steuern auf den
Basispreis. Fehlen `chargeBasis`/`period` (Altbestand), gilt „einmalig pro
Nacht" — exakt das bisherige Verhalten.

`fees[]` je Eintrag: `id`, `name` (intern) plus optional `names` (gastseitiger
Name je Locale, alle 24 — wie bei der Steuer), `amount`, `mode`
(`amount`/`percent`, ohne
Angabe `amount`), `basis` (`per_stay`/`per_night`/`per_guest_stay`/
`per_guest_night`/`per_pet_stay`), `optional`, optional `taxRate` (eigener USt-Satz)
mit `taxIncluded` (Default `true` = der Satz steckt schon in `amount`; `false`
rechnet ihn obendrauf, weil jede Quote-Zeile brutto ist), `shortStayOnly`,
`descriptionHtml`, `feeType` (51 Arten, siehe `GET /properties/fee-types`) und
`portalScope[]`. Prozent ist immer einmalig auf den Zimmerpreis; `feeType`
entscheidet über die Portal-Kategorie und damit, ob und wie die Gebühr exportiert
wird (`channel_manager/ota_abgaben.py`). Zwei Kategorien sind Sonderfälle:
`short_term_cleaning` ist eine eigene Zeile der Export-Tabelle (nur Betrag, nur
einmalig pro Aufenthalt) und wird NICHT mit der Reinigungsgebühr summiert;
`security_deposit` (Kaution) geht an KEIN Portal — Channex kennt nur
`tax|fee|city_tax`, als Gebühr gesendet wäre sie ein Aufschlag ohne Rückgabe.
`basis: per_pet_stay` („pro Tier und Aufenthalt") ist nur an der Haustiergebühr
erlaubt (sonst 422) und multipliziert `reservations.pets`; ans Portal geht sie
als Pauschale pro Aufenthalt, weil kein Portal die Tierzahl vorab kennt.
`POST /pricing/quote` nimmt dafür `pets` (Default 0, max. 50) entgegen.

`shortStayOnly` erhebt die Gebühr nur bei Kurzaufenthalten. „Kurz" ist die EINE
Grenze des Objekts (`shortStayMaxNights`), keine zweite Zahl an der Gebühr — ist
sie nicht gepflegt, greift die Gebühr nicht (keine geratene Nächtezahl). An die
Portale geht sie NICHT: weder Channex-`logic` noch ein Portal kennt eine
Längenbedingung, unbedingt gesendet würde sie jedem Portal-Gast berechnet.

| Methode | Pfad | Zweck |
|---|---|---|
| `POST` | `/api/v1/properties/{id}/taxes/{tax_id}/apply` | Steuer dieses Objekts auf weitere eigene Objekte übertragen (`{property_ids: []}`, max. 200). Jede Ziel-ID einzeln tenant-gescopt → `404` bei fremder ID, kein stilles Überspringen |
| `POST` | `/api/v1/properties/{id}/fees/{fee_id}/apply` | Gebühr dieses Objekts auf weitere eigene Objekte übertragen (`{property_ids: []}`, max. 200). Währungs-Mismatch (Betragsgebühr) → `422`, eine `portalScope`-Einschränkung auf ein beim Ziel nicht verbundenes Portal → `422`, Portalliste nicht abrufbar → `503`. Alle Prüfungen laufen VOR dem ersten Schreiben, damit keine Übertragung halb durchläuft |
| `POST` | `/api/v1/properties/{id}/pricing/copy-from` | Preise (inkl. Gebühren und Steuern) von einem anderen eigenen Objekt übernehmen (`{source_property_id}`) — Branchenstandard „Preise einer bestehenden Unterkunft kopieren". Überschreibt den Preis-Block DIESES Objekts vollständig und spiegelt den Grundpreis in `rate_plans`. Übernommen werden Grundpreis + Wochentage, Aufschlag pro Gast, Kurzaufenthalt, Längenpreise, Gebühren, Steuern, Steuer-Informationen, Bezeichnung des Grundpreises; NICHT übernommen werden Aktionen (`property_discounts`, tragen objekt-eigene Codes/Zeiträume), Extras (`property_addons`, eigene Fotos/Übersetzungen) und Verfügbarkeit. Quelle UND Ziel werden einzeln tenant-gescopt → fremde Quell-ID ergibt `404`. Abweichende Währung → `422` (nie umgerechnet); hat das Ziel noch keine Währung, übernimmt es die der Quelle. Eine `portalScope`-Einschränkung auf ein hier nicht verbundenes Portal → `422`, Portalliste nicht abrufbar → `503`. Antwort: `{property_id, source_id, fees, taxes}` |
| `GET` | `/api/v1/properties/{id}/fee-library` | Bestehende Gebühren des Betriebs, übernehmbar auf DIESES Objekt (`{currency, items:[{fee, property_id, property_title}]}`). Speist „neue oder bestehende Gebühr hinzufügen". Nur Objekte derselben Währung (Prozentgebühren währungsfrei); `currency: null` = noch keine Objektwährung, dann nur Prozentgebühren. Gleiche Gebühr auf mehreren Objekten erscheint EINMAL (Bündelung über Name+Art+Rechenart+Basis+Betrag, nicht über die Kennung) |
| `GET` | `/api/v1/properties/fee-types` | Die 51 wählbaren Gebührenarten mit Bezeichnung und Portal-Kategorie (`{items:[{value,label,category}]}`). Eine Quelle für Auswahlfeld UND serverseitige Prüfung |

**Verfügbarkeit** (.. „Availability") liegt in `type_attributes.availability`:
`minStay`, `minStayByDays`, `maxStay`, sowie pro-Kanal-fähige Werte
(`preparationDays`, `bookingWindowDays`, `advanceNotice` je als
`{custom, global, channels:{direct,airbnb,booking,google}}`) und gesperrte
Wochentage (`unavailableCheckIn`/`unavailableCheckOut`).

**Compliance** (.. „Compliance") liegt in `type_attributes.compliance`:
`registrationNumbers` (komma-getrennter String, max. 100 Zeichen) — eine oder
mehrere Registrierungsnummern für die eigene Website zur Erfüllung lokaler
Vorschriften. Für Airbnb/Booking.com werden die Nummern direkt in deren
Plattform gepflegt.

**Nachrichten-Platzhalter** (.. „Messaging placeholders") liegen in
`type_attributes.messaging`: pro Block (`checkIn`, `checkOut`, `directions`,
`doorInstructions`, `rules`, `wifi`, `localGuide`, `emergency`) ein
mehrsprachiger `LocalizedText` (`{de,en,da}`). Jeder Block hat einen Shortcode
(`{{CheckinInstructions}}` …) für automatische Gästenachrichten. **Dies ist die
EINZIGE Wahrheit für Gäste-Info-Texte** — der PM-Reiter „Gästemappe" und die
WLAN-/Türzugang-Texte im PM-Reiter „Gastmodul" editieren dieselben Felder (keine
zweite Tabelle; `content_blocks` ist ungenutzt, siehe
`docs/ANALYSE-gaeste-info-gastmodul-gaestemappe.md`).

**Standort-Zusätze** (.. „Location") liegen in `type_attributes.location`
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

## property_portal (Gastmodul je Objekt — implementiert)

Strukturierte Portal-**Schalter** je Objekt (.. „Gastmodul"): `enabled`,
`self_checkin`, `door_code` (+ Anzeige-Regeln `show_code_only_if_paid`,
`hide_code_until_checkin`, `code_visible_from`), `contact_name`/`contact_phone`,
`maintenance_phone`, `header_image_path`. Tabelle `property_guest_portal`
(Migration 0121, RLS + Realtime). Die Info-**Texte** (WLAN/Türzugang) liegen
bewusst NICHT hier, sondern in `type_attributes.messaging` (eine Wahrheit).

| Methode | Pfad                                                 | Capability          | Beschreibung                                                                                                       |
| ------- | ---------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET`   | `/api/v1/property-portal/{property_id}/guest-portal` | `view_calendar`     | Gastmodul-Einstellungen; `door_code` nur mit `manage_properties` (sonst `null`), fremdes/Nicht-UUID-Objekt → `404` |
| `PUT`   | `/api/v1/property-portal/{property_id}/guest-portal` | `manage_properties` | Einstellungen upserten (ein Datensatz je Objekt)                                                                   |

---

## property_dossier (8-stufige Objektkartei — implementiert)

Objekt-Onboarding-Datenblatt (Lastenheft §6). Baut auf Bestehendem auf statt zu
duplizieren: Stufe 1 liefert den Eigentümer READ-ONLY aus `owners`+`owner_properties`
(`GET …/owner` / im `…/full`-Aggregat), Objekt-Basisfelder (`internal_house_no`,
`house_name`, `capacity_*`, `bfe_number`, `boligtype`) laufen über `PATCH /properties/{id}`
(NICHT in `_CONTENT_FIELDS` → kein OTA-Sync). Zugangscode/WLAN/Begrüßungstexte bleiben
im Gastmodul/`messaging`. Lesen `view_calendar`, Schreiben `manage_properties`. Jeder
Zugriff scopet property→tenant (fremdes/Nicht-UUID-Objekt → `404`). **i18n:** Enum-Felder
(service_type, trade, platform, boligtype, …) speichern sprachneutrale Keys; Labels leben
im next-intl-Namespace `dossier`.

Neue Tabellen (Mig. 0127/0128, alle RLS + owner-scope + Realtime): `property_process`,
`property_access`, `property_service_agreements`, `property_tradespeople`,
`property_emergency_authority`, `property_marketing`, `property_housebook`,
`property_platform_launches`. Zusätzlich `owners.cpr_number` (CPR).

| Methode                          | Pfad                                                                               | Zweck                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `GET`                            | `…/{property_id}/full`                                                             | Alle Stufen + verknüpfter Eigentümer (read-only), für Übersicht/PDF |
| `GET`                            | `…/{property_id}/owner`                                                            | Verknüpfter Eigentümer (read-only aus owners)                       |
| `GET/PUT`                        | `…/process` · `…/access` · `…/emergency-authority` · `…/marketing` · `…/housebook` | 1:1-Stufen (Upsert)                                                 |
| `GET/POST` · `PUT/DELETE …/{id}` | `…/service-agreements` · `…/tradespeople` · `…/platform-launches`                  | 1:n-Listen                                                          |

Web: `/objekte/[id]/kartei` (8-Stufen-Stepper, next-intl) mit PDF-Export.

---

## pricing (Kern-Logik implementiert — eine Preis-Wahrheit)

Zentraler Preis-Resolver (`pricing/resolver.py`): die EINZIGE Stelle, die Effektiv-
Tagespreise und Buchungs-Quotes berechnet. Kalender, Reservierungs-Wizard und
Buchungsstrecke lesen Preise ausschließlich hierüber. Leseendpoints `view_calendar`.

| Methode | Pfad                                              | Beschreibung                                                                                                                                                                                                                 |
| ------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/v1/pricing/effective?property_id&start&end` | Effektivpreis je Tag — Priorität manueller `price_overrides`(Tag) > `dynamic_prices` (Regel-Engine) > Wochentagspreis > `rate_plans.base_price`; sonst `null` (kein Fallback)                                                |
| `POST`  | `/api/v1/pricing/quote`                           | Vollständige Aufschlüsselung `{property_id, check_in, check_out, guests, channel}` → `lines[]` (Übernachtung, Markup, Gebühren, Rabatt, Steuern), `nightly_total`, `total`, `priceless`                                      |
| `GET`   | `/api/v1/pricing/overview`                        | Alle Objekte des Kontos mit DP-Status (eine Zeile je Objekt: `enabled`, `base_mode`, `base_rate_mode`, effektiver `base_rate`, `min_price`, `max_price`, `currency`) **+ `module_active`** (ist das kostenpflichtige Modul „Dynamische Preise" gebucht?) — die Dynamic-Pricing-Objekt-Tabelle. `manage_calendar` |
| `GET`   | `/api/v1/pricing/settings/{property_id}`          | Dynamic-Pricing-Einstellungen (dp_settings) eines Objekts (Defaults, falls leer). `manage_calendar`                                                                                                                          |
| `PUT`   | `/api/v1/pricing/settings/{property_id}`          | Dynamic-Pricing-Einstellungen setzen (Upsert); bei `enabled=true` sofortiger Recompute — **ohne gebuchtes Modul 402** (die Engine würde ohnehin nicht rechnen). `manage_calendar` + `edit_calendar_bookings`                  |
| `POST`  | `/api/v1/pricing/recompute`                       | Interner Cron (Header `X-Internal-Cron-Secret`): berechnet die dynamischen Preise aller Objekte mit aktiviertem DP neu (Horizont 540 Tage) + Channex-Push                                                                    |

**Dynamic Pricing (Phase 1, regelbasiert, Migration `0055`):** Eine Regel-Engine
(`pricing/engine.py`, reine Funktionen) berechnet täglich je (Objekt, Tag) einen
dynamischen Preis + Min-Stay aus multiplikativen Faktoren — **Saison**
(`season_periods`), **Event** (`event_periods`), **Wochenende**, **eigene Auslastung**,
**Lead-Time/Last-Minute**, **Orphan-Gap** (1–2-Nächte-Lücken) — geklammert auf
`[min_price, max_price]`. Ergebnis → Tabelle `dynamic_prices` (DP schreibt NIE in
`price_overrides`). Konfiguration je Objekt in `dp_settings` (opt-in, **default AUS**).
Verteilung über den vorhandenen Resolver (Kalender/Quote/Plattform lesen automatisch)

- Channex-ARI-Push (Preis in Cent + Min-Stay, run-length-kodiert). Der tägliche Lauf
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

- Nachfrage, gedeckelt auf ±`market_max_adjust_pct`; Markt-Events werden mit
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
**35-Tage-Vorschau** `/dynamic-pricing/{id}`), gespeist aus `GET /pricing/overview`.
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

**Steuern und Gebühren gehen an die Portale.** Beide werden beim Speichern
serverseitig geprüft (`properties/steuern.py` bzw. `properties/gebuehren.py`:
genau eine USt je Objekt, nh3-Allowlist für Beschreibungen, geschlossene
Enum-Listen für Steuerart/Gebührenart/Basis, keine Kanal-Einschränkung auf ein
nicht verbundenes Portal) und danach als Channex-`taxes` gespiegelt — Gebühren
mit `type: "fee"`, Steuern mit `tax`/`city_tax`. `fees[].optional` geht bewusst
NICHT ans Portal (dort nicht abwählbar). Eine Steuer/Gebühr kann per
`portalScope` auf bestimmte Portale beschränkt werden; wie sie beim jeweiligen
Portal ankommt (inklusiv, exklusiv oder gar nicht, weil das Portal sie selbst
einzieht), erkennt der Sync automatisch aus dem verbundenen Kanal — kein
Frontend-Feld. Details, Enum-Tabellen und die live gemessenen Channex-Eigenheiten:
`apps/api/src/features/channel_manager/README.md`.

### Promotions / Rabatte (`/api/v1/pricing/discounts`, Migrationen `0185` + `0276`)

Eine Promotion ist EIN Betrag plus BELIEBIG VIELE Bedingungen, die alle zutreffen
müssen (UND). Gating wie die Raten: `MANAGE_PROPERTY_SETTINGS` — Eigentümer
(read-only §4.2) und staff/cleaner sehen sie nicht. Jede Route prüft den Tenant
UND das Objekt der Zeile erneut (Wurzel 9).

| Methode  | Pfad                                                        | Beschreibung                                                                                     |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/v1/pricing/discounts/{property_id}`                   | Alle Promotions eines Objekts                                                                    |
| `GET`    | `/api/v1/pricing/discounts/{property_id}/library`            | Bestehende Promotions des Betriebs, übernehmbar auf DIESES Objekt (`{currency, items:[{promotion, property_id, property_title}]}`). Speist den Auswahlschritt „neue oder bestehende Promotion“. Pauschalen nur aus Objekten derselben Währung (Prozent währungsfrei); fachlich gleiche Promotion erscheint EINMAL; übernommen wird über `/{quell_objekt}/{promotion}/apply` |
| `POST`   | `/api/v1/pricing/discounts/{property_id}`                   | Neue Promotion → `201`                                                                           |
| `PATCH`  | `/api/v1/pricing/discounts/{property_id}/{discount_id}`     | Ändern; nur GESENDETE Felder werden gesetzt (`discount_type` ist nicht änderbar)                 |
| `DELETE` | `/api/v1/pricing/discounts/{property_id}/{discount_id}`     | Löschen → `204`                                                                                  |
| `POST`   | `/api/v1/pricing/discounts/{property_id}/{discount_id}/apply` | Dieselbe Promotion auf weitere eigene Objekte übertragen (`{property_ids:[…]}`, max. 200); fachlich gleiche Promotion wird am Ziel nicht doppelt angelegt |

**Betrag:** `discount_kind` = `percent` (dann `discount_bps`, 100 = 1,00 %, PFLICHT
— kein stiller Default) oder `fixed` (dann `discount_amount` > 0 in der Währung des
Objekts). **Bedingungen** (alle optional): `min_nights`, `lead_min_days`,
`lead_max_days`, `stay_ranges: [{from, to}]` (max. 24), `booked_from`/`booked_to`,
`promo_codes` (max. 20, je ≤ 15 Zeichen, normalisiert GROSS/getrimmt),
`portal_scope`. **Darstellung:** `name: {locale: text}`, `description_html`
(nh3-Allowlist), `photo_url`.

`discount_type` beschreibt die ART für Oberfläche und Rechnung: die drei
Kurven-Typen `length_of_stay`/`early_booker`/`last_minute` verlangen ihre Achse
(DB-CHECK) und dürfen je Objekt nur EINMAL aktiv sein (partieller UNIQUE-Index als
Idempotenz-Backstop); `promotion` und `custom` dürfen mehrfach existieren
(Sommer- und Winteraktion). Die Promotions-Oberfläche schreibt deshalb immer
`promotion`. `days_before` bleibt als EINGABE erhalten (Bestand `gastgeber`) und
wird nach Typ auf `lead_min_days`/`lead_max_days` abgebildet; in der Antwort daraus
zurückgerechnet — zwei Speicherorte gibt es nicht.

**Wie der Rabatt rechnet** (drei Festlegungen des Branchenstandards, alle live
abgelesen):

* Grundlage ist der ÜBERNACHTUNGSWERT (inkl. Kurzaufenthalts-/Extra-Gast-
  Aufschlag), NICHT Gebühren oder Steuern — „% des Gesamtwerts der Buchung
  (exkl. Gebühren, Steuern & Aktionen)“ steht wörtlich am Eingabefeld.
* Mit `stay_ranges` zählen NUR die Nächte im Zeitraum: deckt die Aktion einen
  Teil des Aufenthalts, gilt sie nur für diesen Teil. Damit rechnet die
  Buchungsstrecke dasselbe wie der Portal-Push, der schon immer je Tag rabattiert.
* Es gilt der BESTE EINZELRABATT, kein Stacking — verglichen wird die ERSPARNIS
  IN GELD, damit eine Pauschale gegen einen Prozentsatz antreten kann.
* CODE-VORRANG: ein GÜLTIGER `promo_code` verdrängt alle Aktionen ohne Code, auch
  wenn eine automatische mehr gebracht hätte („werden Aktionen ohne Code nicht
  angewendet. Stattdessen verwendet das System den Wert der Aktion, die dem
  angegebenen Code zugeordnet ist, sofern der Code gültig ist"). Bei einem
  UNGÜLTIGEN Code bleibt alles beim Normalfall.

`POST /api/v1/pricing/quote` nimmt zusätzlich `promo_code` (≤ 15 Zeichen) und
antwortet mit `promo_code_applied`: hat der Code WIRKLICH eine Aktion ausgelöst?
Dieselben zwei Felder trägt `POST /api/v1/booking-engine/quote` (Gast-Strecke:
Code eingeben → Rabattzeile) und `POST /api/v1/booking-engine/reservations`
(dieselbe Rechnung wie die Anzeige). Ohne `promo_code_applied` könnte die
Oberfläche „Code angewendet“ nicht von „Code ungültig, aber es greift eine
automatische Aktion“ unterscheiden.

**Weg zu den Portalen** (zwei, sie schließen sich nach Konstruktion aus):
1. **Tagespreis** — jedes Portal, aber nur Bedingungen, die sich am TAG
   entscheiden lassen (`stay_ranges` oder gar keine). Rechnet `ari_push`
   (`_aktionen_einrechnen`) in die gesendeten Segmente ein.
2. **Airbnbs eigene Rabattregeln** — `min_nights`/`lead_min_days`/`lead_max_days`
   als `default_pricing_rules` je Listing (`channel_manager/airbnb_aktionen.py`,
   Route `…/aktionen/airbnb-sync`). Grenzen: Prozent 1–99 (ganzzahlig),
   Last Minute ≤ 28 Tage, Frühbucher-Vorlauf ein Vielfaches von 28 oder 30,
   Längenrabatt nur im Preismodell `standard`, eine Regel = eine Schwelle.

Was keiner der beiden Wege trägt (Angebotscode, Buchungszeitraum, Pauschale,
mehrere Bedingungen zusammen), wird als „Manuelle Synchronisierung" gemeldet
(`abgaben-status`) statt still jedem Portal-Gast den Rabatt zu geben.

### Abgeleitete Preispläne (Migration `0157`, SiteMinder-Modell)

Ein Objekt kann mehrere Preispläne haben (BAR/B&B). Jeder Plan ist `manual`
(eigener Preis) oder `derived` (Preis folgt einem Basis-Plan **desselben**
Objekts): `preis = round2((parent + offset_amount) × (1 + offset_percent/100))`
— erst Betrag, dann Prozent. Beide Offsets `null` = 1:1-Spiegel.

`POST /api/v1/rates` und `PATCH /api/v1/rates/{id}` akzeptieren `rate_mode`
(`manual|derived`), `derived_from_rate_plan_id`, `offset_amount`,
`offset_percent`. Guards: Basis-Plan fremdes Objekt → 422; Basis-Plan selbst
`derived` → 422 (keine Kaskade); Basis-Plan mit Kindern löschen → 409; das Kind
erbt Währung + Basis vom Parent (keine zweite Währungs-Wahrheit). Datumspreise
auf `derived` (`PUT /rates/{id}/prices`) → 422 — Min-Stay/Restriktionen bleiben
je Plan pflegbar. `GET /api/v1/rates/grid` liefert je Plan `rate_mode`,
`derived_from_name`, die Offsets und `price_read_only` (Grid-Zellen gesperrt).

`PUT /rates/{id}/prices|min-stays|restrictions` akzeptieren optional
`weekdays: [0..6]` (Mo=0) — der Server expandiert Bereich × Wochentagsmaske
(harte Obergrenze bleibt).

Ableitung rechnet **lokal**; an Channex gehen alle Pläne als `rate_mode: manual`
mit ihrer fertigen Tageskurve (nie in zwei Systemen ableiten). Live verifiziert:
Basis 100 USD, +25 dann −15 % → 106,25 bei Channex gegengelesen.

---

## calendar (Kern-Logik implementiert)

Herzstück (Lastenheft §2.2). Double-Booking-Schutz über die `availability`-Tabelle.
Alle Endpoints erfordern Auth; `block`/`price-override`/`stop-sell` zusätzlich die
Capability `manage_calendar` (Stop-Sell-Schreibpfade außerdem die
..-Berechtigung `edit_calendar_bookings`), Leseendpoints `view_calendar`.

| Methode | Pfad                                                  | Beschreibung                                                                                                                                                                                                                                                                                                  |
| ------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/v1/calendar/availability?property_id&start&end` | Tagesstatus im Zeitraum inkl. `price` (aus dem pricing-Resolver) + `min_stay` je Tag (fehlende Tage = offen)                                                                                                                                                                                                  |
| `GET`   | `/api/v1/calendar/check?property_id&start&end`        | Verfügbarkeit + Konflikttage (Double-Booking-Prüfung)                                                                                                                                                                                                                                                         |
| `POST`  | `/api/v1/calendar/block`                              | Tage sperren — `409`, wenn bereits gebucht                                                                                                                                                                                                                                                                    |
| `POST`  | `/api/v1/calendar/price-override`                     | Tagespreis setzen; `price: null` nimmt zurück                                                                                                                                                                                                                                                                 |
| `GET`   | `/api/v1/calendar/stop-sell?property_id&start&end`    | Verkaufsstopps im Zeitraum: `items[]` je Tag mit `id`, `date`, `reason`, `source` (`manual`\|`channex`), `agency_id` + `total`. `view_calendar`                                                                                                                                                               |
| `POST`  | `/api/v1/calendar/stop-sell`                          | Verkaufsstopp setzen: `{property_id, range, reason?, weekdays?, agency_id?}` → `{stopped_days}`. `weekdays` = ISO-Wochentagsmaske (0=Mo…6=So, nur passende Tage), `agency_id` = Adressat der Stop-Sale-Meldung (`travel_agencies`, `null` = alle Kanäle). Wird als `stop_sell`-Restriction an Channex gepusht |
| `POST`  | `/api/v1/calendar/stop-sell/clear`                    | Verkaufsstopp aufheben: `{property_id, range, weekdays?}` → `{status:"ok"}`. Löscht **nur manuelle** Stopps (`source=manual`); Channex-Stopps spiegeln den OTA-Stand und bleiben unangetastet. `stop_sell=false` geht nur für Tage an Channex, die danach wirklich frei sind                                  |
| `POST`  | `/api/v1/calendar/bulk-edit`                          | Preis/Min-Stay/Sperre/Stop-Sell über mehrere Objekte × Zeitraum — `404` (fremdes Objekt)                                                                                                                                                                                                                      |

```json
// GET /check → 200
{
  "property_id": "uuid",
  "available": false,
  "conflicting_days": ["2026-05-02"]
}
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

| Methode | Pfad                                                                  | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`   | `/api/v1/reservations?property_id`                                    | Reservierungen des Tenants (optional je Objekt); inkl. `num_guests`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `GET`   | `/api/v1/reservations/dashboard`                                      | Startseiten-Kennzahlen (echte Daten, im Backend berechnet)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `GET`   | `/api/v1/reservations/stats?date_from&date_to&property_id`            | Globales Kontrollzentrum (PM-Startseite): dieselben KPIs + Sparklines + Kanal-Donuts wie der Objekt-Reiter, aber zusammengefasst über ALLE (owner-sichtbaren) Objekte. `property_id` (wiederholbar) filtert auf ausgewählte Unterkünfte; Belegungsrate durch die Objektanzahl geteilt. Ohne Zeitraum = letzte 30 Tage. Owner-scoped, Beträge maskiert                                                                                                                                                                                                                                                        |
| `GET`   | `/api/v1/reservations/stats/{metric}?date_from&date_to&property_id`   | KPI-Detailseite tenant-weit („ANSEHEN"): Tagesreihe + vier Vergleichsperioden + Breakout für EINE Kennzahl über alle (gefilterten) Objekte. Unbekannte Metrik → `422`                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `GET`   | `/api/v1/reservations/property/{id}/stats?date_from&date_to`          | Objekt-Kennzahlen (Statistiken-Reiter): Umsatz/Zahlungen/Belegung/Ø-Werte + Kanal-Verteilung + Tages-Zeitreihen je KPI (Sparkline), Vergleich zur Vorperiode; ohne Zeitraum = letzte 30 Tage. Zuordnung über Buchungsdatum (`created_at`). Owner-scoped, Beträge maskiert, Währung aus den Daten. Nicht-UUID → `404`                                                                                                                                                                                                                                                                                         |
| `GET`   | `/api/v1/reservations/property/{id}/stats/{metric}?date_from&date_to` | KPI-Detailseite (Klick auf eine Statistik-Kachel): Tagesreihe EINER Kennzahl + vier gleich lange Vergleichsperioden davor (mit %-Vergleich) + Breakout-Matrix. `metric` ∈ revenue/payments_received/hosted_guests/booked_nights/created_reservations/cancelled_reservations/cancelled_nights. Unbekannte Metrik → `422`; Geldmetrik ohne Sicht maskiert. Owner-scoped                                                                                                                                                                                                                                        |
| `GET`   | `/api/v1/reservations/{id}`                                           | Vollständige Detailansicht (Slider): Belegung, Quote, Zahlung, Policy-Zeiten, Kontakt + **Objekt-Standort** (`property_street/postal_code/city/country/lat/lng` für die Standortkarte) — maskierungskonform                                                                                                                                                                                                                                                                                                                                                                                                  |
| `GET`   | `/api/v1/reservations/{id}/timeline`                                  | Ereignis-Zeitleiste der Buchung (.. „Zeitleiste"), neueste zuerst — der **komplette Flow**: echte `reservation_events` (created — auch OTA-Import Booking/Airbnb — /moved/repriced/checked_in/checked_out/cancelled) plus synthetische Events aus allen an der Buchung hängenden Tabellen (`tasks`→task_created, `messages`→message, `payments`→payment, `reservation_addons`→addon) und den Reservierungs-Zeitstempeln. Altbuchungen ohne Log haben so sofort eine Zeitleiste; echtes Event schlägt synthetisches gleicher Art. Tenant-/owner-scoped; Beträge + Nachrichtentext im `detail` maskiert (§4.3) |
| `POST`  | `/api/v1/reservations`                                                | Reservierung anlegen — `404` (fremdes Objekt), `409` (Tage belegt)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `PATCH` | `/api/v1/reservations/{id}/move`                                      | Verschieben (Objekt/Zeitraum) oder resizen (Check-in/out) — `409` bei Doppelbuchung, eigene Alt-Tage ausgenommen. Optional `reprice=true` (protel-Upsell): berechnet den Preis fürs Ziel-Objekt neu; ohne Flag bleibt der Preis (kostenloses Upgrade). Beherbergungs-Steuersatz erbt später das Ziel-Objekt-Land (EU-27)                                                                                                                                                                                                                                                                                     |
| `POST`  | `/api/v1/reservations/{id}/cancel`                                    | Stornieren mit Pflicht-`reason` (`422` ohne) — kanal-agnostisch (Direkt/Plattform/alle Channex-OTAs), gibt Tage frei (auch an Channex zurück), Audit in `reservation_cancellation_log`. Lokal: hebt OTA-Buchung NICHT beim Portal auf                                                                                                                                                                                                                                                                                                                                                                        |

```json
// POST /reservations
{
  "property_id": "uuid",
  "check_in": "2026-05-01",
  "check_out": "2026-05-04",
  "channel": "direct",
  "source": "Telefon",
  "guests": { "adults": 2, "children": 0, "infants": 0, "pets": 0 },
  "contact": {
    "first_name": "Max",
    "last_name": "Muster",
    "email": "m@x.de",
    "phone": "",
    "country": "DE",
    "language": "Deutsch"
  },
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

| Methode | Pfad                                                        | Beschreibung                                                                                                                                                                                                     |
| ------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/v1/booking-engine/listings?q&guests&start&end&tenant` | Liste buchbarer (active) Objekte. Optional: `q` (Titel/Ort), `guests` (Kapazität), `start`/`end` (Verfügbarkeit + Effektivpreis), `tenant` (Default: alle active tenant-übergreifend)                            |
| `GET`   | `/api/v1/booking-engine/listings/{id}?start&end`            | Detail eines active Objekts (`404` wenn nicht active): Beschreibung, Fotos, Ausstattung, ungefähre Lage (gerundete lat/lng), Preis via Resolver                                                                  |
| `GET`   | `/api/v1/booking-engine/availability?property_id&start&end` | Öffentliche Tagesverfügbarkeit (buchbar/belegt)                                                                                                                                                                  |
| `POST`  | `/api/v1/booking-engine/quote`                              | Preisaufschlüsselung VOR der Buchung (`property_id`, Zeitraum, `guests`, `pets`, `addons`) — dieselbe Rechnung wie die Buchung, inkl. Gebühren und Abgaben. Antwort trägt zusätzlich `pets_allowed`/`max_guests`; Überbelegung und Tiere ohne Erlaubnis → `422` |
| `POST`  | `/api/v1/booking-engine/reservations`                       | Gastbuchung (Double-Booking-Schutz `409`, sperrt Kalender + Channex-Push). Body kann `guests`, `pets` + `addons` (Auswahl) enthalten → Zusatzleistungen werden serverseitig bepreist + als `reservation_addons` angelegt |
| `GET`   | `/api/v1/booking-engine/reservations/{id}/addons?email`     | Nach-Buchung-Sicht des Gasts: buchbare `guest_portal`-Zusatzleistungen (unter Beachtung der „wann anzeigen"-Regel) + bereits gekaufte. Verifikation über die Buchungs-E-Mail                                     |
| `POST`  | `/api/v1/booking-engine/reservations/{id}/addons`           | Nachträglicher Add-on-Kauf durch den Gast (`email` + `addons`); serverseitig bepreist, Verkaufsfläche `guest_portal`                                                                                             |

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

| Methode  | Pfad                                                     | Zweck                                                                                                                                          |
| -------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/addons/properties/{property_id}`                | Katalog eines Objekts (inkl. inaktiver)                                                                                                        |
| `POST`   | `/api/v1/addons/properties/{property_id}`                | Zusatzleistung anlegen (Name/Beschreibung i18n, Preis, Basis, optional/pflicht, `appears_in`, `available_until`)                               |
| `PATCH`  | `/api/v1/addons/{addon_id}`                              | bearbeiten                                                                                                                                     |
| `DELETE` | `/api/v1/addons/{addon_id}`                              | löschen                                                                                                                                        |
| `POST`   | `/api/v1/addons/{addon_id}/media`                        | ein Medium hochladen (multipart, JPEG/PNG/WebP, max. 5)                                                                                        |
| `GET`    | `/api/v1/addons/reservations/{reservation_id}`           | gekaufte Extras einer Reservierung (Dashboard)                                                                                                 |
| `GET`    | `/api/v1/addons/reservations/{reservation_id}/available` | aktive Katalog-Add-ons des Objekts dieser Reservierung (Schnell-Auswahl)                                                                       |
| `POST`   | `/api/v1/addons/reservations/{reservation_id}/addons`    | **Schnelltaste:** Zusatzleistung zu einer bestehenden Buchung hinzufügen — jeder Kanal, auch OTA (z. B. Booking), provisionsfrei am OTA vorbei |
| `POST`   | `/api/v1/addons/reservation-addons/{id}/mark-paid`       | manuell als bezahlt markieren (ohne Payment-Provider: „zahlbar bei Anreise")                                                                   |

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

| Methode           | Pfad                                                | Beschreibung                                                                                                                         |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`             | `/api/v1/guests?q&vip&segment&blocked&limit&offset` | Liste + Suche (Name/E-Mail/Telefon/Firma) + Filter                                                                                   |
| `POST`            | `/api/v1/guests`                                    | Gast anlegen (`name` aus first/last_name ableitbar)                                                                                  |
| `GET`             | `/api/v1/guests/{id}`                               | Detail (maskiert)                                                                                                                    |
| `PATCH`           | `/api/v1/guests/{id}`                               | Stammdaten ändern                                                                                                                    |
| `DELETE`          | `/api/v1/guests/{id}`                               | DSGVO: anonymisiert bei Reservierungsbezug, sonst Hard-Delete                                                                        |
| `GET/POST/DELETE` | `/api/v1/guests/{id}/addresses[/{aid}]`             | Adressen (1:n)                                                                                                                       |
| `GET/POST/DELETE` | `/api/v1/guests/{id}/contacts[/{cid}]`              | Kontakte (1:n)                                                                                                                       |
| `GET/POST/DELETE` | `/api/v1/guests/{id}/identity-documents[/{did}]`    | Ausweise (DSGVO; Schreiben braucht `view_guest_id_docs`)                                                                             |
| `GET/PUT`         | `/api/v1/guests/{id}/preferences`                   | Präferenzen (1:1, upsert)                                                                                                            |
| `GET/POST`        | `/api/v1/guests/{id}/consents`                      | Einwilligungen (append-only Historie)                                                                                                |
| `GET/POST/DELETE` | `/api/v1/guests/{id}/notes[/{nid}]`                 | interne Notizen                                                                                                                      |
| `GET/POST/DELETE` | `/api/v1/guests/{id}/documents[/{did}]`             | Dokumente (Storage-Referenz)                                                                                                         |
| `GET`             | `/api/v1/guests/{id}/reservations`                  | Reservierungshistorie (Join)                                                                                                         |
| `GET`             | `/api/v1/guests/{id}/threads`                       | verknüpfte Posteingang-Threads (Join)                                                                                                |
| `GET`             | `/api/v1/guests/{id}/invoices`                      | Rechnungen (Brücke guest.email → customers.email → invoices)                                                                         |
| `POST`            | `/api/v1/guests/merge`                              | Dubletten zusammenführen: Sub-Ressourcen + Reservierungen/Buchungen/WhatsApp-Konvos source→target umhängen, Quell-Gast anonymisieren |

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

| Methode    | Pfad                                                | Beschreibung                                                                                                                   |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET`      | `/api/v1/inbox?unassigned`                          | Threads des Tenants (Filter „nicht zugewiesen")                                                                                |
| `GET`      | `/api/v1/inbox/team`                                | Team-Benutzer (mögliche Bearbeiter)                                                                                            |
| `GET/POST` | `/api/v1/inbox/{id}/messages`                       | Verlauf lesen / Nachricht senden                                                                                               |
| `GET`      | `/api/v1/inbox/{id}/reservation`                    | Reservierungs-Kontext rechts                                                                                                   |
| `PUT`      | `/api/v1/inbox/{id}/flags`                          | Favorit/Notiz/Lesen/Archiv/Erinnerung                                                                                          |
| `PUT`      | `/api/v1/inbox/{id}/assign`                         | Konversation einem Benutzer zuweisen (`user_id: null` hebt auf)                                                                |
| `PUT`      | `/api/v1/inbox/{id}/guest`                          | Korrektur: Thread einem Gast zuordnen (`guest_id`); `null` → Gast aus Thread anlegen (Resolver). Braucht `inbox_manage_config` |
| `POST`     | `/api/v1/inbox/{id}/notes`                          | Interne Notiz (gelb im Verlauf, `sender="note"`)                                                                               |
| `GET/POST` | `/api/v1/inbox/{id}/scheduled`                      | Geplante Nachrichten auflisten / planen (`send_at` ISO)                                                                        |
| `DELETE`   | `/api/v1/inbox/scheduled/{sid}`                     | Geplante Nachricht abbrechen                                                                                                   |
| `POST`     | `/api/v1/inbox/bulk-update`                         | Massenaktion: `{action: read\|archived, before: YYYY-MM-DD}`                                                                   |
| `POST`     | `/api/v1/inbox/{id}/ai-reply`                       | KI-Antwortvorschlag (Groq)                                                                                                     |
| `…`        | `/api/v1/inbox/templates\|ai-settings\|automations` | Vorlagen / KI-Einstellungen / Automatisierungen                                                                                |
| `GET`      | `/api/v1/inbox/fields`                              | Katalog der Platzhalter (22 Felder, Gruppen guest/reservation/property/company) für den Feld-Picker                            |
| `POST`     | `/api/v1/inbox/{id}/render`                         | Platzhalter gegen diesen Thread auflösen (Editor-Vorschau); fehlender Wert → 422 mit Feldliste, nie ein Ersatzwert             |
| `GET/POST` | `/api/v1/inbox/{id}/attachments`                    | Anhänge auflisten / hochladen (multipart, `?filename=&message=`). Typ per Magic Bytes, max. 10 MB, privater Bucket + signierte URL |
| `DELETE`   | `/api/v1/inbox/attachments/{aid}`                   | Anhang löschen (Storage + Zeile)                                                                                               |
| `GET/POST` | `/api/v1/inbox/knowledge`                           | Wissensdatenbank der KI-Antwort: Fakten auflisten (`?property_id`) / anlegen                                                   |
| `PUT/DELETE` | `/api/v1/inbox/knowledge/{fid}`                   | Fakt ändern / löschen                                                                                                          |

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
**Migration 0257:** `message_automation` bekommt den Auslöser `message_received`
(+ CHECK auf `trigger`) sowie `only_first_message`, `window_days smallint[]`,
`window_from`/`window_to` — die Abwesenheitsantwort außerhalb der Bürozeiten.
**Migration 0258:** `properties.timezone` (IANA, per Trigger gegen
`pg_timezone_names` geprüft — ein CHECK kann keine Unterabfrage enthalten) +
`message_automation.use_property_timezone`: `send_time` gilt dann als Ortszeit
des Objekts. Fehlt die Zeitzone, wird die Planung übersprungen und geloggt.
**Migration 0259/0260 (Wurzel 6):** `inbox_attachment` und
`inbox_knowledge_fact` sind für `anon`/`authenticated` komplett gesperrt
(`revoke all` + `as restrictive for all using (false)`) — sie enthalten
Dokumente bzw. Zugangsdaten. Kein Realtime-Abo darauf.

**Posteingang-Berechtigungen (..-Permissions, `users.permissions`):**
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

| Methode | Pfad                                           | Beschreibung                                                    |
| ------- | ---------------------------------------------- | --------------------------------------------------------------- |
| `GET`   | `/api/v1/whatsapp/status`                      | Konfig-Status (white-label, kein Token): konfiguriert / Sandbox |
| `GET`   | `/api/v1/whatsapp/conversations`               | Konversationen des Tenants                                      |
| `GET`   | `/api/v1/whatsapp/conversations/{id}/messages` | Verlauf (markiert als gelesen)                                  |
| `POST`  | `/api/v1/whatsapp/send`                        | Senden: `{conversation_id?\|to_phone?, body}`                   |

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
ist **Custom** (voll white-label, kein Stripe-Branding/-Onboarding).

Geldfluss: Der Gast zahlt immer über den Plattform-Account. Wann der Betrieb das
Geld bekommt, steuert `STRIPE_SEPARATE_TRANSFERS`:

- **aus (Default):** Destination Charge — `transfer_data.destination` reicht
  sofort weiter. Der Auszahlungslauf (`features/payouts`) ist dann gesperrt.
- **an (Ziel):** Separate Charge — der Betrag bleibt auf dem Plattform-Saldo und
  wird nach dem Checkout per Transfer freigegeben (`transfer_group`).

Der KANAL (`reservations.channel`) entscheidet über Provision und Haftung —
nicht der Kontotyp (Preisliste §1: „Ein Tarif für alle"):

| Kanal | Provision | Charge | Haftung |
|---|---|---|---|
| `portal` | 8 % all-in | über die Plattform | myBestDays |
| `direct` | 0 % | Direct Charge (`Stripe-Account`) | Betrieb |
| OTA | 0 % am Charge (1 % monatlich) | kein Charge (409) | — |

Bei den Plattform-Charges ist `on_behalf_of` der Betrieb (Settlement-Währung und
Kartenabrechnung bleiben seine); bei Direct Charges ergibt sich das von selbst.

**0% Buchungsgebühr (ADR-0006):** Auf PMS-/Direktbuchungen der Vermieter erhebt
myNextDays **keine** Provision — `STRIPE_PLATFORM_FEE_PCT` ist 0. Eine Provision
(`application_fee_amount`) ist nur für den eigenen Marktplatz (Portal-Buchungen,
Phase 2) vorgesehen.

**OTA-Gate (nur eigene Kanäle):** Ein PaymentIntent (Buchung **und** Kaution) wird
**nur** für eigene Kanäle erzeugt — `channel` ∈ {`direct`, `portal`} **ohne**
`source_channex_booking_id`. OTA-Buchungen (`booking`/`airbnb`/`vrbo`/`ota_other` oder über
Channex importiert) kassiert die OTA selbst und zahlt den Vermieter direkt aus →
`booking/.../intent` und `deposit/.../hold` antworten dafür mit **409** (keine
doppelte Belastung). Add-ons/Upsells am OTA vorbei sind separat (addons-Slice).

| Methode | Pfad                                               | Zugriff                                              |
| ------- | -------------------------------------------------- | ---------------------------------------------------- |
| `POST`  | `/api/v1/payments/connect/accounts`                | MANAGE_BILLING — Custom-Account anlegen              |
| `GET`   | `/api/v1/payments/connect/accounts/{id}`           | MANAGE_BILLING — KYC-Status + Requirements           |
| `PATCH` | `/api/v1/payments/connect/accounts/{id}`           | MANAGE_BILLING — Geschäfts-/Inhaberdaten (eigene UI) |
| `PUT`   | `/api/v1/payments/connect/accounts/{id}/bank`      | MANAGE_BILLING — Auszahlungs-IBAN                    |
| `POST`  | `/api/v1/payments/booking/{reservation_id}/intent` | **public** (Gast) — PaymentIntent, `{client_secret}` |
| `POST`  | `/api/v1/payments/deposit/{reservation_id}/hold`   | MANAGE_BILLING — Kaution vorautorisieren             |
| `POST`  | `/api/v1/payments/deposit/{payment_id}/capture`    | MANAGE_BILLING — Kaution einziehen (Schaden)         |
| `POST`  | `/api/v1/payments/deposit/{payment_id}/release`    | MANAGE_BILLING — Kaution freigeben                   |
| `POST`  | `/api/v1/payments/{payment_id}/refund`             | MANAGE_BILLING — (Teil-)Erstattung                   |
| `POST`  | `/api/v1/payments/webhook`                         | Stripe-Signatur (kein JWT)                           |

**Kaution** = manual-capture PaymentIntent über `properties.deposit_amount`.
**Webhook** (idempotent über `stripe_webhook_event`): `account.updated` →
`tenant_billing_profile`; `payment_intent.succeeded|payment_failed|
amount_capturable_updated` + `charge.refunded` → `payments.status` +
`reservations.payment_status` (Enum `unpaid|pending|paid|refunded|deposit_held`).

**Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`,
`STRIPE_PLATFORM_FEE_PCT` (veraltet, ohne Wirkung — die Provision kommt aus
`tenants.platform_fee_bps`). Der Publishable Key ist KEINE Frontend-Variable: die
Gast-Strecke bekommt ihn zusammen mit dem `client_secret` aus der Intent-Antwort
(`publishable_key`), damit Test- und Live-Modus nie auseinanderlaufen können —
ein `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` existiert in keiner App und wäre eine
zweite, unabhängig veraltende Wahrheit.

**Test → Live:** eigene Checkliste in
`apps/api/src/features/payments/README.md` (Konto aktivieren, Connect
freischalten, alte Kennungen zurücksetzen, Preise live anlegen, Webhook + Secret,
Env, Prüflauf). Werkzeuge: `deploy/billing/stripe_live_check.py` (liest nur,
prüft Konto/Webhook-Events/Preise/DB-Kennungen gegen den gesetzten Modus) und
`deploy/billing/stripe_mode_reset.py` (nimmt Test-Kennungen aus der DB).

**Offen:** Owner→Owner-Stripe-Transfer, Revolut-Adapter.

---

## buchhaltung (Rechnungen + Kunden implementiert)

Aus Taskilo übernommen, auf das NextDays-Mandantenkonzept vereinheitlicht
(`tenant_id` statt `company_id`). Tenant-scoped; schreibende Endpoints erfordern
die ..-Berechtigung `owner_reporting`. Beträge werden serverseitig aus den
Positionen berechnet (Decimal, kaufmännisch gerundet) — der Client kann sie nicht
fälschen. GoBD-gesperrte Rechnungen (`is_locked`) sind nicht mehr änderbar/löschbar.

| Methode & Pfad                                             | Zweck                                                                                                                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/buchhaltung/customers`                        | Kunden/Lieferanten des Tenants                                                                                                                                                                                      |
| `POST /api/v1/buchhaltung/customers`                       | Kunde anlegen → `201`                                                                                                                                                                                               |
| `PATCH /api/v1/buchhaltung/customers/{id}`                 | Kunde ändern                                                                                                                                                                                                        |
| `DELETE /api/v1/buchhaltung/customers/{id}`                | Kunde (soft) löschen → `204`                                                                                                                                                                                        |
| `GET /api/v1/buchhaltung/invoices`                         | Rechnungen (schlanke Liste)                                                                                                                                                                                         |
| `GET /api/v1/buchhaltung/invoices/company/{id}`            | Rechnungen im `InvoiceData`-Format (für den übernommenen Bestand)                                                                                                                                                   |
| `GET /api/v1/buchhaltung/invoices/{id}`                    | Einzelne Rechnung inkl. Positionen                                                                                                                                                                                  |
| `POST /api/v1/buchhaltung/invoices`                        | Rechnung anlegen — nimmt das reiche camelCase-Payload der Erstellen-Seite, Beträge serverseitig → `201`                                                                                                             |
| `PATCH /api/v1/buchhaltung/invoices/{id}`                  | Rechnung ändern / E-Rechnung-XML nachtragen (`409` wenn GoBD-gesperrt)                                                                                                                                              |
| `DELETE /api/v1/buchhaltung/invoices/{id}`                 | Rechnung (soft) löschen (`409` wenn gesperrt)                                                                                                                                                                       |
| `GET /api/v1/buchhaltung/number-sequences/{company_id}`    | Vorschau der nächsten Nummer (nicht-inkrementierend). Die echte GoBD-Nummer wird nur beim Speichern eines Belegs gezogen — es gibt bewusst keinen inkrementierenden Endpunkt, der eine Nummer ohne Beleg verbrennt. |
| `GET /api/v1/buchhaltung/companies/{id}`                   | Firmen-/Rechnungsprofil des Tenants (`tenant_billing_profile`)                                                                                                                                                      |
| `PATCH /api/v1/buchhaltung/companies/{id}`                 | Firmenprofil anlegen/ändern (Upsert)                                                                                                                                                                                |
| `GET /api/v1/buchhaltung/companies/{id}/transaction-links` | Beleg↔Bank-Verknüpfungen (Stub → leer, Bankabgleich folgt)                                                                                                                                                          |
| `GET /api/v1/buchhaltung/booking-accounts/{id}`            | Kontenplan (Stub → leer, Modul folgt)                                                                                                                                                                               |
| `POST /api/v1/buchhaltung/inline-invoice-services`         | Service-Usage-Tracking (No-Op, Analytics folgt)                                                                                                                                                                     |

**Frontend-Anbindung (übernommener Bestand):** Die Bestands-Komponenten rufen
`/api/v1/invoices…`, `/customers`, `/companies` etc. auf dem **eigenen Origin** auf.
Ein Next.js-Proxy (`apps/web/app/api/v1/[...path]/route.ts`) injiziert server-seitig
das Session-Token (`currentToken()`) und leitet an FastAPI weiter; der api-client
mappt die Pfade auf den `buchhaltung`-Slice. Damit bleibt der Bestand 1:1 und nutzt
die echte NextDays-Session.

```json
// POST /buchhaltung/invoices
{
  "customer_id": null,
  "currency": "EUR",
  "notes": "…",
  "items": [
    {
      "description": "Reinigung",
      "quantity": "2",
      "unit_price": "100",
      "tax_rate": "19"
    }
  ]
}
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
429-Backoff). Tenant-scoped; verwaltende Endpoints erfordern die ..-
Berechtigung `manage_property_settings`. Beträge laufen durchgängig in **Cent**
(eindeutig, keine Rundungsfehler).

| Methode & Pfad                                                     | Zweck                                                                                           |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `GET /api/v1/channel-manager/health`                               | Slice-Status + `channex_configured` (API-Key gesetzt?)                                          |
| `GET /api/v1/channel-manager/properties`                           | Property-Mappings des Tenants                                                                   |
| `POST /api/v1/channel-manager/properties`                          | Property mit Channex verbinden (bestehende anbinden **oder** neu anlegen) → `201`               |
| `DELETE /api/v1/channel-manager/properties/{map_id}`               | Mapping (soft) trennen → `204`                                                                  |
| `POST /api/v1/channel-manager/ari`                                 | Verfügbarkeit + Preise/Restriktionen gebündelt pushen (Channex-ARI)                             |
| `GET /api/v1/channel-manager/bookings`                             | Eingegangene OTA-Buchungen des Tenants                                                          |
| `POST /api/v1/channel-manager/bookings/sync`                       | Buchungs-Revisions-Feed ziehen → speichern → bei Channex bestätigen (ack)                       |
| `GET /api/v1/channel-manager/portals`                              | Verbindbare Buchungsportale + Eingabefelder (white-label; Felder live aus dem Provider-Katalog) |
| `POST /api/v1/channel-manager/channels/prepare`                    | Schritt 1+2: Zugangsdaten prüfen + Portal-Zimmer/Raten holen (legt nichts an)                   |
| `GET /api/v1/channel-manager/channels`                             | Verbundene Kanäle des Tenants (white-label)                                                     |
| `POST /api/v1/channel-manager/channels`                            | Schritt 3+4: Kanal mit Zimmer/Raten-Zuordnung anlegen **und aktivieren** → `201`                |
| `DELETE /api/v1/channel-manager/channels/{channel_id}`             | Kanal trennen (erst deaktivieren, dann löschen) → `204`                                         |
| `GET /api/v1/channel-manager/properties/{property_id}/connections` | Gespeicherte OTA-Verbindungen eines Objekts (Hotel-ID + Status pro Portal, white-label)         |
| `GET /api/v1/channel-manager/properties/{property_id}/abgaben-status` | Je Gebühr/Steuer: welche verbundenen Portale bekommen sie NICHT automatisch? Speist den Chip „Manuelle Synchronisierung". Rein lesend, gerechnet aus derselben Quelle wie der Sync (`ota_abgaben.abgaben_je_portal`) — kein zweiter Regelsatz für die Anzeige. Drei getrennte Felder je Posten: `manual_portals` (Portal nimmt ihn nicht → Chip), `restricted_portals` (per `portalScope` ausgeschlossen → Absicht), `internal_only` (optionale/Kurzaufenthalts-Gebühr, Kaution → geht bewusst nirgends hin). `currency_missing` ist ein Befund über das OBJEKT: ohne Objektwährung überträgt der Abgaben-Sync gar nichts. Die Antwort enthält zusätzlich die PROMOTIONS des Objekts (`kind: "promotion"`, `key` = Promotion-ID) mit zwei getrennten Gründen: `reason` = warum der Tagespreis sie nicht tragen kann (gilt für alle Portale außer Airbnb), `airbnb_reason` = warum Airbnb sie auch nicht über die eigene Rabattregel bekommt. Zusätzlich kommen die PREIS-BLÖCKE der Seite (`kind: "block"`) mit festen Schlüsseln — `base_price` und `extra_guest` gehen an jeden verbundenen Kanal (ARI-Push bzw. `per_person`-Rate-Plan), `short_stay` und `addons` sind `internal_only` (kein Portal hat ein Feld dafür). `length_prices` ist der Weg-Befund für die Preise nach Aufenthaltsdauer: sie gehen als Airbnb-Rabattregel raus, alle anderen Portale stehen in `manual_portals`. Zusätzlich kommt JEDER Aufenthaltsdauer-Preis als eigener Posten (`kind: "length_price"`, `key` = seine Kennung) mit `reason`/`airbnb_reason` — der aus dem Grundpreis abgeleitete Prozentsatz kann beim Abrunden auf 0 landen, dann geht auch zu Airbnb nichts. Sie speisen die Editor-Kopfzeile „Gilt für · Nicht unterstützt von" — ein Schlüssel je Block, nicht je Zeile, damit auch ein noch nicht gespeicherter Posten seine Reichweite kennt |
| `POST /api/v1/channel-manager/properties/{property_id}/aktionen/airbnb-sync` | Promotions mit Bedingung als Airbnbs eigene Rabattregeln durchsetzen (`default_pricing_rules` je Listing-Mapping). Antwort: `{channel_id, listings, updated, rules[], skipped{}}` — `updated` zählt nur Listings mit echter Änderung (idempotent), `skipped` nennt je Promotion den Grund, warum Airbnb sie nicht als Regel nimmt. Läuft zusätzlich als Job `sync_airbnb_aktionen` nach jeder Promotion-Änderung |
| `PUT /api/v1/channel-manager/properties/{property_id}/connections/{portal}/airbnb-tax` | Airbnb-Steuererhebung dieses Inserats: `{scenario, acknowledged, send_user_taxes}`. Steuern gehen an Airbnb NUR wenn Szenario ≠ `ineligible` UND beide Schalter an (fail-closed); stößt den Steuer-Sync an |
| `GET /api/v1/channel-manager/properties/{property_id}/airbnb/historie/plan?von&bis` | Wie viele Etappen ergibt dieser Zeitraum? Rein rechnerisch, KEIN Aufruf bei Airbnb — damit der Dialog sofort „das werden 27 Etappen" sagen kann, während der Betrieb noch am Datum dreht. Zeitraum > 30 Jahre oder Ende vor Start → `422` |
| `GET /api/v1/channel-manager/properties/{property_id}/airbnb/historie/vorschau?von&bis` | Was liegt im Zeitraum bei Airbnb? Liest nur, schreibt nichts. Antwort: `{gefunden, mit_nachrichten, fremde, jahre{}, etappen[], vollstaendig}` — `jahre` speist die Verteilungstabelle vor dem Import, `fremde` zählt Buchungen ANDERER Inserate desselben Kontos (werden nicht angefasst) |
| `POST /api/v1/channel-manager/properties/{property_id}/airbnb/historie/etappe?von&bis&nummer&uebernehmen` | GENAU EINE Etappe fahren — der Weg für einen sichtbaren Fortschritt. Der Gesamt-Import läuft über eine Minute; als ein Request bliebe die Oberfläche stumm, hier holt sie Etappe für Etappe und zeigt jede Zeile sofort. Body `{bekannt: [Bestätigungscodes der vorherigen Etappen]}` — die Etappen überlappen vierfach, ohne diese Liste zählte dieselbe Buchung mehrfach als „neu" (auf die Wirkung hat sie keinen Einfluss, geschrieben wird idempotent). `uebernehmen=false` = Vorschau, schreibt nichts. Antwort: `{nummer, gesamt, von, bis, gefunden, neu, codes[], jahre{}, angelegt, aktualisiert, uebersprungen, fehler}` |
| `POST /api/v1/channel-manager/properties/{property_id}/airbnb/historie/import?von&bis` | Buchungshistorie DIESES Objekts holen und übernehmen (Reservierung + Gast + Kalendernächte). Gefiltert auf `properties.airbnb_listing_id`; idempotent über den Bestätigungscode. Antwort ergänzt `{gelesen, angelegt, aktualisiert, uebersprungen, gruende[], fehlgeschlagene_etappen[]}`. **`vollstaendig: false` heißt: mindestens eine Etappe ist gescheitert, es FEHLEN Buchungen — der Lauf ist zu wiederholen** (kein „fertig" ohne Deckung). Vergangene Buchungen kommen OHNE rückwirkende Provisions-/Auszahlungsbuchung; fehlt dem Objekt die Währung → `422` statt geratenem Betrag |
| `POST /api/v1/channel-manager/webhook`                             | Webhook-Empfang (ohne JWT, via geteiltem Secret-Header `X-Channex-Webhook-Secret`)              |

**ARI-Push (Best-Practice: batchen, nicht einzeln).** Availability und Preise
werden getrennt zu Channex gesendet (Channex priorisiert die Availability-Queue).
Rate-Limits: 20 ARI/Min pro Property (je 10 Availability/Restrictions) → der Client
fängt `429` mit Backoff ab.

```json
// POST /channel-manager/ari
{
  "availability": [
    {
      "room_type_map_id": "…",
      "date_from": "2026-07-01",
      "date_to": "2026-07-31",
      "availability": 5
    }
  ],
  "rates": [
    {
      "rate_plan_map_id": "…",
      "date_from": "2026-07-01",
      "date_to": "2026-07-31",
      "rate_cents": 12000,
      "min_stay_arrival": 2,
      "stop_sell": false
    }
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
   - Währung). Pflicht, BEVOR Objekt/Anbindung möglich sind.
3. **Objekt anlegen** (`POST /properties`) → löst den **Content-Sync** aus: Provider-
   Property (in der Tenant-Group) + **ein synthetischer Room-Type** (`count_of_rooms=1`)
   - je lokalem Preisplan **ein Rate-Plan** werden angelegt; alle Mapping-Tabellen
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

| Methode | Pfad                        | Beschreibung                    |
| ------- | --------------------------- | ------------------------------- |
| `POST`  | `/api/v1/content/translate` | Text/HTML übersetzen (da/en/de) |

```json
// POST /content/translate
{ "text": "<p>Willkommen …</p>", "target": "en", "source": "de", "fmt": "html" }
// → 200
{ "text": "<p>Welcome …</p>", "detected_source": "de" }
```

`source` ist optional (auto-Erkennung). `fmt` ist `html` (Rich-Text) oder
`text`. Fehlt der Key → `503`; API-/Netzwerkfehler → `502`.

---

## tasks (Logik implementiert — Lastenheft §2.5/§4.3 + PM-Aufgaben-Modul)

Aufgaben, Checklisten mit Foto-Nachweisen, Vertretung, Inventar sowie das
PM-Aufgaben-Modul (..-Nachbau): Kalender-Timeline, Teamaufgaben,
Inspektions-Workflow und Regeln/Vorlagen (`task_rules` mit `kind` =
`template|auto|recurring`). Auf dem bestehenden schlanken Datenmodell (0012/0019)
aufgesetzt, ergänzt durch Migration 0123 (Inspektion + PM-Metadaten + Realtime).

| Methode  | Pfad                                | Capability           | Beschreibung                                                                                                                  |
| -------- | ----------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/v1/tasks`                     | `manage_tasks`       | Aufgabe anlegen                                                                                                               |
| `GET`    | `/api/v1/tasks/mine`                | `view_own_tasks`     | eigene Aufgaben                                                                                                               |
| `GET`    | `/api/v1/tasks/by-reservation/{id}` | `view_calendar`      | Aufgaben zu einer Buchung (PM-Detailseite)                                                                                    |
| `PATCH`  | `/api/v1/tasks/{id}/status`         | `manage_tasks`       | Aufgaben-Status setzen (offen/in Arbeit/erledigt/abgebrochen)                                                                 |
| `POST`   | `/api/v1/tasks/from-booking`        | `manage_tasks`       | aus Buchung: Anreise-Check + Endreinigung                                                                                     |
| `POST`   | `/api/v1/tasks/checklist/item`      | `view_own_tasks`     | Checklisten-Punkt                                                                                                             |
| `POST`   | `/api/v1/tasks/checklist/photo`     | `view_own_tasks`     | Foto-Nachweis (unbegrenzt/Raum)                                                                                               |
| `POST`   | `/api/v1/tasks/substitution`        | `request_substitute` | Vertretung anfragen (§4.3)                                                                                                    |
| `POST`   | `/api/v1/tasks/inventory`           | `manage_inventory`   | Inventar (property_id null = zentraler Pool)                                                                                  |
| `GET`    | `/api/v1/tasks/team`                | `manage_tasks`       | Teamaufgaben (Assignee + Objekt-Namen; `status_bucket`-Filter). KEINE Gast-PII/Beträge (§4.3)                                 |
| `GET`    | `/api/v1/tasks/calendar`            | `manage_tasks`       | Kalender-Timeline (`month_from`/`month_to`), nach Objekt gruppiert                                                            |
| `GET`    | `/api/v1/tasks/detail/{id}`         | `view_own_tasks`     | Aufgaben-Detail inkl. Checkliste + Foto-Status                                                                                |
| `POST`   | `/api/v1/tasks/{id}/complete`       | `view_own_tasks`     | Abschließen — 422, wenn ein `requires_photo`-Punkt kein Foto hat; setzt bei `needs_inspection` → `inspection_state=to_review` |
| `GET`    | `/api/v1/tasks/inspection`          | `manage_tasks`       | Inspektions-Liste (`tab` = to_review\|upcoming\|reviewed)                                                                     |
| `POST`   | `/api/v1/tasks/{id}/inspect`        | `manage_tasks`       | Freigeben (reviewed) / Zurückweisen (open + to_review)                                                                        |
| `GET`    | `/api/v1/tasks/templates`           | `manage_tasks`       | Aufgabenvorlagen (task_rules kind=template)                                                                                   |
| `GET`    | `/api/v1/tasks/auto`                | `manage_tasks`       | Planmäßige Aufgaben (buchungs-getriggert)                                                                                     |
| `GET`    | `/api/v1/tasks/recurring`           | `manage_tasks`       | Regelmäßige Aufgaben (zeitplan-getriggert, menschenlesbares `schedule_label`)                                                 |
| `GET`    | `/api/v1/tasks/rules/{id}`          | `manage_tasks`       | Regel/Vorlage-Detail (Items + Objekt-Zuordnung)                                                                               |
| `POST`   | `/api/v1/tasks/rules`               | `manage_tasks`       | Regel/Vorlage anlegen                                                                                                         |
| `PUT`    | `/api/v1/tasks/rules/{id}`          | `manage_tasks`       | Regel/Vorlage ändern (Objekte + Items als Alt/Neu-Diff)                                                                       |
| `DELETE` | `/api/v1/tasks/rules/{id}`          | `manage_tasks`       | Regel/Vorlage löschen                                                                                                         |

Frontend: `(dashboard)/reservierungen/aufgaben/*` — 7 Reiter (Kalender,
Meine, Team, Inspektion, Vorlagen, Planmäßig, Regelmäßig), alle live über
`useRealtime` (`tasks`, `task_rules`).

---

## media (Bilder-Modul — implementiert)

Aggregiert Foto-Nachweise aus mehreren Quellen zu einer tenant-scoped Liste:
**Objektfotos** (`property_photos`, public Bucket `property-images`, URL fertig)
und **Buchungs-/Aufgabenfotos** (`checklist_photos`, privater Bucket
`task-photos` → signierte URL, verknüpft über item→task→reservation/property).
Zahlungsbilder existieren im Datenmodell NICHT und werden nicht erfunden
(CLAUDE.md Wurzel 4). Bucket ist privat (fail-closed: ohne Backend-Signatur kein
Zugriff); `checklist_photos` in Realtime (RLS via item→task→tenant, 0126).

| Methode  | Pfad                        | Capability      | Beschreibung                                                                                                                |
| -------- | --------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/media`             | `view_calendar` | Bilder-Karten; Query `booking`/`property_` (Quellen-Toggle), `property_id` (Objektfilter). Signierte URLs für Buchungsfotos |
| `DELETE` | `/api/v1/media/{kind}/{id}` | `manage_tasks`  | Bild löschen (`kind` = booking\|property), IDOR-Guard über die Eltern-Kette                                                 |

Frontend: `(dashboard)/reservierungen/bilder` — Karten (Objekt-Titel, Typ,
Autor, Hochgeladen am, Buchungszeitraum, Unterkunft/Buchung ansehen, Löschen),
Toggles Buchungsbilder/Objektfotos, live über `useRealtime` (`property_photos`,
`checklist_photos`). Migration 0126: Bucket `task-photos` + Realtime.
**Offen:** echter Foto-Upload-Flow beim Task-Abschluss (Multipart →
`task-photos`) — aktuell 0 Buchungsfotos, Modul zeigt die Objektfotos.

---

## owners (Eigentümer-Stammdaten — implementiert)

Eigentümer (Lead → Vermieter) + Objekt-Zuweisung mit Anteil und Provisions-
Override je Objekt (Basis für den Eigentümer-Objekt-Scope, Lastenheft §4.2).
Tenant-geschützt (`MANAGE_OWNERS`).

| Methode  | Pfad                                                 | Beschreibung                                   |
| -------- | ---------------------------------------------------- | ---------------------------------------------- |
| `GET`    | `/api/v1/owners`                                     | Eigentümer-Liste                               |
| `POST`   | `/api/v1/owners`                                     | Eigentümer anlegen                             |
| `GET`    | `/api/v1/owners/{owner_id}`                          | Eigentümer-Detail                              |
| `PATCH`  | `/api/v1/owners/{owner_id}`                          | Eigentümer aktualisieren                       |
| `DELETE` | `/api/v1/owners/{owner_id}`                          | Eigentümer löschen                             |
| `POST`   | `/api/v1/owners/{owner_id}/properties`               | Objekt zuweisen (Anteil + Provisions-Override) |
| `DELETE` | `/api/v1/owners/{owner_id}/properties/{property_id}` | Zuweisung aufheben                             |

---

## owner_statements (Auszahlungs-Abrechnung — implementiert)

Rechnerische Eigentümer-Abrechnung je Zeitraum: Buchungssatz
`(total_amount − channel_fee) × (1 − Provision)` je Reservierung (Provisionssatz
des Objekts), EU-Steuer-Kategorien (S / AE Reverse-Charge / E Kleinunternehmer),
GoBD-Nummernkreis, Stornorechnung statt Löschen, Mehrwährung via ECB-Tageskurs
am Check-out (kein Fallback → 502). Reporting-/Billing-geschützt.

| Methode  | Pfad                                     | Beschreibung                         |
| -------- | ---------------------------------------- | ------------------------------------ |
| `GET`    | `/api/v1/owner-statements`               | Abrechnungen auflisten               |
| `POST`   | `/api/v1/owner-statements`               | Abrechnung erzeugen (Zeitraum)       |
| `POST`   | `/api/v1/owner-statements/preview`       | Vorschau ohne Persistenz             |
| `GET`    | `/api/v1/owner-statements/{id}`          | Detail (eingefrorene Summen)         |
| `PATCH`  | `/api/v1/owner-statements/{id}`          | Entwurf bearbeiten                   |
| `POST`   | `/api/v1/owner-statements/{id}/finalize` | Finalisieren (Nummernkreis)          |
| `POST`   | `/api/v1/owner-statements/{id}/cancel`   | Stornieren (Stornorechnung)          |
| `DELETE` | `/api/v1/owner-statements/{id}`          | Entwurf löschen                      |
| `POST`   | `/api/v1/owner-statements/expenses`      | Eigentümer-Ausgabe anlegen           |
| `PATCH`  | `/api/v1/owner-statements/expenses/{id}` | Ausgabe ändern                       |
| `DELETE` | `/api/v1/owner-statements/expenses/{id}` | Ausgabe löschen                      |
| `POST`   | `/api/v1/owner-statements/auto-run`      | Periodische Auto-Abrechnung auslösen |

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

## reviews — Bewertungs-Cockpit des Betriebs (myNextDays)

EINE Liste über ALLE Kanäle: die eigenen Marktplatz-Bewertungen aus
`public.reviews` (myBestDays, Skala 1..5) und die Portal-Bewertungen aus
`public.channex_review` (Booking.com/Airbnb/Expedia, Skala 0..10, Migration
`0262`). Beides wird auf `UnifiedReview` normalisiert: die **Rohnote bleibt
mitsamt ihrer Skala** erhalten (`score` + `scale`), `score_5` ist die für Sterne
umgerechnete Fassung. Fehlt eine Note, bleibt sie `null` — kein Ersatzwert.

Lesen verlangt `view_reviews`, jede Aktion `manage_reviews`. Eigentümer sehen nur
Bewertungen ihrer Objekte (Liste **und** Detail) und sind read-only (§4.2).

| Methode      | Pfad                                          | Zweck                                                                                            |
| ------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`        | `/api/v1/reviews?source&property_id&channel_code&unanswered&limit&offset` | Vereinte Liste, neueste zuerst (`limit` ≤ 100)                         |
| `GET`        | `/api/v1/reviews/summary`                     | Kennzahlen je Kanal: Anzahl, Ø (auf 5 normalisiert), unbeantwortet, Antwortquote                  |
| `GET`        | `/api/v1/reviews/{source}/{id}`               | Detail (`source` = `marketplace`\|`ota`) — gleicher Objekt-Scope wie die Liste                     |
| `PUT`        | `/api/v1/reviews/{source}/{id}/reply`         | Öffentlich antworten. Beim Portal geht die Antwort ZUERST dorthin, erst nach Erfolg in den eigenen Bestand |
| `DELETE`     | `/api/v1/reviews/marketplace/{id}/reply`      | Antwort entfernen — nur auf dem Marktplatz (Portale kennen kein Zurücknehmen) → `204`             |
| `POST`       | `/api/v1/reviews/guest-rating`                | Betrieb bewertet einen Gast (Zwei-Wege, myBestDays). Idempotent über `UNIQUE(reservation_id)` → `409` |
| `GET`        | `/api/v1/reviews/guest-rating/{reservation_id}` | Bereits abgegebene Betrieb→Gast-Bewertung                                                       |
| `POST`       | `/api/v1/reviews/ota/{id}/guest-review`       | Gast beim Portal bewerten (nur Airbnb). Zweiter Versuch → `409`                                  |
| `GET`        | `/api/v1/reviews/quality?from&to`             | Qualitäts-Kennzahlen: Ø, 5-Sterne-Quote, Antwortquote, Kategorien, Tagesverlauf, Rangliste je Objekt (Spanne ≤ 366 Tage) |
| `GET`        | `/api/v1/reviews/queue?status&limit&offset`   | Warteschlange der geplanten Gast-Bewertungen, nächste Fälligkeit zuerst (Migration `0267`)       |
| `PATCH`      | `/api/v1/reviews/queue/{id}`                  | Inhalt eines geplanten Eintrags ändern (nur im Status `geplant`, sonst `409`)                    |
| `POST`       | `/api/v1/reviews/queue/{id}/skip`             | Diesen Gast nicht bewerten — Eintrag bleibt als `uebersprungen` stehen                           |
| `POST`       | `/api/v1/reviews/queue/{id}/send`             | Jetzt abschicken statt auf die Fälligkeit zu warten. Unumkehrbar                                 |
| `GET/PUT`    | `/api/v1/reviews/automation`                  | Automatik je Betrieb (Migration `0263`)                                                          |
| `POST`       | `/api/v1/reviews/sync`                        | Portal-Bewertungen jetzt abgleichen                                                              |
| `POST`       | `/api/v1/reviews/tick`                        | Cron: Fristablauf veröffentlichen + spiegeln + Automatik (`X-Internal-Cron-Secret`)              |

**Portal-Anbindung:** `channel_manager/reviews_sync.py` spiegelt die Channex-
Reviews-API in `channex_review` (Upsert auf `channex_review_id`). Der Webhook
(`review`/`updated_review`, im `event_mask` seit Beginn) ist nur der **Auslöser** —
der Stand wird per `GET /reviews/{id}` nachgezogen, weil Channex keine Reihenfolge
zusichert. Eigene Arbeitsfelder (`is_read`, `is_archived`, `assigned_user_id`)
werden beim Sync NICHT zurückgesetzt. Backstop: `REVIEWS_TICK_SECONDS` im Worker
(stündlich) — fängt verlorene Webhooks ab.

**Automatik (`review_automation`) + Warteschlange (`guest_review_queue`, 0267):**
Die Automatik SCHICKT nicht ab, sie PLANT: der Tick legt einen Entwurf mit
Fälligkeit und Restfrist an, der Betrieb sieht ihn, ändert ihn, überspringt ihn
oder schickt ihn sofort — eine abgeschickte öffentliche Bewertung lässt sich bei
keinem Portal zurücknehmen. Erst ein späterer Tick versendet, was fällig und
noch `geplant` ist. Der Status wird VOR dem Versand beansprucht (Wurzel 2);
scheitert er, steht die Zeile auf `fehler` samt Grund statt still zu
verschwinden. Ein übersprungener Eintrag bleibt stehen, sonst legte ihn der
nächste Tick neu an. Portal-Entwürfe entstehen nur für **Airbnb** — Booking.com
und Expedia kennen keine Bewertung des Gasts; kein Entwurf wird angelegt, dessen
Fenster schon zu ist. Die Erinnerungsmail an den Gast geht dagegen direkt raus
und wird in `review_automation_log` beansprucht
(`UNIQUE(reservation_id, kind)`).

**Sichtbarkeit (Zwei-Wege, Airbnb-Modell):** Gast→Objekt und Betrieb→Gast bleiben
verdeckt (`published_at IS NULL`), bis beide Seiten abgegeben haben oder die
14-Tage-Frist abläuft (`reviews/publication.py`).

**Abgrenzung:** OTA-Bewertungen sind INTERN. Öffentlich (myBestDays-Marktplatz,
Website des Betriebs) erscheinen ausschließlich eigene, verifizierte
myBestDays-Bewertungen — Booking.com und Airbnb erlauben das Weiter-
veröffentlichen ihrer Bewertungen nur eingeschränkt.

---

## guest_reviews — Bewertungen des myBestDays-Marktplatzes (Gast-Seite)

| Methode | Pfad                                                     | Auth                       | Zweck                                                                        |
| ------- | -------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| `GET`   | `/api/v1/guest-reviews/property/{property_id}?limit&offset` | **öffentlich**             | Maskierte Bewertungen eines Objekts + Ø/Anzahl/Kategorie-Durchschnitte        |
| `GET`   | `/api/v1/guest-reviews/tenant/{tenant_id}?limit`         | **öffentlich**             | Dasselbe über ALLE Objekte eines Betriebs (speist den Website-Bewertungs-Block) |
| `GET`   | `/api/v1/guest-reviews/mine`                             | Gast-JWT                   | Eigene Bewertungen — auch verdeckte (der Gast sieht seine immer)              |
| `POST`  | `/api/v1/guest-reviews`                                  | Gast-JWT                   | Bewertung abgeben; `property_id` wird aus der Reservierung abgeleitet         |
| `PATCH` | `/api/v1/guest-reviews/{review_id}`                       | Gast-JWT                   | Eigene Bewertung ändern (fremd → `404`)                                      |
| `POST`  | `/api/v1/guest-reviews/publish-overdue`                   | `X-Internal-Cron-Secret`   | Einseitige Bewertungen nach der 14-Tage-Frist veröffentlichen                 |

Maskierung (Wurzel 9): der öffentliche Pfad liefert nur den **Vornamen**, nie
E-Mail, vollen Namen oder `portal_guest_id`. Abgeben setzt einen echten,
abgeschlossenen Aufenthalt voraus (E-Mail-Match + `status`/`check_out`); der
Zweit-Insert derselben Reservierung → `409`.

---

## travel_agencies — Reisebüro-/Partner-Kartei

Alle Endpunkte hinter der ..-Permission `manage_partners`. Verträge sind
nach Jahren gruppierbar (Jahr = `valid_from`); Vertragsdateien liegen im
privaten Bucket `agency-contracts` (Download nur als signierte URL).

| Methode            | Pfad                                                              | Zweck                                                                     |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `GET`              | `/api/v1/travel-agencies?q&include_inactive`                      | Partner-Liste                                                             |
| `POST`             | `/api/v1/travel-agencies`                                         | Partner anlegen                                                           |
| `GET/PATCH/DELETE` | `/api/v1/travel-agencies/{id}`                                    | Kartei lesen/ändern/löschen                                               |
| `GET/POST`         | `/api/v1/travel-agencies/{id}/contacts` · `DELETE …/{cid}`        | Kontaktpersonen                                                           |
| `GET/POST`         | `/api/v1/travel-agencies/{id}/contracts` · `PATCH/DELETE …/{cid}` | Verträge (Art, Gültigkeit, Währung, Kommission, Release)                  |
| `POST`             | `…/contracts/{cid}/file`                                          | Vertragsdokument hochladen (multipart, PDF/JPG/PNG/DOCX/XLSX, 25 MB)      |
| `GET`              | `…/contracts/{cid}/file-url`                                      | signierte Download-URL (TTL 1 h)                                          |
| `GET/POST`         | `…/contracts/{cid}/rates` · `DELETE …/{rid}`                      | Saison-Preiszeilen (Zeitraum × Objekt × Preis/Nacht, net/gross, min_stay) |

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

| Methode  | Pfad                                           | Beschreibung                                                                                                                                                                                                                                                                   |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/v1/site-config/health`                   | Slice-Status                                                                                                                                                                                                                                                                   |
| `GET`    | `/api/v1/site-config`                          | Branding lesen (`site_name`, `tagline`, `logo_url`, `hero_image_url`, `primary_color`/`secondary_color` (Hex `#rrggbb`), `font_family`, `about_text`/`contact_text`/`social_links` (i18n-/Key-Objekte), `booking_mode` `instant\|inquiry\|both`); leere Config → Defaults/None |
| `PUT`    | `/api/v1/site-config`                          | Branding setzen — Teil-Update, nur gesendete Felder werden geschrieben                                                                                                                                                                                                         |
| `GET`    | `/api/v1/site-config/domains`                  | Custom-Domains des Tenants (`status` `pending\|active\|error`, `ssl_status`, `dns_records[]`; die interne Cloudflare-Hostname-ID wird bewusst nicht exponiert)                                                                                                                 |
| `POST`   | `/api/v1/site-config/domains`                  | Domain verbinden → `201`; legt den Cloudflare-Custom-Hostname an und liefert die zu setzenden DNS-Records (CNAME + TXT-Validierung). `409` Domain bereits vergeben (global unique); `503` Cloudflare nicht konfiguriert                                                        |
| `POST`   | `/api/v1/site-config/domains/{domain_id}/sync` | Status/SSL-Status frisch von Cloudflare spiegeln (`pending` → `active`). `409` wenn nicht mit Cloudflare verknüpft                                                                                                                                                             |
| `DELETE` | `/api/v1/site-config/domains/{domain_id}`      | Domain trennen → `204` (Cloudflare-`404` wird toleriert)                                                                                                                                                                                                                       |

### Seiten (`/api/v1/site-config/pages`)

| Methode  | Pfad                                              | Beschreibung                                                                                                                                                                 |
| -------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/site-config/pages`                       | Seiten des Tenants (sortiert nach `nav_order`)                                                                                                                               |
| `POST`   | `/api/v1/site-config/pages`                       | Seite anlegen → `201`. Body `{title, slug?}`; `slug` nur `a-z 0-9 -`, leer = Home-Slug. Die **erste** Seite eines Tenants wird automatisch Home. `409` Slug bereits vergeben |
| `PUT`    | `/api/v1/site-config/pages/{page_id}`             | Seite ändern (Teil-Update): `title`, `slug`, `seo_title`, `seo_description`, `og_image_url`, `nav_order`. `409` Slug-Kollision                                               |
| `POST`   | `/api/v1/site-config/pages/{page_id}/home`        | Seite zur Home-Seite machen (genau eine je Tenant, partieller Unique-Index)                                                                                                  |
| `POST`   | `/api/v1/site-config/pages/{page_id}/publish`     | veröffentlichen (`is_published=true`)                                                                                                                                        |
| `POST`   | `/api/v1/site-config/pages/{page_id}/unpublish`   | Veröffentlichung zurücknehmen                                                                                                                                                |
| `DELETE` | `/api/v1/site-config/pages/{page_id}`             | Seite löschen → `204` (Blöcke per FK-Cascade)                                                                                                                                |
| `POST`   | `/api/v1/site-config/pages/{page_id}/draft-token` | Kurzlebigen Vorschau-Token erzeugen → `{token}` (s. u.)                                                                                                                      |

### Blöcke (`/api/v1/site-config/…/blocks`)

| Methode  | Pfad                                                 | Beschreibung                                                                                                         |
| -------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/site-config/pages/{page_id}/blocks`         | Blöcke einer Seite (nach `position` sortiert)                                                                        |
| `POST`   | `/api/v1/site-config/pages/{page_id}/blocks`         | Block anlegen → `201`. Body `{type, content?, settings?}`; wird ans Ende positioniert                                |
| `PUT`    | `/api/v1/site-config/blocks/{block_id}`              | `content`/`settings` ändern (der `type` ist unveränderlich)                                                          |
| `POST`   | `/api/v1/site-config/pages/{page_id}/blocks/reorder` | Neu ordnen: `{ordered_ids}` muss **exakt** die Block-Menge der Seite sein, sonst `400`                               |
| `DELETE` | `/api/v1/site-config/blocks/{block_id}`              | Block löschen → `204`                                                                                                |
| `POST`   | `/api/v1/site-config/templates/apply`                | Start-Template anwenden: `{template_id}` (`bergchalet`\|`kueste`\|`stadt`) → Seitenliste; `404` unbekanntes Template |

**Block-Typen (11) + Content-Validierung:** `hero` · `rich_text` · `image` ·
`gallery` · `button` · `spacer` · `contact` · `search` · `properties_grid` ·
`featured_properties` · `reviews` (Migration `0266`; zeigt die eigenen,
verifizierten myBestDays-Bewertungen — `property_id` leer = alle Objekte des
Betriebs; Portal-Bewertungen erscheinen bewusst NICHT). Der `content` wird
**pro Typ** gegen ein eigenes
Pydantic-Schema validiert und normalisiert (`validate_block_content`) — Felder
außerhalb des Schemas werden verworfen, ungültiger Inhalt → `400`. Texte sind
i18n-Objekte (`{locale: text}`). `settings` sind typunabhängig
(`background_color` Hex, `padding` `none|sm|md|lg`, `full_width`, `opacity`,
`visible`, `radius`, `rotation`).

**Font-Katalog:** Die Schriftauswahl des Editors (voller Google-Fonts-Katalog)
läuft **nicht** über FastAPI, sondern über die server-seitige Next.js-Route
`/api/google-fonts` in `apps/web` (Key `GOOGLE_FONTS_API_KEY`; ohne Key → `503`).

### Öffentlicher Resolver (`/api/v1/site`, KEIN JWT)

| Methode | Pfad                                      | Beschreibung                                                                                                                                                                                                                                                                                                                                    |
| ------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/v1/site/by-domain?host=`            | Host → Tenant + **öffentliches** Branding (`PublicSiteResponse`: `tenant_id`, Branding-Felder — keine Domain-/Cloudflare-Interna). Nur Domains mit `status=active`; `422` fehlender/zu kurzer Host (Query-Validierung `min_length=3`), `400` Whitespace-Host, `404` unbekannte Domain. Wird von der `builder/`-Middleware je Request aufgerufen |
| `GET`   | `/api/v1/site/page?host=&slug=`           | Veröffentlichte Seite + Blöcke + Branding (`PublicPageResponse`) für den Renderer. Nur `is_published`; leerer `slug` → Home-Seite; unbekannt → `404`                                                                                                                                                                                            |
| `GET`   | `/api/v1/site/page/draft?page_id=&token=` | Entwurfs-Render für die Editor-Vorschau — liefert auch **unveröffentlichte** Seiten. `403` bei ungültigem/abgelaufenem Token                                                                                                                                                                                                                    |

**Draft-Token-Mechanik:** `POST /site-config/pages/{id}/draft-token` signiert
`tenant_id.page_id.exp` per **HMAC-SHA256** mit `SITE_DRAFT_SECRET`
(Token-Format `{exp}.{sig}`, **TTL 3600 s**); `GET /site/page/draft` verifiziert
konstant-zeitig (`hmac.compare_digest`). So kann der Editor eine Vorschau ohne
JWT rendern lassen, ohne unveröffentlichte Inhalte öffentlich zu machen.

**Frontend-Anbindung:** Server-Actions in `apps/web/lib/site-pages.ts` +
`lib/site-config.ts` (u. a. `syncBlocks()` als Diff-Orchestrator des Editors —
es gibt bewusst keinen Bulk-Endpunkt); der `builder/`-Renderer ruft den
öffentlichen Resolver über seinen eigenen Proxy (`builder/app/api/v1/[...path]/route.ts`).

---

## platform_admin — Backoffice-Team (`/api/v1/platform/team`)

Der einzige mandantenübergreifende Zugang der Plattform (`platform_admins`,
Migration `0202`) hatte bis `0237` keinen Vergabeweg: Selbstregistrierung ist
aus (`GOTRUE_DISABLE_SIGNUP`), GoTrue hat keinen SMTP-Zugang, also musste jeder
neue Kollege per psql eingetragen werden. Diese Endpunkte schließen das.

| Methode | Pfad                          | Zweck                                                                            |
| ------- | ----------------------------- | -------------------------------------------------------------------------------- |
| `GET`   | `/api/v1/platform/team`       | Alle Zugänge inkl. entzogener (Historie), E-Mail + letzter Login aus GoTrue        |
| `POST`  | `/api/v1/platform/team`       | Einladen/Freischalten (`require_platform_write`)                                   |
| `PATCH` | `/api/v1/platform/team/{id}`  | Rolle, Notiz, Aktiv-Status (`require_platform_write`)                              |
| `POST`  | `/api/v1/platform/team/accept`| Einladung annehmen + eigenes Passwort setzen — **öffentlich**, auth-Rate-Limit     |
| `POST`  | `/api/v1/platform/team/passwort-vergessen` | Reset-Link anfordern — **öffentlich**, immer dieselbe Antwort         |
| `POST`  | `/api/v1/platform/team/passwort-neu`       | Neues Passwort per Reset-Token setzen — **öffentlich**               |

**Einladung:** existiert zur E-Mail schon ein Konto (RPC `auth_user_id_by_email`,
nur `service_role`), wird es sofort freigeschaltet — kein Link, kein
Passwortvorgang. Sonst legt der Server ein GoTrue-Konto mit Zufallspasswort an
(das niemand kennt) und erzeugt einen Einmal-Token: in der DB liegt nur dessen
SHA-256, der Klartext existiert nur im Link. Versendet wird über `core.mail`
(unser SMTP), 72 h gültig, einmal verwendbar. Scheitert der Versand, wird der
Link an den einladenden Admin zurückgegeben — mit dem echten Grund, nie als
stiller Erfolg.

**Passwort vergessen (`0279`):** derselbe Mechanismus, eigene Spalten
(`reset_token_hash`/`reset_expires_at`/`reset_requested_at`) und **eine Stunde**
Gültigkeit. Warum nicht GoTrue: `GOTRUE_SMTP_HOST` ist leer, `reset_password_email()`
läuft dort ins Leere — der Versand geht über `core.mail` an den eigenen
Mailcow-Server. `passwort-vergessen` antwortet **immer** wörtlich gleich (kein
Konto, kein Zugang, entzogen, Sperrfrist, Mailfehler): eine unterscheidbare
Antwort wäre ein Verzeichnis der Betreiber-Zugänge. Zusätzlich zum strengen
`auth`-Bucket gilt eine **Sperrfrist von 1 Minute je Konto** gegen
Mail-Bombardement. Ging die Mail nicht raus, wird der Token wieder entfernt —
es liegt nie ein gültiger Zugang bereit, den niemand bekommen hat.
`passwort-neu` lehnt jeden Fehlerfall mit demselben `400` ab, setzt das Passwort
über die GoTrue-Admin-API, verbraucht den Token, holt ein offenes
`accepted_at`/`invite_token_hash` nach und **widerruft ALLE Sitzungen** des
Kontos (`host_revoke_other_sessions`, `keep=NULL`) — ein Reset ist der Weg eines
Kompromittierten, eine überlebende fremde Sitzung würde ihn wirkungslos machen.
Beide Endpunkte stehen bewusst NICHT im Backoffice-Protokoll: dort gibt es
keinen Akteur, und schon der Eintrag würde verraten, welche Adresse ein Konto hat.
Live-Prüfung: `scripts/platform/verify_backoffice_passwort_reset.py`.

**Aussperr-Schutz (im Service, gilt für jeden Aufrufer):** niemand ändert die
eigene Rolle oder den eigenen Zugang; der letzte aktive `platform_admin` kann
nicht herabgestuft oder deaktiviert werden (`409`). Jede Aktion landet im
Backoffice-Protokoll (`team.list` / `team.invite` / `team.update`).

**Frontend:** `admin/app/(backoffice)/team` + `admin/components/team-verwaltung.tsx`;
die Annahme läuft über `admin/app/einladung` (ohne Anmeldung erreichbar, siehe
`admin/middleware.ts`).

---

## platform_admin — Deploy-Monitor (`/api/v1/platform/deploy`)

Welcher Stand läuft gerade wo, und was ist zuletzt ausgerollt worden. Die
Quelle ist die **Coolify-REST-API**, nicht unsere Datenbank.

| Methode | Pfad                                | Zweck                                                        |
| ------- | ----------------------------------- | ------------------------------------------------------------ |
| `GET`   | `/api/v1/platform/deploy`           | Je Anwendung der laufende bzw. letzte Deploy                   |
| `GET`   | `/api/v1/platform/deploy/{uuid}`    | Verlauf EINER Anwendung (`limit` 1–100)                        |
| `POST`  | `/api/v1/platform/deploy/{uuid}`    | Deploy auslösen (`require_platform_write`)                     |
| `GET`   | `/api/v1/platform/deploy/log/{deployment_uuid}` | Build-Ausgabe eines Deploys, Zeile für Zeile       |

**Warum die API und nicht Coolifys Postgres:** die Historie liegt dort in
`application_deployment_queue`. Direkt zu lesen wäre möglich, koppelt uns aber
an ein internes Schema, das jedes Coolify-Update ändern darf. Live geprüft
(06.08.2026, Coolify 4.x / Laravel 12.61.1): `GET /api/v1/deployments`,
`GET /api/v1/deployments/applications/{uuid}`, `POST /api/v1/deploy?uuid=`.
`POST` ist Pflicht — seit Coolify 4.2.0 quittiert `GET /api/v1/deploy` mit
`405 endpoint changed to POST`.

**Welche Anwendungen:** aus `scripts/ci/coolify-apps.txt`, derselben Datei, aus
der CI-Build und CI-Deploy lesen. Eine zweite Liste im Backend würde
auseinanderlaufen (App im Monitor, aber nicht in der CI — oder umgekehrt).

**Konfiguration:** `COOLIFY_API_URL` + `COOLIFY_TOKEN` (Env von `nextdays-api`).
Der Token braucht nur die Berechtigungen `read` und `deploy` — **nicht** `write`:
damit kann er Anwendungen weder ändern noch löschen (per `DELETE /applications`
gegengeprüft → `403`). `COOLIFY_API_URL` zeigt containerintern auf
`http://coolify:8080` (gemeinsames Docker-Netz `coolify`), nicht ins offene Netz.
Fehlt eines von beiden, antwortet der Monitor `503` mit klarem Grund statt eine
leere Tabelle als „alles ruhig" auszugeben (Wurzel 4).

**Fail-closed (Wurzel 5):** Coolify-Fehler werden nicht zu leeren Listen —
abgelehnter Token/nicht erreichbar → `502`, unbekannte Anwendung → `404`. Ein
Deploy geht ausschließlich auf UUIDs aus der geführten Liste. Lesen darf jeder
im Backoffice (auch `platform_support`: sehen, ob etwas ausrollt, hilft bei
jeder Störung), **auslösen** nur `platform_admin`. Protokolliert als
`deploy.view` / `deploy.history` / `deploy.trigger`.

**Kein Realtime:** es gibt keine Supabase-Tabelle zum Abonnieren. Die Seite lädt
im Takt neu — 5 s während eines Baus, sonst 30 s.

**Build-Logs — zweiter, getrennter Token:** Coolify blendet das Feld `logs`
aus, solange der Token nicht `read:sensitive` hat (`ApiSensitiveData`-
Middleware, live gelesen 06.08.2026). Diese Berechtigung öffnet in 8
Controllern zusätzlich Webhook-Secrets, Dateiinhalte und Cloud-Provider-Token —
zu viel für einen Log-Viewer. Deshalb zwei Token: `COOLIFY_TOKEN`
(read+deploy, kann keine Secrets lesen) und `COOLIFY_LOG_TOKEN`
(read+read:sensitive, kann NICHT deployen). Live gegengeprüft. Fehlt der
Log-Token, bleibt der Monitor nutzbar und nur die Ausgabe meldet `503`.

Bewusst KEIN Link in die Coolify-Oberfläche: die ist nur über einen
SSH-Tunnel erreichbar, ein Link liefe für den Betreiber ins Leere. Die
Ausgabe wird deshalb im Backoffice selbst gerendert — `hidden`-Zeilen werden
gefiltert (interne Schritte), `stderr` wird farblich abgesetzt, und während
eines laufenden Baus lädt die Ansicht alle 4 s nach.

**Frontend:** `admin/app/(backoffice)/deploy` (Übersicht),
`admin/app/(backoffice)/deploy/[uuid]` (Verlauf + Ausgabe),
`admin/components/deploy-tabelle.tsx`, `admin/components/deploy-log.tsx`.

---

## support (Live-Chat & Anfragen — implementiert)

Der Support-Kanal zwischen **Kunde** und **myNextDays-Backoffice**. Ein Chat ist
KEIN eigenes Datenmodell, sondern eine Konversation im vorhandenen
`support_tickets`/`support_messages`-Modell (Migrationen `0204`–`0206`, Chat-Teil
`0236`) — genau wie Intercom, Chatwoot und Zendesk Widget-Chat, E-Mail und
Formular in einem Konversations-Stream führen.

Drei Melder-Welten, ein Service: `/support/*` für Betriebs-Nutzer (JWT mit
`tenant_id`), `/support/guest/*` für Plattform-Gäste (ADR-0015/0017) und
`/support/public/*` für **anonyme Website-Besucher** (Migration `0238`). Interne Team-Notizen (`support_messages.internal`) werden
serverseitig herausgefiltert **und** per RLS (0205) vom DB-Direktpfad
ausgeschlossen; auch die Vorschau `last_message_preview` wird nie aus einer
internen Notiz gesetzt.

### Melder (`/api/v1/support`)

| Methode | Pfad                                | Zweck                                                                                              |
| ------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `POST`  | `/api/v1/support`                   | Formular-Anfrage (Betreff + Text + Thema)                                                          |
| `POST`  | `/api/v1/support/chat`              | Chat eröffnen (nur Text; Betreff wird serverseitig abgeleitet). Idempotent über `client_msg_id`     |
| `GET`   | `/api/v1/support?limit&offset`      | Eigene Konversationen inkl. `unread`, `last_message_preview`, `source`                              |
| `GET`   | `/api/v1/support/unread`            | `{conversations, messages}` — Badge-Zahl ist `conversations` (Intercom-Semantik)                    |
| `GET`   | `/api/v1/support/{id}`              | Konversation mit Verlauf (ohne interne Notizen)                                                     |
| `POST`  | `/api/v1/support/{id}/reply`        | Antworten (idempotent über `client_msg_id`); öffnet eine gelöste Konversation wieder                |
| `POST`  | `/api/v1/support/{id}/read`         | Lese-Cursor des Melders setzen                                                                      |
| `POST`  | `/api/v1/support/{id}/rating`       | Bewertung 1–5 (+ Kommentar) — nur nach Abschluss, sonst `409`                                        |

Gast-Zweig identisch unter `/api/v1/support/guest`, `…/guest/list`,
`…/guest/{id}`, `…/guest/{id}/reply`.

### Anonyme Website-Besucher (`/api/v1/support/public`) — OHNE Auth

Das Chat-Widget der Marketing-Seite (`marketing/components/support-chat.tsx`).
Ein Interessent hat kein Konto und soll für eine Frage keines anlegen müssen —
er hinterlässt Name, E-Mail und optional Telefon; die Anfrage IST das Ticket
(`source='web'`, Kontaktdaten an `support_tickets.reporter_*`).

| Methode | Pfad                                     | Zweck                                                                    |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| `POST`  | `/api/v1/support/public/chat`            | Anfrage eröffnen (Name, E-Mail, Telefon?, Text). Antwort enthält EINMALIG das Token |
| `GET`   | `/api/v1/support/public/{token}`         | Eigener Verlauf (ohne interne Notizen)                                    |
| `POST`  | `/api/v1/support/public/{token}/reply`   | Antworten, idempotent über `client_msg_id`                                |

Schutz statt Login:

- **Token als Scope**: 32 Byte Zufall, in der DB liegt nur `sha256` hex
  (`visitor_token_hash`, eindeutig). Vergleich byteweise über
  `core.security.secrets_match`; ein unbekanntes Token ist von einem fremden
  nicht unterscheidbar (`404`, Wurzel 9).
- **Eigener Rate-Limit-Bucket** `public_support` (Standard `20/60` je IP,
  `RATE_LIMIT_PUBLIC_SUPPORT`), als sensibel eingestuft → fail-closed. Der
  Aufruf geht deshalb **direkt** vom Browser an die API, nicht über eine
  Next-Proxy-Route: sonst zählte der Limiter die Server-IP der Marketing-App
  statt der Besucher-IP. Betrieb: Marketing-Domain in `CORS_ORIGINS` eintragen.
- **Schmales Antwortschema** `PublicTicket` (nur `ticket_id`, `status`,
  Nachrichten) — keine Priorität, keine internen Felder.
- **Kein Realtime**: `support_tickets` ist für `anon` vollständig gesperrt
  (Wurzel 6) — ein Abo dafür zu öffnen hieße, alle Support-Verläufe am anon-Key
  erreichbar zu machen. Das Widget fragt daher alle 8 s ab, solange es offen
  ist; das Backoffice bleibt auf Realtime.

### Backoffice (`/api/v1/platform/support`)

| Methode | Pfad                                             | Zweck                                                                     |
| ------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| `GET`   | `…/support?status_filter&source&mine&limit`      | Konversationsliste inkl. `unread` (Team-Sicht), Kanal- (`form`/`chat`/`web`) und Zuweisungsfilter |
| `GET`   | `…/support/{id}`                                 | Verlauf **inkl.** interner Notizen                                         |
| `POST`  | `…/support/{id}/reply`                           | Antwort oder interne Notiz (`internal: true`), idempotent                  |
| `POST`  | `…/support/{id}/read`                            | Lese-Cursor des Teams                                                     |
| `PATCH` | `…/support/{id}`                                 | Status, Priorität, Zuweisung                                              |

### Live-Verhalten

- **Nachrichten**: Supabase-Realtime (`postgres_changes`) auf
  `support_messages`/`support_tickets`; die RLS-Policies aus `0205`/`0206`
  entscheiden, wer welche Zeile sieht. Kein Polling, kein Reload.
- **Tippt-Anzeige & Anwesenheit**: flüchtig über Supabase **Broadcast/Presence**
  auf den privaten Topics `support:<ticket_id>` und `support:presence`.
  Autorisierung per RLS auf `realtime.messages` (`0236`): Teilnehmer der
  Konversation bzw. Backoffice; **eintragen** in den Anwesenheits-Kanal darf nur
  ein Plattform-Admin — ein Kunde kann sich nicht als „Team" ausgeben.
- **Idempotenz (Wurzel 2)**: `client_msg_id` + partieller UNIQUE-Index
  `(ticket_id, client_msg_id)`; ein Retry liefert die bestehende Nachricht.

**Frontend:** Kunden-Widget `web/components/support/support-chat.tsx`
(geöffnet über „Hilfe erhalten" im Konto-Menü), Agenten-Konsole
`admin/components/support-konsole.tsx` (`/support`).
