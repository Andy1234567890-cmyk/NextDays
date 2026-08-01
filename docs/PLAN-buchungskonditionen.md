# Plan — Buchungskonditionen (Policies) vereinheitlichen

Status: **Entwurf zur Freigabe** · Stand 2026-08-01
Referenz-UI: Lodgify „Konditionen" (`app.lodgify.com/policies/<id>`)
Betroffen: `apps/api` (booking_conditions, payments, channel_manager, booking_engine),
`web` (Objekte/Richtlinien + Einstellungen/Konditionen), `plattform` (myBestDays),
`builder` (Pagebuilder), Channex.

---

## 1. Befund: wir haben ZWEI unverbundene Policy-Modelle

Live geprüft (lokale App + Code + DB-Migrationen):

### A) `booking_conditions` — das echte, reiche Modell (Backend fertig)
- Tabellen `booking_conditions` + `booking_condition_refund_rules`
  (Migration `0165`, ergänzt durch `0168`), RLS + `revoke` gesetzt (Wurzel 6), Realtime-Publikation drin.
- Felder: 1/2/3 Raten, erste Zahlung `percent|absolute`, Fälligkeit
  `on_booking|days_before_arrival`, Restzahlung-Achse
  `days_before_arrival|days_after_arrival|days_before_departure|not_scheduled`,
  dritte Rate, Storno `non_refundable|refundable|partial` + **gestaffelte Regeln**
  (`refund_percent` / `days_before_arrival`), Kaution (`preauth|manual`,
  `absolute|percent`, Betrag, Währung, Vorautorisieren X Tage vor Anreise,
  Freigabe X Tage nach Abreise), Angebotsgültigkeit in Stunden.
- Slice `apps/api/src/features/booking_conditions` (CRUD, tenant-scoped, Default-Kondition).
- **Wirkt bereits**: `PaymentsService._resolve_condition` (Rate-Plan → sonst Tenant-Default),
  Anzahlung + geplante Restzahlung, `refund_for_cancellation` (policy-konforme
  Erstattung, hinter dem Schalter `auto_refund_on_cancel`), Kaution als
  Stripe-Hold (`create_deposit_hold`, `capture_method="manual"`, capture/release).
- UI: `/einstellungen` → Tab **Konditionen** (`BookingConditionsManager`).
- **Zuweisung an einen Rate-Plan** (`rate_plans.booking_condition_id`) existiert in der
  DB, ist aber **in keiner UI setzbar** — praktisch greift immer nur der Tenant-Default.

### B) `type_attributes.policies` — der Lodgify-Nachbau am Objekt (UI fertig, ohne Wirkung)
- `/objekte/<id>/richtlinien` (`policies-form.tsx`, `policy-meta.ts`) schreibt einen
  **JSON-Blob** ins Objekt: eigenes `policy`-Objekt (nur `one|split`,
  `flexible|moderate|strict|non_refundable`, Kaution nur ja/Betrag), `bookability`,
  `checkInTime`/`checkOutTime`, `ratesInfo`, `rentalAgreement` (3 Sprachen fest: de/en/da).
- Der Dialog „Richtlinie zuweisen → Neue Richtlinie" legt **nicht** in
  `booking_conditions` an, sondern in den JSON-Blob.
- Verwendet wird aus dem Blob nur: `checkInTime`/`checkOutTime` +
  `rentalAgreement`/`cancellation` → Channex `hotel_policies` /
  `content.important_information` (`content_sync.py`, `content_builder.py`).
- Kaution hat eine **dritte** Quelle: `properties.deposit_amount` (Migration `0082`).

**Konsequenz:** Was der Betrieb im Objekt-Tab „Richtlinien" einstellt, hat auf Zahlungen,
Storno-Erstattung und Kaution **keinerlei Wirkung**; was Wirkung hat (`booking_conditions`),
ist an einer anderen Stelle versteckt und pro Objekt gar nicht zuweisbar.
Storno-Modell A (Regel-Staffel) und B (4 fixe Namen) sind zudem **nicht ineinander überführbar**.

### Weitere Lücken im Bestand
- **Channex-Stornorichtlinie fehlt komplett.** `channex_client` kann `hotel_policies`,
  aber es gibt **keinen** Aufruf von `/cancellation_policies` und kein Setzen von
  `rate_plans.cancellation_policy_id` / `properties.default_cancellation_policy_id`.
  Unsere eigene Live-Gap-Analyse (`docs/CHANNEX-FELDER.md`) nennt genau das als
  **verkaufsblockierend**: „keine Stornorichtlinie → Booking/Expedia verlangen sie".
