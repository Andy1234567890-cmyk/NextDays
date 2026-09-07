# Plan — Lastenheft-Lücken schließen (Stand 07.09.2026)

## Stand der Umsetzung (07.09.2026, fortlaufend)

| Etappe | Stand | Migrationen |
|---|---|---|
| 1 Kleinkram | **fertig** | 0580–0582 |
| 2 Kachel-Dashboard | **fertig** (Bereichs-Überschriften nachgezogen) | — |
| 3 Events + Saison-Vorlagen | **fertig** | 0583, 0584 |
| 4 Buchungsangebot | **fertig** | 0586, 0587 |
| 5 Messaging | offen | 0589–0592 vorgesehen |
| 6 Aufgaben | offen | 0593–0595 vorgesehen |
| 7 CRM & Partner | **fertig** | 0596–0598 |
| 8 Standardtexte | offen | 0599, 0600 vorgesehen |
| 9 Erst-Login | offen | — |
| 10 Mitarbeiter-App | offen | — |
| 11 Typ-Ökosystem | offen | — |
| 12 ADRs | **fertig** | ADR-0024–0027 |

Alle eingespielten Migrationen sind live (`supabase/apply-migrations.sh`).
Befund beim Einspielen: 0584 wollte `season_templates` aus 0011 erweitern —
die Tabelle war aber in **0252** als Attrappe gelöscht worden; die Migration
legt sie jetzt samt RLS, revoke und Trigger neu an.

Grundlage: [REQUIREMENTS-GAP.md](REQUIREMENTS-GAP.md). Reihenfolge nach
Abhängigkeit und Wert. Jede Etappe endet mit Slice-Tests, ruff/pylint, tsc +
ESLint, Migration per `apply-migrations.sh`, Realtime-Prüfung, Wurzel-1–9-Check.

## Etappe 1 — Kleinkram mit vorhandenem Backend (1 Tag)
1. Logo-Upload: `application/pdf` in `LOGO_MIME` + Bucket-Migration (0067-Nachzug).
2. Saison-Palette: sieben Pastelltöne A–G mit Buchstaben-Zuordnung + freies Hex-Feld
   (`season-calendar.tsx`); DB-Check erlaubt es bereits.
3. `cpr_number` in `OwnerBase`/`OwnerUpdate` + Feld in `/eigentuemer/[id]`.
4. `boligtype`: Enum (`flexbolig|helaarsbolig|fritidshus`) in `properties/schemas.py`,
   Feld im Kartei-Stepper Stufe 1 + PDF; Labels in 24 Sprachen.
5. DK-Bank: Migration `owners.bank_reg_nr`/`bank_konto_nr` (nullable), Schema, UI.
6. Tagespreis-Reset: Client-Funktion für `POST /calendar/price-override` mit
   `price=null`, Knopf im Bulk-Dialog „Auf Saisonpreis zurücksetzen“.
7. `RECEIVE_SYSTEM_ALERTS` im Dispatcher auswerten (Empfängerkreis System-Warnungen).
8. Kartei Stufe 8: Grundpreis + offene Sperrungen anzeigen, Link zu Preise/Kalender.
9. Kartei: Druck-Knopf (`window.print` + `@media print`), Geheimtipp-Feld.

## Etappe 2 — Kachel-Dashboard (§2.1)
- `web/lib/dashboard-katalog.ts` (Kacheln = bestehende Dashboard-Widgets),
  `@dnd-kit` Raster, Größen s/m/l, ausblenden, Reset auf Rollen-Standard;
  gegen `GET/PUT/DELETE /dashboard-layout`; Realtime-Abo `dashboard_layouts`.

## Etappe 3 — Saison & Events (§2.3)
- Events: Slice `calendar` bekommt `GET/POST/PATCH/DELETE /calendar/events` +
  `event_periods` (n Zeiträume je Event, unterbrochen), Objektzuweisung,
  Farbe in Legende + Kalenderzelle; UI unter `/objekte/[id]/saisonpreise` Reiter „Events“.
- Saison-Vorlagen: tenant-weite `season_templates` (Migration, RLS) mit Kategorien
  + Zeiträumen, „Vorlage anwenden“ per Checkbox-Mehrfachauswahl → bestehender
  `apply`-Pfad. ADR dazu (ersetzt Stilllegung 0053 sauber).

## Etappe 4 — Buchungsangebot (§2.2)
- Migration `booking_offers` (tenant, property, Zeitraum, Gäste, Quote-Snapshot,
  Ablauf, Token-Hash, Status), RLS + revoke.
- Service: Quote aus `pricing/resolver`, Mail mit Bestätigungslink (Token), Stripe
  Checkout-Session für Anzahlung/Gesamt, Annahme → Reservierung + Nächte
  (idempotent über Token, Wurzel 2), Ablauf gibt nichts frei (kein Hold) —
  Alternative Hold-Nächte als Option.
- UI: Kalender-Aktion `reservation_quote` → Angebots-Wizard; Liste „Angebote“
  unter Reservierungen; öffentliche Annahmeseite im `builder`.

## Etappe 5 — Messaging (§2.4)
- Sendewege je Automation: `sendewege text[]` (`portal|email|sms`), Versand E-Mail
  über bestehenden Mailer, SMS über Twilio-Sink; Gastkontakt-Auflösung, fail-loud
  ohne Kontakt; UI Mehrfachauswahl neben Portal-Filter.
