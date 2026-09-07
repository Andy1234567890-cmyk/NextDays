# Anforderungs-Gap-Analyse — Lastenheft vs. Codebase

> Abgleich von [LASTENHEFT.md](LASTENHEFT.md) (Stand 13.05.2026) mit dem
> Code-Stand vom **07.09.2026** (Commit d3e36a3d, 579 Migrationen, 68 Slices).
> Jede Zeile trägt einen Code-Beleg; ohne Beleg gibt es keinen Status.
> Ersetzt die Fassung vom 13.07.2026, die i18n noch als „nicht umgesetzt“ führte.

> **Umsetzungsstand 07.09.2026:** Etappen 1, 2, 3, 4, 7 und 12 des Plans
> ([PLAN-LASTENHEFT-LUECKEN.md](PLAN-LASTENHEFT-LUECKEN.md)) sind gebaut und
> ihre Migrationen live (0580–0587, 0596–0598). Damit sind unter anderem
> geschlossen: Kachel-Dashboard (§2.1), Buchungsangebot und Tagespreis-Reset
> (§2.2), Events und Saison-Vorlagen (§2.3), CRM und Partner/Deals (§2.6),
> Boligtype/CPR/DK-Bank/Druck (§6) sowie die ADR-Lücken bei Preismodell,
> Rundung und Eigentümer-Zuordnung (§1/§7.1). Die Tabellen unten beschreiben
> den Befund VOR dieser Arbeit; offen bleiben Messaging (§2.4), Aufgaben-Reste
> (§2.5), Standardtexte und Erst-Login (§5), Mitarbeiter-App (§4.3) und das
> Typ-Ökosystem (§7.2).

## Legende
✅ vollständig · 🟡 teilweise (meist: Backend da, UI fehlt) · 🔴 fehlt ·
⚪ bewusst anders entschieden (ADR vorhanden) · ⚠️ Abweichung OHNE ADR

## Zusammenfassung

| Abschnitt | ✅ | 🟡 | 🔴 | Kernbefund |
|---|---|---|---|---|
| §1 Übergreifend | 2 | 1 | 1 | Glatte Beträge (ADR-0005) im Kalender bewusst verworfen, ADR nicht nachgezogen |
| §2.1 Dashboard | 1 | 3 | 0 | Kachel-Layout: Backend + Migration 0402 fertig, **null Frontend** |
| §2.2 Kalender | 5 | 1 | 1 | Herzstück steht; „Buchungsangebot“ ist ein toter Menüpunkt |
| §2.3 Saison/Event | 3 | 3 | 1 | Events nur DB + Lesepfad; Farbpalette entspricht nicht der Vorgabe |
| §2.4 Messaging | 5 | 0 | 5 | Trigger/Übersetzung stark; **kein E-Mail/SMS-Versandkanal** für Gastnachrichten |
| §2.5 Aufgaben | 7 | 2 | 1 | Regel-Engine bis Mobile; Saisonfenster + „vor nächstem Check-in“ fehlen |
| §2.6 CRM/Partner | 0 | 6 | 2 | **Seit 0013 nur Tabellen** — `crm`-Slice hat nur `/health` |
| §3 Schnittstellen | 5 | 2 | 4 | Airbnb live (18/38), Booking/Vrbo 0 verbundene Kanäle; Revolut nur Enum |
| §4 Rollen | 24 | 5 | 0 | Reifster Teil; Mitarbeiter-Smartphone-Screens auf „P3“ zurückgestellt |
| §5 Gäste-Portal | 4 | 2 | 3 | Widget fertig; `content_blocks` seit 0014 unangebunden; Erst-Login-Ereignis fehlt |
| §6 Kartei | 14 | 8 | 2 | Stufen 2–8 vollständig; Boligtype tote Spalte, CPR ohne Schreibpfad |
| §7.1 Preismodell | 0 | 2 | 2 | **Modul-Gates widersprechen ADR-0006** ohne Nachfolge-ADR |
| §7.2 Ökosystem | 3 | 2 | 6 | Enum + Dropdown da; typspezifische Felder/Templates komplett offen |

---