- **Gast sieht nichts**: weder Booking-Engine noch `plattform` (myBestDays) noch der
  Pagebuilder geben Storno-/Zahlungs-/Kautionsbedingungen aus.
- **Kein Realtime-Abo** auf `/objekte/<id>/richtlinien` und im Konditionen-Manager
  (Projektregel: jede Liste/Detail-UI abonniert ihre Quellen).
- **Buchbarkeit** (`instant|request|inquiry`) wird gespeichert, aber nirgends ausgewertet
  (kein Angebots-/Anfrage-Flow, keine befristete Kalendersperre).

---

## 2. Lodgify — was der Tab wirklich kann (live abgelesen)

Aufbau der Seite: **Buchungskonditionen** (Policy-Zuweisung + Editor) · **Buchbarkeit** ·
**Check-in/out-Zeiten** · **Rechtliche Informationen zur Website** (Preisinformationen,
Mietvereinbarung) · **Booking.com Lizenzen**.

Policy-Editor (Feld für Feld, inkl. Optionswerten):

| Block | Felder / Werte |
|---|---|
| Interner Name | Pflicht, nur intern |
| Zahlungsplan | `one-payment` / `two-payments` / `three-payments` |
| Erste Zahlung | Art: `percentage` / `fixed` / `percentage-or-fixed`; Prozentsatz bzw. Betrag |
| Folgezahlung | Tage + Achse: `BeforeCheckIn` / `AfterCheckIn` / `BeforeCheckOut` / `NotScheduled` |
| Gast-Stornierung | `None` (nicht erstattungsfähig) / `Full` / `Partial` |
| Regeln (bei `Partial`) | n Regeln: Art `Percentage`/`Flat` + Erstattung + „wenn storniert ≥ N Tage vor Anreise" |
| Kaution | `NotRequired` / `Required`; Methode `Manual` / `Card` (Vorautorisierung) |
| Angebotsgültigkeit | Stunden (Lodgify-Doku: 1–720) |

Bezugsgröße der Erstattung ist ausdrücklich die **geleistete Vorauszahlung**, nicht der
Buchungswert. Buchbarkeit: `InstantBooking` / `BookingRequest` / `EnquiryOnly`.
Check-in/out: volle Stunden + „Flexibel" (`-1`).

Recherche-Belege (help.lodgify.com):
- Policy ist ein **kontoweites, wiederverwendbares Objekt**, Zuweisung pro Objekt,
  **genau eine Policy je Objekt**, eine „primary policy" als Default (nicht löschbar).
- Policy-Änderungen wirken **nicht rückwirkend** — die Policy wird zur Buchung eingefroren
  (in der API materialisiert als `quote.policy.{payments, cancellation, damage_deposit}` +
  `scheduled_payments[]`).
- Auto-Charge der Folgeraten ist **opt-in** (Checkbox), mit Retry und Zahlungsaufforderung.
- Storno: Betrag wird **automatisch berechnet**, die Auszahlung bleibt eine bewusste Aktion.
- **Policies wandern NICHT zu den OTAs** — Lodgify-Doku wörtlich: die Policy gilt nur für
  „direct and manual bookings"; Airbnb ist „merchant of record", Booking.com/Expedia
  übernehmen weder Zahlungsplan noch Storno. Einzige Ausnahme: Vrbo.
- Mietvereinbarung: pro Objekt, Freitext oder URL, Pflicht-Häkchen im Checkout,
  historisch eingefroren; digitale Signatur ist ein separater Schritt im Online-Check-in.

---

## 3. Channex — wo das andocken muss (Staging live geprüft)

`staging.channex.io` → Unterkunft → **Richtlinien**: „Hotelrichtlinien zuweisen" +
**Stornierungsrichtlinien (Create)**. Der Editor einer Stornierungsrichtlinie hat:

- **Titel**, **Währung**
- **Zugehörige Tarifpläne** — Mehrfachauswahl über Room-Types/Rate-Plans („Alle Tarife")
  → die Policy hängt am **Rate-Plan**, nicht am Objekt
- **Garantiezahlung** (guarantee payment): `Nicht erforderlich` · `nachtsbasiert` ·
  `prozentbasiert` · `Fester Betrag pro Buchung` · `Fester Betrag pro Buchungszimmer`
- **Stornierungsrichtlinie nach der Reservierung** — Typ: `Frei` · `Nicht erstattungsfähig` ·
  `Die Garantie ist nicht erstattungsfähig` · `Nachtbasiert` · `Prozentbasiert`
  (bei nacht-/prozentbasiert zusätzlich ein **Betrag**-Feld)
- **Fristgerechte Stornierung** (free cancellation deadline): „Ist erlaubt" + Frist
- **Non-Show-Policy**: `Standard` · `Gesamtpreis`
- Live-Vorschau „Policy Representation"

Passende Felder in den Channex-Objekten (aus unserer eigenen Live-Felderhebung,
`docs/CHANNEX-FELDER.md`): `properties.default_cancellation_policy_id`,
`properties.hotel_policy_id`, `rate_plans.cancellation_policy_id`, Endpunkte
`/cancellation_policies` und `/hotel_policies`.

### Channex-API — live gegen Staging verifiziert

`/api/v1/cancellation_policies` existiert (in der öffentlichen Doku **nicht** beschrieben),
CRUD + `/options` + `/convert_to_text`. Attribute:

| Feld | Werte |
|---|---|
| `title`, `currency` | Pflicht |
| `property_id` | Pflicht — ohne bleibt die Policy unsichtbar, PUT/DELETE geben 403 |
| `cancellation_policy_logic` | `free` \| `deadline` \| `non_refundable` |
| `cancellation_policy_deadline` + `_deadline_type` | Zahl + `hours` \| `days` |
| `cancellation_policy_mode` | `nights` \| `percent` |
| `cancellation_policy_penalty` | Zahl (Prozent 0–100 bzw. Nächte) |
| `after_reservation_cancellation_logic` | `free` \| `non_refundable` \| `guarantee_amount` \| `nights_based` \| `percent_based` |
| `after_reservation_cancellation_amount` | Pflicht bei `nights_based`/`percent_based` |
| `guarantee_payment_policy` | `none` \| `nights_based` \| `percent_based` \| `fixed_per_booking` \| `fixed_per_room` |
| `guarantee_payment_amount`, `guarantee_collected_at_days`, `guarantee_collected_at_booking_time` | Anzahlung + Zeitpunkt |
| `non_show_policy` | `default` \| `total_price` |
| `associated_rate_plan_ids` | Array von Rate-Plan-UUIDs |

Verknüpfung: `properties.default_cancellation_policy_id`, `rate_plans.cancellation_policy_id`.
„Non-Refundable" ist **kein Flag** am Rate-Plan → eigener (ggf. abgeleiteter) Rate-Plan
mit `cancellation_policy_logic: non_refundable`.

**Hotel Policy — unsere Feldnamen sind vermutlich falsch.** Live verlangt die API ein
**Zeitfenster** (`checkin_from_time`, `checkin_to_time`, `checkout_from_time`,
`checkout_to_time`), unser `content_sync._build_hotel_policy_attrs` sendet
`checkin_time`/`checkout_time` (die veraltete Doku-Form). Zusätzlich real vorhanden:
`parking_cost`, `children_max_age`, `infant_max_age`, `self_checkin_checkout`,
`enhanced_cleaning_practices`, `cleaning_practices_description`, `partner_hygiene_link`.
→ **Schritt 0 des Plans: mit einem echten Call gegenprüfen.**

### Was über Channex NICHT geht
- **Kaution/Schadenskaution**: kein Feld (einzige Ausnahme `hotel_policies.pets_refundable_deposit`).
  Airbnbs Security Deposit / Cleaning Fee sind **Channel-Einstellungen** und nur über die
  Whitelabel-Channel-API erreichbar (nicht öffentlich) → Extranet/Channex-Dashboard.
- **Ratenzahlungsplan**: Channex kennt nur **eine** Vorauszahlung zu **einem** Zeitpunkt
  (`guarantee_*`). 2/3 Raten sind ein reines myNextDays-Feature.
- **Mietvereinbarung**: kein Feld; höchstens Freitext in `content.important_information`.
- **Buchbarkeitsart**: Airbnb `instant_booking_allowed_category` ist Channel-Setting, kein PMS-Push.
- Für Booking.com/Expedia/VRBO gibt es **keinen Beleg**, dass Channex Policies pusht — dort
  werden Rate-Plan-Konditionen im Extranet gepflegt. Belegt ist der Weg zu OTAs nur über die
  Shopping API (`rate_plans[].cancellation_policy`) und für Airbnb (Changelog).

Inbound (Buchung/Revision) liefert: `payment_collect` (`property|ota`), `payment_type`,
`deposits[]` (bereits eingezogene Beträge), `rooms[].meta.cancel_penalties[]`
(`{amount, currency, from}`), `rooms[].meta.policies` (Booking.com-Freitext),
`meta.cancellation_policy[]` (MMT/Goibibo). **Kein** normalisiertes Storno-Feld über alle OTAs.

---

## 4. Zielmodell — eine Wahrheit, drei Sichtbarkeiten

**Grundsatz:** `booking_conditions` ist die **einzige** Quelle. `type_attributes.policies.policy`
entfällt. Der Objekt-Tab „Richtlinien" wird zur **Bedienoberfläche derselben Tabelle**
(genau wie Lodgify: kontoweite Vorlage + Zuweisung).

### 4.1 Datenmodell (neue Migration)
1. `properties.booking_condition_id` (FK → `booking_conditions`, `on delete set null`) —
   **eine Kondition je Objekt** (Lodgify-Modell). Auflösung im Payments-Service:
   Rate-Plan → **Objekt** → Tenant-Default.
2. `booking_conditions` bekommt die Channex-Achsen, damit die Storno-Regel verlustfrei
   nach außen geht:
   - `free_cancellation_until_days` + `free_cancellation_deadline_type` (`days|hours`)
   - `penalty_mode` (`percent|nights`) + `penalty_value`
   - `no_show_policy` (`default|total_price`)
   - `guarantee_mode` (`none|percent|nights|fixed_per_booking|fixed_per_room`) +
     `guarantee_amount` + `guarantee_collected_at_days` (leitet sich aus dem Zahlungsplan ab,
     bleibt aber explizit speicherbar, weil Channex nur EINE Rate kennt)
3. `properties` bekommt Check-in/out als **echte Spalten** statt JSON-Blob:
   `check_in_from`, `check_in_to`, `check_out_from`, `check_out_to` (time, nullable)
   — passend zum Channex-Zeitfenster. Migration liest die Alt-Werte aus
   `type_attributes.policies.checkInTime/checkOutTime` (Wurzel 1: Alt-Zustand mitziehen).
4. `properties.bookability` (`instant|request|inquiry`, Default `instant`) als Spalte.
5. `rental_agreement` bleibt mehrsprachig, wandert aber aus dem festen `de/en/da`-Schema
   in das vorhandene `localized_text`-Muster (24 Sprachen, Projektstandard).
6. `properties.deposit_amount` (0082) wird als Quelle **entfernt** (Wurzel 1: die alte
   Quelle mitpflegen — Werte in die zugewiesene Kondition migrieren, Spalte danach
   `deprecated` kommentieren und aus `_deposit_amount` entfernen).
7. RLS/Grants: neue Spalten erben `booking_conditions` (revoke + tenant-Policy).
   `properties.booking_condition_id` ist unkritisch, aber der **Schreibpfad** auf
   `properties` ist bereits per 0194 dicht — prüfen, dass die neue Spalte nicht in einer
   client-beschreibbaren Spaltenliste landet.

### 4.2 Storno-Semantik (eindeutig festlegen)
Bezugsgröße wie bei Lodgify: **Prozent der geleisteten Vorauszahlungen**, nicht des
Buchungswerts (so rechnet `refund_for_cancellation` bereits). Regeln sind absteigend nach
`days_before_arrival` sortiert; es greift die erste Regel, deren Frist erreicht ist; darunter 0 %.
`penalty_*`/`free_cancellation_*` sind die **Außendarstellung** derselben Staffel für Channex
(Channex kann nur eine Frist + eine Strafe) — abgeleitet aus der obersten Regel, nicht doppelt gepflegt.

## 5. Kanal-Matrix (was wirkt wo) — im UI ehrlich kennzeichnen

| Feld | myNextDays (eigene Buchung/Angebot) | myBestDays (Marktplatz) | Website (Pagebuilder) | Portale (Channex) |
|---|---|---|---|---|
| Zahlungsplan (1–3 Raten) | ✅ voll | ✅ voll | Anzeige | ⚠️ nur 1 Vorauszahlung (`guarantee_*`) |
| Storno-Staffel | ✅ Berechnung + Erstattung | ✅ Anzeige + Berechnung | Anzeige | ⚠️ nur Frist+Strafe, belegter Push: Airbnb/Shopping-API |
| Nicht erstattbar | ✅ | ✅ | Anzeige | ✅ als eigener Rate-Plan |
| Kaution (Vorautorisierung) | ✅ Stripe-Hold | ✅ | Anzeige | ❌ Extranet |
| Check-in/out-Fenster | ✅ | ✅ | Anzeige | ✅ `hotel_policies` |
| Buchbarkeitsart | ✅ | ✅ | ✅ | ❌ (Airbnb-Channel-Setting) |
| Mietvertrag | ✅ Pflicht-Häkchen im Checkout | ✅ | Anzeige | ❌ (höchstens Freitext) |

Regel fürs UI: an jedem Block steht, für welche Kanäle er gilt — Badge „Portale" bzw.
„Nur myNextDays" (Projektregel: nie „Channex" im Kundentext).