- Editor: `horizontalRule` aktivieren, Indent/Outdent, FontFamily-Extension mit
  Allowlist (nh3-Allowlist prüfen, Memory „Editor-Leiste muss Allowlist treffen“).
- Platzhalter: Chips im Feld-Picker `draggable`, Drop in TipTap an Cursor.
- Digitales Check-in-Formular: `guest_stay` Formular (Gäste, Ausweis, Ankunftszeit,
  Unterschrift), Migration `guest_checkin_forms`, Status `completed_at`;
  Auslöser `checkin_form_completed` in `inbox/ausloeser.py` + 0307-CHECK-Nachzug.

## Etappe 6 — Aufgaben (§2.5)
- Saisonfenster in `task_rules.recurrence` (`season_from`/`season_to` als MM-DD,
  jahresübergreifend) + UI.
- Endanker „vor nächstem Check-in“: `TaskTrigger.next_arrival`, Engine sucht
  Folgebuchung je Einheit, Fallback fail-loud ohne Folgebuchung (Ende offen).
- Inventar: `GET/PATCH/DELETE /tasks/inventory`, Bestandsbuchungen
  (`inventory_movements`, Migration), UI „Inventar“ (zentraler Pool + je Objekt),
  Verkauf an Gast als Addon-Kopplung.

## Etappe 7 — CRM & Partner (§2.6)
- Slice `crm`: Service/Router/Schemas für `leads` (Status-Workflow new→contacted→
  visit→contract→won/lost, Quelle-Werteliste, Notizen), `partners`, `deals`
  (Rabattart, Code, QR-Upload in privaten Bucket mit Magic-Byte-Prüfung).
- Permission `MANAGE_CRM`; UI `/crm` (Leads-Board + Partnerliste); Mobile später.
- Lead → Eigentümer + Objekt übernehmen (Konvertierung).

## Etappe 8 — Standardtexte (§5)
- Slice `content`: `content_blocks` (kinds: house_rules, checkout_rules,
  checkin_info, travel_guide, emergency_contacts, rental_terms) mit `body_i18n`,
  `content_assignments` per Checkbox-Mehrfachauswahl; Übersetzungsknopf wie Inbox.
- Gastportal/`builder` zeigt zugewiesene Blöcke in Gastsprache; Platzhalter
  `{{house_rules}}` etc. im Nachrichten-Katalog.

## Etappe 9 — Erst-Login (§5)
- `first_login_at` auf `users` und `portal_guests` (Migration), gesetzt im
  Login-/Code-Pfad (Wurzel 2: nur wenn null).
- `melde_erstanmeldung` in `notification_settings/ereignisse.py` (Admin-Push/Mail,
  Katalog-Kategorie), Willkommensnachricht je Rolle aus Vorlage (Mail/Portal).

## Etappe 10 — Mitarbeiter-Smartphone (§4.3)
- `mobile-nextdays`: eigene Staff-Tabs (Aufgaben, Kalender, Inventar, Ich);
  Screens Vertretung anfragen/annehmen, Abwesenheit + Verfügbarkeit, Inventar je
  Haus; Rolle `shift_lead` mit Dienstplan-Sicht. Jest + tsc.

## Etappe 11 — Unterkunfts-Ökosystem (§7.2)
- Pydantic-Teilschemata `type_attributes.typ` je `property_type` (glamping:
  Außenanlagen, Whirlpool/Sauna-Wartung, Brennholz; pitch: Stellplatznummer,
  Schrankencode, QR-Check-in; houseboat: Liegeplatz, Fäkalientank, Strom).
- Objekt-Editor: Reiter „Typ-Details“; Kartei Stufe 3/5: typabhängige Gewerke;
  Checklisten-Vorlagen je Typ (Regel-Vorlagen); Platzhalter je Typ
  (`{{barrier_code}}`, `{{pitch_number}}`, `{{mooring_rules}}`).
- Stellplatz-Check-in per QR (Gastportal-Link) + Schrankencode im Automail.

## Etappe 12 — Dokumentation & ADRs
- ADR-0022 „Preismodell: Module, Staffel, drei Provisionswege“ ersetzt ADR-0006.
- ADR-0023 „Saison-Vorlagen tenant-weit“ (Etappe 3).
- ADR-0024 „Ein Eigentümer je Objekt“ (0073) — Miteigentümer bewusst nicht.
- ADR-0005 (glatte Beträge): **Entscheidung des Nutzers** — umsetzen (Rundung
  überall) oder aufheben. Vorschlag: aufheben, Cent-Genauigkeit ist Portal-Realität.
- REQUIREMENTS-GAP.md, API.md, ARCHITECTURE.md nachziehen.

## Nicht in diesem Plan (extern blockiert oder entschieden)
- Revolut-Gateway (ADR-0011: Stripe primär).
- Booking.com-Inseratsimport (Channex bietet keinen Abruf).
- OTA-Neuanlage/Export (ADR-0012 offen, Anbieterentscheidung).
- Booking.com/Vrbo live verbinden (Betriebsvorgang im Kanalmanager, kein Code).
- Miteigentümer (bleibt bei 0073; siehe ADR-0024).