## §1 Übergreifend

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| Glatte Beträge, kein Cent/Øre | ⚠️🔴 | ADR-0005 + `PROJECT.md:35` fordern es; `packages/currency/src/index.ts:21` Default 2 Nachkommastellen; `web/components/kalender/calendar-board.tsx:303` begründet Cent-Genauigkeit („wie Rate-Grid/Channex“); nur 11 von 235 `formatCurrency`-Stellen runden | Fachliche Entscheidung nötig: ADR-0005 umsetzen oder aufheben |
| DE/DK/EN nativ | ✅ | `web/i18n/locales.ts` 24 Locales; `web/messages/{de,da,en}.json` je ~13.000 Schlüssel | Übererfüllt |
| Dänisch-Bug | 🟡 | Cookie-Auflösung `web/i18n/aufloesung.ts`, Empfängersprache 0335/0363 | Der konkrete Alt-Bug ist nicht benannt, Abschluss nicht belegbar |
| Mandantenfähig | ✅ | 0002 `tenants`, `current_tenant_id()` in RLS, 274 Migrationen mit `tenant_id` | — |

## §2.1 Custom Dashboard

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| Kacheln Drag&Drop / skalieren / ausblenden | 🟡 | Backend komplett: 0402 `dashboard_layouts`, Slice `dashboard_layout` (`GET/PUT/DELETE /dashboard-layout`), Schemas x/y/größe/ausgeblendet | **Frontend fehlt ganz**: 0 Aufrufe in `web`, referenzierte `web/lib/dashboard-katalog.ts` existiert nicht, keine DnD-Lib; `page.tsx` rendert statisch |
| Logo-Upload PDF/JPG/PNG | 🟡 | 0067 Bucket, `POST /buchhaltung/companies/{id}/logo` (`buchhaltung/service.py:1213`, SVG-Sanitizing) | PDF wird mit 415 abgelehnt (`LOGO_MIME` ohne pdf, Bucket ohne pdf) |
| Accordion-Seitenmenü | ✅ | `web/components/app-sidebar.tsx:712-788` Collapsible-Gruppen | — |
| Doppelte Menüs entfernt | 🟡 | eine Sidebar-Datei | `hr/` und `components/personal/` existieren parallel, Personal-Dublette nicht positiv belegt |

## §2.2 Kalender

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| Einzeltag-Klick → Popup | ✅ | `calendar-action-menu.tsx`, `calendar-board.tsx:974/1125` — 6 Optionen | — |
| Direktbuchung mit automatischen Aufschlägen | ✅ | `reservation-wizard.tsx` Quote; `pricing/resolver.py:1132-1205` Gebühren fest/Nacht/Gast, tierbedingt, Kanal-/Zeitraumgültigkeit | — |
| Buchungsangebot per Mail + Zahlungslink | 🔴 | Menüeintrag `reservation_quote` (`calendar-action-menu.tsx:107`) wird in `calendar-board.tsx` **nicht behandelt** → fällt in Direktbuchung; kein Angebots-Modell/-Endpunkt; Payment-Links nur für Nachberechnung (0386/0469) | Toter Menüpunkt; ganzes Angebotsmodul |
| Kalendersperrung | ✅ | `confirmBlock()`, Sperrantrags-Workflow `/kalender/sperrantraege` | — |
| Click-and-Hold X→Y | ✅ | `calendar-board.tsx:707-1000` (Drag, Lückenprüfung, Auto-Scroll) | — |
| Tagespreis im Kalender setzen/zurücksetzen | 🟡 | 0016 `price_overrides`; `POST /calendar/price-override` inkl. Reset + Channex-Gegenzustand (`calendar/service.py:848-884`); Bulk-Dialog setzt Preis | **Zurücksetzen aus UI unerreichbar**: keine Client-Funktion für `/price-override`, `setSeasonPrice` 0 Aufrufer, Bulk-Dialog kann nicht leeren |
| Menüpunkt „Preisüberschreibungen“ entfernt | ✅ | 0 Treffer in Sidebar/Messages/Routen | — |