## 6. Umsetzung — Schritte

**Schritt 0 — Verifikation (vor jedem Code):**
Live-Call gegen Channex-Staging: `hotel_policies` mit `checkin_from_time`… anlegen und
gegenlesen; eine `cancellation_policy` anlegen, an einen Rate-Plan hängen, `convert_to_text`
lesen, wieder löschen. Ergebnis in `docs/CHANNEX-FELDER.md` nachziehen.
(Projektregel: OTA-Realität nur aus geprüftem PUT+Gegenlesen, nie aus Payload raten.)

**Schritt 1 — Migration** (`0246_booking_conditions_objektzuweisung.sql`):
Punkte 4.1/1–7, inklusive Datenübernahme aus `type_attributes.policies` (Check-in/out,
Buchbarkeit, Mietvertrag) und aus `properties.deposit_amount`.

**Schritt 2 — API:**
- `booking_conditions`-Slice um die neuen Felder erweitern (Schemas, Service, Tests).
- `properties`-Slice: `booking_condition_id` lesen/setzen (`_require_own_*`-Scope),
  `check_in_*`/`check_out_*`, `bookability`.
- `PaymentsService._resolve_condition`: Rate-Plan → **Objekt** → Default.
- `_deposit_amount`: nur noch Kondition (kein `properties.deposit_amount`-Fallback,
  fehlt der Betrag → klarer Fehler statt Ersatzwert, Wurzel 4).
- **Einfrieren bei Buchung** (Lodgify-Modell, Wurzel 1): beim Anlegen einer Reservierung
  die geltenden Konditionen als Snapshot in die Reservierung schreiben
  (`reservations.conditions_snapshot` jsonb) — spätere Änderungen dürfen bestehende
  Buchungen nie verschieben. Storno-Berechnung liest den Snapshot, nicht die Vorlage.

**Schritt 3 — Objekt-UI `/objekte/<id>/richtlinien`:**
Lodgify-Layout beibehalten, aber gegen `booking_conditions` arbeiten:
Zuweisen bestehender Kondition · neue anlegen · bearbeiten (voller Feldsatz: 1–3 Raten,
Prozent/Pauschal, Fälligkeits-Achse, Regel-Staffel mit „Regel hinzufügen", Kaution
`preauth|manual` + Tage, Angebotsgültigkeit) · Buchbarkeit · Check-in/out-**Fenster** ·
Raten-Info · Mietvertrag. Alle Texte über `next-intl` (keine hardcodierten Labels mehr in
`policy-meta.ts`), Beträge über `formatCurrency` mit `properties.currency`.
**Realtime-Abo** auf `booking_conditions`, `booking_condition_refund_rules`, `properties`.

**Schritt 4 — Einstellungen-UI:** derselbe Editor als geteilte Komponente; zusätzlich
Bulk-Zuweisung „Kondition auf n Objekte anwenden" (das kann Lodgify nicht).

**Schritt 5 — Channex-Sync** (`channel_manager`):
- `channex_client`: `create/update/delete_cancellation_policy`, `get_cancellation_policy_text`.
- Mapper Kondition → Channex-Policy (4.2), `property_id` immer mitsenden,
  `associated_rate_plan_ids` aus unseren Rate-Plans; ID in `channex_property_map`
  (`channex_cancellation_policy_id`) merken, Alt-Zustand bei Änderung pflegen (Wurzel 1).
- `hotel_policies`: Feldnamen nach Schritt 0 korrigieren, Check-in/out aus den neuen Spalten.
- Fehlerbehandlung spezifisch (kein breites `except`), Budget-/Konflikt-Signale durchreichen (Wurzel 5).

**Schritt 6 — Gast-Sichtbarkeit:**
- Booking-Engine/Angebot: Zahlungsplan, Storno-Staffel, Kaution, Check-in/out und
  Mietvertrag anzeigen; Mietvertrag mit Pflicht-Häkchen, akzeptierte Fassung einfrieren.
- `plattform` (myBestDays): Block „Stornierungsbedingungen" auf der Objektseite und im
  Checkout, gespeist aus derselben Quelle.