## §2.3 Saison & Event

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| Taggenaue Saisons | ✅ | 0138 `property_season_assignments` start/end date; `season-calendar.tsx` Tag-Drag | — |
| Globale Templates per Checkbox | ⚠️🟡 | Checkbox-Kopie auf andere Objekte (`zu-anderen-objekten.tsx`, `POST /calendar/seasons/{id}/apply`) | Saisons sind objektgebunden; Template-Modell aus 0011 per **0053 stillgelegt** — Abweichung ohne ADR |
| Legende deckungsgleich, freie Farbe | 🟡 | DB erlaubt jeden Hex (0138), Legende + Zellen identisch | UI bietet nur 8 Palettenwerte, kein freies Farbfeld |
| Standardfarben A–G (Pastell) | 🔴 | `season-calendar.tsx:42-45` PALETTE = 8 gesättigte Tailwind-Töne | Falsche Palette, keine Buchstaben-Zuordnung |
| Sonder-Events mit unterbrochenen Zeiträumen | 🟡 | 0011 `events`/`event_periods`; gelesen von `pricing/recompute.py:918-928`, `engine.py` | **Kein Schreibpfad, keine UI, kein Endpunkt** — nur per DB anlegbar |
| Saison-Kategorien %, anlegen/löschen | ✅ | `GET/POST/PATCH/DELETE /calendar/seasons`, UI percent/fixed | — |

## §2.4 Messaging

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| Minutengenaue Trigger | ✅ | `inbox/schemas.py:536-540` offset minutes/hours/days + `send_time`; `inbox/scheduler.py` sekundengenau; 0303 | — |
| Anker Anreise-/Abreisetag | ✅ | `inbox/ausloeser.py:23-46`, 0515 | — |
| „3 Tage vor Anreise 19:00“ + Objektzeitzone | ✅ | `before_checkin`, `use_property_timezone`, 0258/0307 | — |
| Multi-Channel E-Mail/SMS/OTA-In-App | 🔴 | `channels` ist Portal-**Filter** (`planung.py:610-637`); einziger Sendeweg = Channex-Portalchat (`inbox/service.py:627-641`, 1017-1030); SMS nur für OTP/Betriebsmeldungen | E-Mail- und SMS-Sendeweg für Gastnachrichten je Automation |
| Ein-Klick-Übersetzung | ✅ | `inbox/fassung_uebersetzen.py` (Google v2, Platzhalter-Maskierung), `POST /inbox/languages/translate`, UI `sprach-fassungen.tsx`, 0363 | — |
| Editor fett/kursiv/unterstrichen/Listen | ✅ | `composer-editor.tsx:534-571` TipTap | — |
| Editor Trennlinien | 🔴 | `composer-editor.tsx:372-376` deaktiviert `horizontalRule` bewusst | — |
| Editor Einrückung, Schriftart | 🔴 | keine FontFamily-Extension, keine Indent-Knöpfe | — |
| Drag&Drop-Shortcodes | 🔴 | `feld-picker.tsx` Klick-Dialog an Cursor, kein `draggable` | Interaktion abweichend (funktional gleichwertig) |
| Trigger „Check-in-Formular ausgefüllt“ | 🔴 | 0 Treffer `checkin_form/online_checkin/meldeschein`; `guest_stay` hat nur Status-Check-in | Digitales Check-in-Formular existiert nicht |

## §2.5 Aufgaben & Checklisten

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| Auto-Aufgaben Endreinigung/Anreise-Check | ✅ | `tasks/engine.py sync_for_reservation`, `TaskTrigger arrival_day/departure_day`, 0272/0535, UI `/reservierungen/aufgaben/planmaessig` | Regelbasiert statt hart verdrahtet; `RegelDeckung` warnt |
| Kopplung Channel-Manager | ✅ | `bookings_sync.py:1881`, Storno räumt auf (`engine.py:60-70`) | — |
| Wiederkehrend X Tage/Wochen/Monate/jährlich | ✅ | `engine.py:279-325 _occurrences`, 0012 `task_rules`, UI `/regelmaessig` | — |
| Saisonal eingegrenzt („Winter 01.10.–31.03.“) | 🔴 | nur absolutes `starts_on/ends_on` (`schemas.py:461`), 0 Treffer saison/season in tasks | Jährlich wiederkehrendes Fenster über Jahreswechsel |
| Global oder Mehrfachauswahl Objekte | ✅ | `property_ids` leer = alle, `RegelDeckung` | — |
| Foto-Checklisten unbegrenzt je Raum, mobil | ✅ | `service.py:611-623`, Routen `/tasks/checklist/photo`, Mobile `TaskDetail.tsx:546-610` | — |
| Exakte Uhrzeiten | ✅ | `start_clock/end_clock`, Offsets, 0535 | — |
| Start „nach Check-out“ → Ende „vor nächstem Check-in“ | 🟡 | Start vorhanden (`TaskTrigger.check_out`) | Endanker auf die **Folgebuchung** fehlt (0 Treffer next_arrival/folgebuchung) |
| Büro-/Lagerinventar ohne Objekt | 🟡 | 0012 `inventory_items.property_id nullable`, `POST /tasks/inventory` | Nur ein POST; kein List/Update/Delete, keine Bestandsbuchung, keine UI — Stub |