- `builder` (Pagebuilder): Baustein „Buchungsbedingungen" für die White-Label-Seiten,
  der die Kondition des Objekts rendert (kein zweiter Texteditor).

**Schritt 7 — Buchbarkeit wirksam machen** (optional, eigener Slice-Schritt):
`request`/`inquiry` erzeugen ein Angebot statt einer bestätigten Buchung; Nächte werden
erst bei Annahme geblockt und nur für die Dauer der Angebotsgültigkeit — läuft es ab,
Freigabe ausschließlich über `ReservationsService._release_nights` (Wurzel 1).

## 7. Prüfung gegen die 9 Wurzeln
- **W1**: Alt-Werte (`type_attributes.policies`, `properties.deposit_amount`) werden migriert
  und die alten Quellen entfernt; Channex-Policy-Wechsel gibt die alte ID frei;
  abgelaufene Angebote geben Nächte über `_release_nights` zurück.
- **W2**: Policy-Anlage in Channex idempotent (vorhandene ID wiederverwenden);
  Zahlungs-/Kautions-Intents laufen weiter über `_reuse_pending_intent`.
- **W3**: jede `{id}`-Route über `load_scoped`/`_require_own_*`; keine ungescopten Loads.
- **W4**: kein €-Default, Währung aus `properties.currency`; fehlende Beträge → 422.
- **W5**: Channex-Fehler spezifisch fangen, nie stumm „ok" markieren.
- **W6**: neue/erweiterte Spalten sind Finanzbedingungen → `revoke` bleibt, RLS geprüft,
  gegen den anon-Key-Direktpfad gedanklich gegengetestet.
- **W8**: `rentalAgreement`/`ratesInfo` sind HTML aus dem Client → serverseitig mit
  Allowlist-Parser sanitisieren (nh3), URL-Felder mit Schema-Whitelist; Tage/Prozente cappen.
- **W9**: Konditions-Detail/Update prüft denselben Tenant-Scope wie die Liste.

## 8. Qualitätsgate
`pytest` grün · `ruff` sauber · `pylint 10.00/10` auf geänderten Modulen ·
`tsc --noEmit` in `web` und `builder` · Migration über `supabase/apply-migrations.sh`
eingespielt · Realtime-Abos gegen die Live-DB geprüft (Grant + Publikation) ·
Channex-Änderungen live gegen Staging gegengelesen · `docs/CHANNEX-FELDER.md`,
`docs/ARCHITECTURE.md`, `docs/API.md` nachgezogen.

## 9. Offene Entscheidungen (bitte mit der Freigabe beantworten)
1. **Eine Kondition je Objekt** (Lodgify) oder zusätzlich **je Rate-Plan** (Channex/Booking-Logik)?
   Vorschlag: beides — Rate-Plan schlägt Objekt schlägt Tenant-Default.
2. **Buchbarkeit** (Schritt 7) jetzt mitbauen oder als eigener Auftrag?
   Vorschlag: jetzt mitbauen, sonst bleibt das Feld weiter wirkungslos.
3. `properties.deposit_amount` **entfernen** (empfohlen) oder als Objekt-Default behalten?
4. Storno-Prozente auf **geleistete Vorauszahlung** (Lodgify) — bestätigen?

---

## 10. Nachtrag — Airbnb-Storno-Realität (recherchiert, für das Mapping)

Airbnb kennt **keine frei definierbaren Policies**, sondern feste Kategorien
(help.airbnb.com/article/475):

- Frei wählbar: **Flexible** (24 h vor Check-in), **Moderate** (5 Tage),
  **Limited** (14 Tage, neu ab 01.10.2025), **Firm** (30 Tage).
- Nur auf Einladung: **Strict**, **Super Strict 30/60** (laut Partner-Doku auslaufend —
  von Airbnb selbst nicht bestätigt).
- **Non-refundable** ist keine eigene Kategorie, sondern eine Rabatt-Variante zusätzlich
  zur gewählten Policy.
- **24-h-Kulanzfrist** auf alle Kurzzeit-Policies (Buchung ≥ 7 Tage vor Check-in).
- **Langzeit (≥ 28 Nächte)**: nur zwei Policies (Long-term Firm / Long-term Strict),
  ohne 24-h-Kulanz.
- **Kaution**: Airbnb zieht keine ein; nur „select software-connected hosts" dürfen sie
  off-platform erheben und müssen sie offenlegen. Hotels dürfen bei Check-in vorautorisieren.
  Schäden laufen über AirCover/Resolution Center (Frist 14 Tage nach Checkout).