## §2.6 CRM & Partner

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| Lead-DB Stammdaten | 🟡 | 0013 `leads` (name/address/phone/email), RLS 0015, Lockdown 0224 | `crm/router.py` hat **nur** `GET /health`; `table("leads")` 0 Treffer; keine UI |
| Lead-Quelle | 🟡 | `leads.lead_source` | kein Endpunkt, keine Werteliste |
| Objekt-Eckdaten Adresse/qm/Personen | 🟡 | `object_address/object_sqm/object_max_guests` | nur Schema |
| Notizen/Status | 🟡 | `notes`, `status default 'new'` | kein Workflow, keine UI |
| Partner Name/Anschrift/Ansprechpartner | 🟡 | 0013 `partners` | `table("partners")` 0 Treffer |
| Rabattart %/Fix | 🟡 | `discount_kind` Enum, `deals` | nur DB-Typ |
| Rabattcode | 🔴 | Spalte `deals.discount_code`; `property_discounts.promo_codes` sind Gast-Codes, nicht B2B | keine Einlösung/Validierung |
| QR-Code-Upload | 🔴 | Spalte `qr_code_path`; QR im Backend nur 2FA + Affiliate-Generierung | kein Upload-Endpunkt |

## §3 Schnittstellen

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| Native Zwei-Wege-APIs | ⚪ | ADR-0001: Aggregator Channex statt Direktzertifizierung | dokumentierte Abweichung |
| Airbnb | ✅ | OAuth (`airbnb_oauth.py`), ARI (`ari_push.py`), Content (`content_sync.py`, `airbnb_zimmer_push.py`), Gebühren-Import; live 18/38 Objekte (`veroeffentlichen.py:16-19`) | — |
| Booking.com | 🟡 | Katalog, Chat/Reviews/Gebühren/Steuerregime im Code | **0/20 verbundene Kanäle** live — nie in Betrieb |
| Vrbo/Expedia | 🟡 | Kanal-Enum, Provisionsmodell, iCal-Quelle | 0/20 live; kein `vrbo_*`-Modul |
| Webhooks | ✅ | `router.py:1210-1301` register/empfangen mit `secrets_match` | — |
| Revolut primär | ⚪🔴 | ADR-0011 kehrt ADR-0003 um (Stripe primär); Revolut nur Enum-Wert `payments/schemas.py:10`, `payments/README.md:288` „Adapter existiert NICHT“ | Revolut komplett unimplementiert |
| Stripe sekundär | ✅ (primär) | `stripe_client.py`, `webhook.py`, `identity.py`, 0081; zusätzlich PayPal | — |
| Import Objekte aus Airbnb | ✅ | `airbnb_uebernahme.py`, `airbnb_listing_import.py` (38 Felder), `airbnb_historie_import.py` | — |
| Import Objekte aus Booking.com | 🔴 | `booking_gebuehren_import.py:19-22`: „kein Inserats-Abruf“; nur Buchungs-/CSV-Import | Booking-Inserate nicht übernehmbar |
| Export/Neuanlage zu Airbnb/Booking | 🔴 | ADR-0012 Status „offen“: Channex kann nur verbinden; Airbnb Partner API geschlossen, Booking-Connectivity pausiert; NextPax-Anfrage offen | technisch beim aktuellen Aggregator versperrt |

## §4 Rollen & Berechtigungen

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| Toggle-Matrix je Konto | ✅ | `auth/permissions.py`, `granular_permissions.py`, UI `permission-groups.tsx`, `PATCH /account/users/{id}` | — |
| Admin voll | ✅ | `ROLE_CAPABILITIES[admin] = _ALL` | — |
| Co-Admin Eigentümer+Mitarbeiter, Aufgaben, Hausdaten, Inventar, Eigentümer-/Mitarbeiterdaten, Stamm-Zuweisung | ✅ | `_CO_ADMIN` (`permissions.py:108-152`), `staff_assignment_service.py`, 0019 | — |
| Co-Admin System-Warnungen | 🟡 | `RECEIVE_SYSTEM_ALERTS` deklariert | nur in Tests referenziert — kein Dispatcher wertet sie aus |
| Owner: Kalender + Legende | ✅ | `GET /portal/calendar`, `/portal/kalender`, Mobile `OwnerCalendar.tsx` | — |
| Owner: nur Vorname + Quelle, kein Gastpreis, Netto/Nacht | ✅ | `auth/guest_masking.py`, `public_portal/service.py:700-712` `owner_payout_per_night` | — |
| Sperrung beantragen → Admin-Push → Freigabe → Rückmeldung | ✅ | `POST /portal/block-requests`, `sperrantrag_meldung.py`, `/approve|/reject`, 0332/0333/0353/0377/0513 (Aufhebung) | übererfüllt |
| Zählerstände append-only | ✅ | 0015 nur select+insert, 0229 revoke, 0337 | — |
| Dienstleistungen direkt buchen → Aufgabe + Mitarbeiter-Meldung | ✅ | `public_portal/dienstleistungen.py`, 0330 Katalog (endreinigung/hauptreinigung/fenster/rasen/terrasse + Freitext), 0531/0538 | — |
| Benachrichtigungsmenü SMS/E-Mail/aus | ✅ | `notification_settings/katalog.py`, `/portal/benachrichtigungen` | — |
| Monats-/Jahresberichte + Abrechnungsstand | ✅ | `GET /portal/statements`, `/portal/earnings`, `/portal/berichte`, Mobile `OwnerEarnings.tsx` | — |
| Staff: keine Bewertungen/Umsätze/Finanzen | ✅ | `_STAFF` ohne VIEW_REVIEWS/VIEW_FINANCES/VIEW_OWNER_REPORTS, RLS 0136/0425 | — |
| Staff: persönlicher Aufgabenkalender | ✅ | `/tasks/mine`, Mobile `HostTaskCalendar.tsx`, `TaskDetail.tsx` | — |
| Staff: Inventarlisten je Haus | 🟡 | Capability + RLS 0136 | kein Screen in `mobile-nextdays` |
| Staff: Urlaub/Verfügbarkeit | 🟡 | `/personal/abwesenheiten`, `/verfuegbarkeiten`, 0541 | kein Screen in `mobile-nextdays` |
| Staff: Vertretung per Knopf | 🟡 | `POST /tasks/substitutions` + accept/decline, 0019/0403/0404/0415 | kein Knopf/Screen in `mobile-nextdays` |
| Staff: An-/Abreise ohne Namen/Beträge | ✅ | `VIEW_GUEST_LIMITED`, `mobile-nextdays/lib/tasks.ts:8` | — |
| Stamm-Mitarbeiter je Haus | ✅ | `staff_property_assignments` 0019 | — |
| Mitarbeiter-Smartphone-Oberfläche | 🟡 | `mobile-nextdays/lib/experience.ts:5` „Ausbau P3“ | staff/cleaner landen in Agentur-Tabs |

## §5 Gäste-Portal & Buchungsstrecke

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| White-Label-Gäste-Portal | 🟡 | Slices `guest_auth/guest_stay/guest_bookings/guest_messages/guest_reviews`, 0121 `property_guest_portal`, Renderer `builder/` | Gast-Portal-Fläche als eigene Route nicht belegbar (`gastgeber/` ist Host-App) |
| Admin-Konfiguration | ✅ | 0121 RLS + Felder self_checkin/hide_code_until_checkin | — |
| Erst-Login → Admin-Push | 🔴 | 0 Treffer; `ereignisse.py` (13 `melde_*`) ohne Erst-Login | kein Zustandsfeld, kein Ereignis |
| Erst-Login → Willkommensnachricht | 🔴 | „willkommen“ nur Baukasten-Vorlagen | kein Versandpfad |
| Zentrale dreisprachige Standardtexte | 🟡 | 0014 `content_blocks(kind, body_i18n)` + `content_assignments`, RLS/Realtime | **0 Python-Referenzen**; 0121:54-60 „noch nicht angebunden“; Check-out/Mietbedingungen als kind nirgends |
| Zuweisung per Checkbox | 🔴 | Tabelle da | kein Endpunkt, keine UI |
| Buchungs-Widget einbettbar | ✅ | `/website/widgets`, iframe-Generator `widgets-ansicht.tsx`, `builder/app/widget/[typ]`, CSP `builder/next.config.ts` | — |
| Modulare Buchungsstrecke | ✅ | `builder/components/buchungs-widget.tsx`, `/inserat/[id]`, `/checkout`, 0450–0452/0471 | — |
| An Kernsystem angebunden | ✅ | Slice `booking_engine`, `pricing/resolver.py` | — |