- **Policy pro Datumsbereich** (Saison-Policy) ist bei Airbnb möglich; maßgeblich ist das
  Check-in-Datum, bestehende Buchungen behalten ihre Policy.

**Folge für unser Mapping:** unsere freie Regel-Staffel lässt sich **nicht** 1:1 nach Airbnb
schicken. Wir speichern zur Kondition zusätzlich eine **Airbnb-Kategorie-Zuordnung**
(`airbnb_policy_category`, plus optional eine Langzeit-Kategorie) und zeigen im UI ehrlich:
„Auf Airbnb gilt die nächstliegende Airbnb-Kategorie: …". Auf keinen Fall Prozentwerte
erfinden, die Airbnb nie anwendet.

---

## 11. Nachtrag — Branchenstandard, Booking.com-Grenzen, EU-Recht

### 11.1 Booking.com kann unsere freie Staffel NICHT abbilden
Vier Ebenen: `Property → Room type → Rate plan → **Roomrate**`. Der Rate Plan trägt **keine**
Konditionen; die Policy wird **auf Property-Ebene angelegt und auf Roomrate-Ebene zugewiesen**.
- **Max. 7 Cancellation Policies je Property**, mindestens 1; Policies sind **nicht löschbar**,
  eine Änderung wirkt sofort auf alle referenzierenden Roomrates.
- Frist und Strafe sind **nicht frei parametrisierbar**, sondern ein geschlossener Code-Katalog
  (BCCP `PolicyCode`): nur die Strafstufen **100 % · 50 % · erste Nacht**
  (Länder-Sonderfälle DE 80/90 %), Fristen nur aus einer festen Tages-Liste
  (1,2,3,…,14,21,28,30,45,60,90) — **kein Fixbetrag, keine Nächte-Strafe > 1 Nacht**.