## §6 Kartei & 8 Stufen

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| Eigentümerdaten in Kartei | ✅ | `property_dossier/schemas.py LinkedOwner`, `GET /property-dossier/{id}/owner` | read-only aus `owners` (bewusst) |
| Adress-Split | ✅ | 0009 street/house_number/postal_code/city/country | Alt-Freitext `address` parallel |
| Miteigentümer | 🔴 | `co_owners` (0014) ohne jede Referenz; 0073 `unique(property_id)` verhindert Miteigentum | — (Entscheidung „ein Eigentümer je Objekt“, kein ADR) |
| PDF-Export | ✅ | `web/lib/dossier-pdf.tsx`, `dossier-pdf-button.tsx` | — |
| Druck | 🟡 | kein `window.print`/`@media print` in Kartei | nur über PDF |
| 1 Interne Hausnummer / Hausname | 🟡 | 0130 entfernte eigene Felder → `properties.house_number`/`title` | kein separates internes Feld |
| 1 Personen/qm | ✅ | 0129, read-only aus `max_guests/size_value` | — |
| 1 BFE | ✅ | 0009, `properties/schemas.py:233`, Stepper | — |
| 1 Boligtype | 🔴 | Spalte `properties.boligtype` (0009) mit **0 Treffern** in API/Web | tote Spalte |
| 1 CPR | 🟡 | 0127 Spalte, gelesen/angezeigt/PDF | `owners/schemas.py` ohne `cpr_number` → **kein Schreibpfad** |
| 1 Bank Reg.-Nr./Konto-Nr./Bankname | 🟡 | 0063 iban/bic/bank_name | DK-Format Reg.-Nr.+Konto-Nr. nicht modelliert |
| 2 Proces & Kontrakt | ✅ | `property_process` 5 Daten, GET/PUT | — |
| 3 Adgang & Teknik | ✅ | `property_access`, Türcode/WLAN in `property_guest_portal` (0296) | — |
| 4 Serviceaftaler | ✅ | `property_service_agreements` CRUD | — |
| 5 Håndværkere + Akut-Vollmacht | ✅ | `property_tradespeople`, `property_emergency_authority` | — |
| 6 Markedsføring | ✅ | `property_marketing` | — |
| 7 Husmappe | ✅/🟡 | Status + physische Mappe ✅; Geheimtipps nur Verweis auf Nachrichten | Geheimtipp-Feld in Kartei fehlt |
| 8 Grundpreis / Sperrung / Eigenbelegungs-Import | 🟡 | bewusst in pricing/calendar (0127:110) | in Stufe 8 weder Anzeige noch Link |
| 8 Plattform-Matrix + Launch-Termine | ✅ | `property_platform_launches` native/airbnb/booking/vrbo | — |

## §7.1 Preisstruktur

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| Kein Feature-Gating | ⚠️🔴 | ADR-0006 „keine Feature-Flags“ gilt formal; real `subscriptions/entitlements.py modul_aktiv()` in 5 Modulen (buchhaltung, pricing×2, dynpricing, schloesser), 0117 `tenant_module_entitlement`, Verkaufsfläche `/erweiterungen` | Nachfolge-ADR fehlt |
| 0 % Buchungsgebühr | ⚠️🟡 | eigene Website 0 % (`payments/service.py:1166`); OTA 0,5 % (0310, `COMMISSION_RATE_STANDARD`), myBestDays 8 % (`MARKETPLACE_FEE_BPS_STANDARD`), DP 0,5 % | ADR-0006 sagt Provision nur Portal; real auch OTA |
| Skalierung nur über Einheiten | 🟡 | `deploy/billing/seed_stripe_prices.py:185-188` graduated je Objekt | plus Modul-Festpreise, Schloss je Gerät, Provisionen |
| ADR aktuell | 🔴 | ADR-0006 „akzeptiert“, nicht superseded | neuer ADR: Module, drei Provisionswege, Staffel |

## §7.2 Unterkunfts-Ökosystem

| Anforderung | Status | Beleg | Was fehlt |
|---|---|---|---|
| `property_type`-Enum | ✅ | 0009, `properties/schemas.py:43-50`, `web/lib/property-meta.ts` | — |
| Dropdown beim Anlegen | ✅ | `new-property-button.tsx:143-157` | — |
| Typ steuert Checklisten | 🔴 | 0 Treffer `property_type` in `features/tasks` | Template-Mapping fehlt |
| Typ steuert Shortcodes | 🔴 | keine typabhängige Auswahl | — |
| `type_attributes` je Typ (Pydantic) | 🟡 | Spalte genutzt für pricing/beds/availability/location/messaging | keines der ADR-0007-Attribute, keine Modelle je Typ |
| Glamping: Whirlpool/Sauna/Brennholz | 🔴 | nur Amenity/Gebühr `hot_tub` | Wartungs-/Onboarding-Felder |
| Glamping: Wetter-Sondersaison | 🔴 | — | — |
| Stellplatz: QR-Check-in/Zuweisung/Schrankencode-SMS | 🔴 | 0 Treffer | — |
| Hausboot: Liegeplatz/Fäkalientank/Strom | 🔴 | nur Gebühr `water_craft_mooring` | — |
| Handwerker je Typ | 🟡 | `trade` Freitext | UI nur 4 Ferienhaus-Gewerke |
| DK-Felder nullable | ✅ | 0009/0127 | — |

---

## Muster hinter den Lücken

1. **Fertiges Backend ohne Oberfläche** (größte Klasse): Kachel-Dashboard (0402),
   Tagespreis-Reset, Events (0011), Inventar (0012), Vertretung/Abwesenheit/
   Inventar im Mitarbeiter-Client, Mitarbeiter-Erlebnis in `mobile-nextdays`.
2. **Tabellen seit 0013/0014 ohne eine Codezeile**: `leads`, `partners`, `deals`,
   `content_blocks`, `content_assignments`, `co_owners`; Spalten `boligtype`,
   `deals.discount_code/qr_code_path`.
3. **Bewusste Abweichungen ohne ADR**: glatte Beträge (ADR-0005 verworfen),
   Saison-Templates (0053), Feature-Gates + Provisionen (ADR-0006), ein
   Eigentümer je Objekt (0073).
4. **Bewusste Abweichungen mit ADR** (in Ordnung): Channex statt Direkt-API
   (0001), Stripe statt Revolut (0011), OTA-Neuanlage offen (0012).
5. **Komplett offen**: Buchungsangebot, E-Mail/SMS-Gastversand, digitales
   Check-in-Formular, Erst-Login-Ereignis, CRM/Partner-Funktion, §7.2-Typfelder.

## Kurzfristig billig schließbar
PDF in `LOGO_MIME` + Bucket 0067 · Saison-PALETTE auf A–G-Pastell + freies
Hex-Feld · `cpr_number` in `owners/schemas.py` · `boligtype` ins Schema + Stepper
· Tagespreis-Reset-Knopf gegen den vorhandenen Endpunkt · `reservation_quote`
aus dem Menü nehmen oder bauen · `RECEIVE_SYSTEM_ALERTS` im Dispatcher auswerten.

## Entscheidungen, die der Nutzer treffen muss
- ADR-0005 (glatte Beträge): umsetzen oder aufheben?
- ADR-0006 (kein Gating, 0 %): durch neuen ADR mit Modul-/Provisionsmodell ersetzen?
- CRM/Partner (§2.6) und Standardtexte (§5): bauen oder aus dem Lastenheft streichen?
- §7.2 Typ-Ökosystem: Roadmap-Position?
- OTA-Neuanlage (ADR-0012): Aggregator-Wechsel (NextPax/Beds24) oder streichen?