- **Vorauszahlung** ist Teil derselben Policy (`GuaranteePayment`), der Betrag ist **nicht
  frei wählbar** („prepayment amount is the same as the cancellation amount") →
  faktisch nur: keine / erste Nacht / 50 % / voll. Ein 10-%- oder 30-%-Anzahlungssatz
  existiert dort nicht.
- **Non-refundable** ist kein Rate-Plan-Typ, sondern eine zweite Roomrate mit Code 1.
- **Kaution** ist ein eigenes Property-Objekt (`damage_policy`: `NONE|HANDLED_BY_PROPERTY|
  HANDLED_BY_BOOKING_COM`, Betrag, `collection_when` ON_ARRIVAL/7/14 Tage,
  `return_when` ON_CHECKOUT/7/14) — **keine Belastung bei Buchung**.
- Check-in/out-Fenster, Hausregeln, Kinder-/Haustier-/Rauchen-/Altersregeln sitzen ebenfalls
  auf **Property**-Ebene (Minuten nur `:00`/`:30`).

**Konsequenz für Schritt 5:** der OTA-Mapper braucht eine explizite Übersetzung auf den
nächstliegenden erlaubten Code **und muss bei fehlender Entsprechung hart mit 422
fehlschlagen** statt still einen „nächstbesten" Code zu wählen (Wurzel 4 + 5). Bei unserem
Modell „1 property = 1 buchbare Einheit" ist die **7-Policy-Grenze je Property** der Engpass.

### 11.2 Expedia / Vrbo
- **Expedia**: Policy am Rate Plan, `cancelPolicy.defaultPenalties[]` mit `deadline`
  (**Stunden** vor Check-in), `perStayFee` (`1stNightRoomAndTax|FullCostOfStay|None`), plus
  saisonale `exceptions[]`; Demand-Seite max. **3 Tier-Fenster**.
- **Vrbo**: fünf feste Kategorien (Relaxed/Moderate/Firm/Strict/No Refund), reine
  Prozent-**Erstattung**, Stichzeit 23:59 Objekt-Zeitzone, maßgeblich das Check-in-Datum;
  Kaution getrennt (Card on file · refundable damage deposit · Damage Protection).
- **Achtung Vorzeichen:** Expedia/OpenTravel/Channex speichern die **Strafe**,
  Vrbo/Airbnb/Hostaway die **Erstattung**.

### 11.3 PMS-Vergleich — was wir übernehmen
Sauberstes Modell ist **Hostaway**: Policy-Objekt mit CRUD + echter Regel-Staffel
(`timeDelta` Sekunden relativ zu `reservation|arrival`, `refundType percentage|flat`),
Zuweisung **pro Listing × pro Kanal** (eigene Felder je OTA) und — entscheidend — ein
**unveränderlicher Snapshot an der Reservierung**, weil der FK sonst auf eine editierbare
Zeile zeigt. Referenzstandard dahinter ist OpenTravel (`CancelPenalty` mit `Deadline`
absolut **oder** Offset + `AmountPercent` Percent/Amount/NmbrOfNights).
Über alle geprüften Systeme gilt: **Kaution, Zahlungsplan, Check-in/out und Hausregeln sind
nie Teil des Storno-Objekts** — das deckt sich mit unserer Trennung, ist aber der Grund,
warum wir `booking_conditions` als **Bündel** klar dokumentieren müssen.

**Drei Korrekturen an Kapitel 4.1:**
1. **`charge_semantics` (`refund|penalty`) als Pflichtfeld je Regel.** Ohne dieses Flag
   invertiert jeder zweite Import/Export still das Vorzeichen.
2. **Kanal-Achse in der Zuweisung**: eine Kondition kann je Kanal
   (`portal|website|airbnb|booking|expedia|vrbo`) unterschiedlich gelten bzw. auf einen
   externen Code gemappt sein → eigene Mapping-Tabelle
   (`booking_condition_channel_mapping`: `condition_id, channel, external_code`)
   statt einzelner `airbnb_policy_category`-Spalte (ersetzt den Vorschlag aus Kapitel 10).
3. **Regel-Offset**: statt nur `days_before_arrival` ein Paar
   `reference_event (booking|arrival)` + `offset_seconds` — deckt Airbnbs
   „24 h nach Buchung", Expedias Stundenfristen und unsere Tagesfristen mit einem Feld ab.
   Migration füllt es aus den bestehenden `days_before_arrival`-Werten (Wurzel 1).

Der **Snapshot an der Reservierung** (Kapitel 6, Schritt 2) ist damit doppelt begründet:
Branchenstandard **und** EU-Recht.

### 11.4 EU-Recht — was vor der Buchung angezeigt werden MUSS
Art. 6 Abs. 1 RL 2011/83/EU (Verbraucherrechte-RL):
- **lit. e** Gesamtpreis **inkl. aller Steuern und Abgaben** und aller sonstigen Kosten;
- **lit. g** Zahlungs- und Leistungsbedingungen (= Zahlungsplan + Stornobedingungen);
- **lit. k** ausdrücklicher **Hinweis, dass kein Widerrufsrecht besteht** — Beherbergung mit
  festem Termin ist nach Art. 16 Abs. 1 lit. l ausgenommen (Kommissions-Leitlinien nennen
  Hotels und Ferienhäuser ausdrücklich);
- **lit. q** Hinweis, dass eine **Kaution verlangt werden kann, samt Bedingungen**;
- **Art. 6 Abs. 5**: die Angaben sind fester Vertragsbestandteil und dürfen **nicht geändert**
  werden → Snapshot ist Pflicht;
- **Art. 6 Abs. 6**: über nicht mitgeteilte Zusatzkosten muss der Verbraucher **nicht** zahlen;
- **Art. 8 Abs. 2** Button-Lösung („zahlungspflichtig bestellen") + **Art. 8 Abs. 7**
  Bestätigung auf dauerhaftem Datenträger inkl. Bedingungen.
- **Kurtaxe/Reinigung gehören in den ausgewiesenen Gesamtpreis**, auch wenn sie vor Ort
  gezahlt werden (EU-weite Booking.com-Zusage gegenüber der Kommission: „including … service-,
  cleaning- and resort fees, and local taxes … whether up front … or otherwise at the
  accommodation"). Das betrifft direkt **myBestDays** und den Pagebuilder.
- Pauschalreise-RL 2015/2302 greift bei reiner Beherbergung **nicht**.

**Folge für Schritt 6:** Storno-, Zahlungs- und Kautionsbedingungen + Widerrufs-Hinweis +
Gesamtpreis inkl. aller Pflichtabgaben müssen **vor** dem Bestellbutton stehen und in die
Buchungsbestätigung. Das ist kein „nice to have", sondern Zulassungsvoraussetzung für
myBestDays und die Pagebuilder-Seiten in 27 Ländern.

### 11.5 Korrektur einer Recherche-Aussage
Ein Rechercheergebnis behauptet, im Repo gebe es „kein Cancellation-Policy-Modell" — das
stimmt nur für den **Namen** `cancellation_policy`. Wir haben `booking_conditions` +
`booking_condition_refund_rules` (0165/0168), siehe Kapitel 1.
