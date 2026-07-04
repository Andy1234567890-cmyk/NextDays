# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.
Format orientiert an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased] — konsolidierter Stand Juli 2026

Sammelnachtrag: zwischen dem Eintrag unten (Mai 2026, ~Migration 0015) und heute
sind die Migrationen 0016–0090 sowie das komplette Dashboard entstanden. Die
wichtigsten Punkte konsolidiert:

### Hinzugefügt
- **Objektlisten strikt nach Betriebsart**: `GET /properties` (und
  `owners/available-properties`) filtern serverseitig nach
  `tenants.accommodation_type` — Hotel sieht nur Zimmertypen, Ferienvermietung
  nur Ferienobjekt-Typen (Typ-Gruppen `VR_TYPES`/`HOTEL_TYPES` +
  `types_for_accommodation()` in `properties/schemas.py`, Spiegel von
  `lib/property-meta.ts`). Damit zeigen Kalender (alle Views + Buchungs-Wizard),
  /objekte, /stop-sell und alle Auswahl-Dialoge nur noch betriebsart-passende
  Objekte; `create`/`update` lehnen betriebsfremde Typen mit 422 ab.
- **USt-Satz je Gebühr**: Gebühren im Preis-Setup tragen optional einen eigenen
  Satz (`fees[].taxRate`, z. B. Frühstück 19 % neben Logis 7 %; leer =
  Übernachtungssatz). Der Satz wandert als Snapshot durch Resolver →
  `quote_items[].tax_rate` → Rechnung (Prioritätskette: Kleinunternehmer →
  Zeilen-Satz → Abgabe 0 % → `lodging_tax_rate`); Bestand/Channex unverändert.
- **Rechnungssprache = Gastsprache** (Migration 0099, `invoices.language`):
  Belegtexte aus Buchungen (Aufenthalts-Label, Kopftext, Einheit, Addon-Namen
  aus dem mehrsprachigen jsonb) entstehen in der Gastsprache — neuer
  Begriffskatalog `buchhaltung/doc_i18n.py` (24 EU-Sprachen, Pluralregeln,
  Datumsformate). PDF-Beschriftungen: `useDocumentTranslation` von 3 auf
  24 Sprachen erweitert (`hooks/pdf/document-translations.ts`), Restdeutsch in
  ItemsTable/TotalsDisplay/Templates auf den Hook umgestellt; der
  Versand-Dialog belegt die Sprache aus dem Beleg vor (24er-Auswahl).
- **Dokument-Dialog direkt im Kalender**: „Ansehen & versenden" im
  Buchungs-Slider (nach Check-out und bei bestehender Rechnung) öffnet die
  PDF-Vorschau (Download/Druck) ohne Seitenwechsel — `lib/invoice-document.ts`
  mappt die Backend-Rechnung auf die Dokumentform des Buchhaltungs-Bestands;
  derselbe Mapper repariert den Nachladepfad des SendDocumentModal
  (snake_case-Antwort wurde bisher roh durchgereicht).
- **Check-in/Check-out + Zimmerrechnungen aus Buchungen** (Migrationen
  0091/0092): echte Front-Desk-Aktionen im Kalender-Buchungs-Slider
  (`POST /reservations/{id}/check-in|check-out`, persistiert in
  `checked_in_at`/`checked_out_at`; „Eingecheckt" ist keine Datums-Ableitung
  mehr). Der Check-out erzeugt verpflichtend eine **finale Rechnung mit
  GoBD-Nummer** über den neuen Booking→Invoice-Builder
  (`buchhaltung/reservation_invoice.py`, eine Quelle der Wahrheit):
  Positionen aus `reservations.quote_items` (neues `kind`-Feld klassifiziert
  Zeilen; Abgaben wie Kurtaxe → 0 % USt) + `reservation_addons`
  (Snapshot-Steuersatz), Brutto→Netto-Rückrechnung, Gast→Debitor-Brücke
  (`customers.guest_id`, Kundennummern `KD-` über den Nummernkreis),
  Doppelrechnungs-Schutz per Unique-Index, `invoices.reservation_id`.
  Neuer Tenant-Steuersatz `tenant_billing_profile.lodging_tax_rate`
  (Firmenprofil-Modal „USt-Satz Übernachtung", bewusst ohne Default —
  fehlt er, schlägt die automatische Rechnung mit klarer Meldung fehl).
  Erstellformular `/buchhaltung/rechnungen/neu`: Buchungs-Picker „Aus
  Buchung übernehmen" + `?reservation=`-Deeplink (Vorbefüllung via
  `GET /buchhaltung/invoice-preview`, nur eingecheckte Buchungen);
  Rechnungsliste fokussiert `?invoice=`. Channex-Resync überschreibt
  abgeschlossene Aufenthalte nicht mehr; `invoices`/`invoice_line_items`
  sind jetzt in der Realtime-Publikation (Subscription war stumm).
  Hotel-Terminologie: „Lieferdatum" → „Leistungsdatum"/„Aufenthalt";
  Status `finalized` ist stornierbar; tote Alt-Redirects
  (`/dashboard/company/…`) auf `/buchhaltung` umgebogen. NEU dazu:
  **Storno-Endpunkt** `POST /buchhaltung/invoices/{id}/storno` (der
  Storno-Dialog rief bisher eine nicht existente Route auf) — erzeugt den
  negierten ST-Beleg, setzt das Original auf `cancelled` (gibt den
  Unique-Index für eine korrigierte Buchungsrechnung frei), idempotent mit
  Selbstreparatur. Gäste-Fix: der Gast-Resolver schreibt jetzt
  Vorname/Nachname/Sprache strukturiert in die Gästemappe (0046-Felder);
  Migration 0093 backfillt Bestandsgäste, 0094 nimmt soft-gelöschte
  Debitoren aus dem Gast-Unique. Rabatt-Positionen (Gesamtrabatt) werden
  serverseitig jetzt korrekt ABGEZOGEN und mindern die USt-Bemessung
  (vorher: Beleg wich von der Anzeige ab / USt-Ausweis überhöht).
- **AGB in allen 24 EU-Amtssprachen** (Vorbereitung Stripe-Custom-Genehmigung):
  Agentur-AGB in `apps/web` (öffentliche Route `/agb`, Sprache folgt dem
  App-Sprachumschalter; Inhalte als TS-Module unter `content/legal/agb/`,
  Loader-Map erzwingt Vollständigkeit aller 24 Sprachen zur Build-Zeit) und
  Gast-AGB in `plattform/` (Route `/agb?sprache=<code>` mit Sprachauswahl).
  § 5 verankert das [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full)
  nach Stripes offiziellem Empfehlungstext; der „Zahlungen aktivieren"-Dialog
  und das Signup verlinken AGB + Stripe-Vertrag (`legal`-Namespace in allen
  24 Message-Katalogen). Betreiber-Firmierung ist bewusst Platzhalter —
  vor Veröffentlichung ergänzen; juristische Prüfung ausstehend.
- **Page-Builder** (Migrationen 0086/0087, [ADR-0013](docs/decisions/0013-page-builder-renderer-editor-trennung.md)):
  visueller craft.js-Editor im Dashboard (`apps/web`, Route `/website`),
  neuer API-Slice `site_config` (Branding, Custom-Domains via Cloudflare for
  SaaS, Seiten/Blöcke, Start-Templates, HMAC-Draft-Token) und eigenständige
  Renderer-App `builder/` (Host→Tenant-Middleware, rendert nur veröffentlichte
  Blöcke; Port 3200, eigenes Dockerfile). Spec: `docs/FRAMER-FEATURES.md`.
- **Betriebsart** `tenants.accommodation_type` (`vacation_rental | hotel`,
  Migration 0090): Wahl im 5-Schritte-Onboarding, steuert Sidebar-Navigation
  und Begriffe im Dashboard.
- **Reisebüro-/Partner-Kartei** `travel_agencies` (Migration 0088): Verträge
  nach Jahren, Saison-Preiszeilen, Kontakte, Vertragsdokumente.
- **Verkaufsstopp (Stop-Sell)** mit Channex-Push (Migration 0089, Endpunkte
  `GET/POST /calendar/stop-sell`, `POST /calendar/stop-sell/clear`) inkl.
  Reisebüro als Adressat der Stop-Sale-Meldung.
- **Redis-Rate-Limiting** für die API (`core/ratelimit*.py`, 429 +
  `Retry-After`/`X-RateLimit-*`) — Betrieb: `deploy/RATE-LIMITING.md`.

### Behoben (Stop-Sell-Integrität)
- **Stop-Sell sperrt jetzt ALLE Kanäle**: die eigene Buchungsstrecke
  (`booking_engine`) und die interne Rezeptions-Buchung (`reservations.create`)
  prüfen explizit die `stop_sell`-Tabelle und lehnen mit 409 ab. Vorher war ein
  Stop-Sell-Tag nur zufällig über `availability=blocked` geschützt — ein
  Sync-Verzug hätte eine Doppelbuchung erlaubt.
- **Stop-Sell nie auf gebuchten Tagen**: `set_stop_sell` und der Channex-Import
  überspringen `availability=booked`-Tage (`_booked_dates`); `set_stop_sell`
  liefert `{stopped_days, skipped_booked}` und pusht nur die tatsächlich
  gesetzten Tage an Channex (nicht mehr die rohen Range-Grenzen).
- **Stop-Sell-Echo-Loop geschlossen**: der ARI-Import überschreibt bestehende
  `source='manual'`-Stops (mit `agency_id`/`reason`) nicht mehr zu anonymen
  `channex`-Zeilen — er schreibt nur noch Tage, die es lokal noch nicht gibt
  (idempotent, kein Realtime-Bump).
- **Import ohne aktiven Kanal**: `import_ari_for_property` überspringt Objekte
  ohne aktive Kanal-Verbindung (`_has_active_connection`, symmetrisch zum
  Push-Gate). Ohne verbundenen Kanal meldet Channex per Default
  `availability=0`/`stop_sell` für alle Tage; der Import hätte das als flächiges
  „gesperrt" + massenhaft anonyme Stop-Sells zurückgeschrieben.
- **Stop-Sell-Seite zeigt Buchungen**: gebuchte Tage erscheinen mit Gastname
  (nicht als anonymes Schloss), sind nicht auswählbar; das Panel meldet
  Überschneidungen mit Buchungen und lässt manuelle Stops wieder aufheben.
- **Terminologie**: durchgängig „Stop-Sell" (statt „Verkaufsstopp"/„Stop-Sale")
  in allen 24 Locales, Kalenderbalken und Dialogen.

### Geändert
- **Zahlungs-Gateway: Stripe Connect Custom ist primär** ([ADR-0011](docs/decisions/0011-zahlungs-gateway-stripe-primaer.md),
  ersetzt ADR-0003); Revolut bleibt sekundär im Adapter-Interface.
- **Realtime-Client-Fix** (`apps/web/lib/use-realtime.ts`): dedizierter
  Supabase-Client nur für Realtime, `realtime.setAuth(App-JWT)` **vor**
  `subscribe()` — vorher liefen Subscriptions als `anon` und RLS filterte
  alle Events weg.

---

## [Unreleased] — Stand Mai 2026

### Hinzugefügt
- Monorepo-Gerüst (`apps/web`, `apps/api`, `packages/shared`, `docs/`).
- Infrastruktur: `docker-compose.yml` (FastAPI + Redis), `supabase/config.toml`,
  `.env.example`-Vorlagen.
- FastAPI `core/`: Config (`SecretStr`), Logging (structlog), Supabase-Client-Factory
  (Anon + Service-Role), JWT-Sicherheit (HS256 → `AuthContext`, `CurrentUser`).
- 12 Vertical Slices mit `router`/`service`/`schemas`/`tests` und Health-Endpoints
  unter `/api/v1`.
- `auth`-Slice voll: Registrierung (Tenant + Owner, atomar mit Rollback), Login,
  `/me`, `require_role`-Guard.
- Supabase-Migrationen `0001`–`0008`: Kern-Tabellen + Marktplatz-Tabellen (Phase 2),
  Enums, Checks, Indizes, `current_tenant_id()`, RLS auf allen Tabellen,
  `availability` `UNIQUE(property_id, date)` gegen Double-Bookings.
- Vollständige Dokumentation: README, `docs/ARCHITECTURE.md`, `docs/SETUP.md`,
  `docs/CONTRIBUTING.md`, `docs/API.md`, `LICENSE`, `.github/`-Templates.
- ADR-0001: Channel-Manager-Architektur (Direkt vs. Aggregator).

### Geändert (Lastenheft-Scope, Stand 13.05.2026)
- Lastenheft + Ergänzungs-Modul aufgenommen (`docs/LASTENHEFT.md`), Gap-Analyse
  & Roadmap (`docs/REQUIREMENTS-GAP.md`).
- Datenmodell erweitert auf **38 Tabellen** (Migrationen 0009–0015), gegen echte
  Postgres-Instanz verifiziert (alle mit RLS). Neu: Saisons/Events, Aufgaben/
  Checklisten/Inventar, CRM/Partner, Messaging-Trigger, Content-Blöcke,
  Sperrungs-Workflow, Zählerstände (append-only), Miteigentümer, Dashboard-Layouts,
  unit-basiertes Preismodell.
- Rollen-Enum: `+ admin`, `+ co_admin`.
- `properties`: `property_type`-Enum + `type_attributes` (Unterkunfts-Ökosystem),
  Adress-Split, DK-Onboarding-Felder.
- `payments`: `stripe_ref` → `gateway_ref` + `gateway`-Enum; Gateway-Adapter
  (Revolut primär, Stripe sekundär).
- Neue Slices: `tasks`, `crm`, `dashboard`, `content` (Health + Struktur).
- Marketing-Website als entkoppelter Top-Level-Ordner `marketing/` (ADR-0002).
- ADRs 0002–0007 ergänzt.

### Offen (Stand Mai 2026 — inzwischen überholt, siehe konsolidierten Eintrag oben)
- Frontend (Dashboard, Portale, i18n DE/DK/EN) noch nicht implementiert.
- Slice-Geschäftslogik (außer auth) folgt gemäß Roadmap.
- Revolut/Stripe-Gateway-Calls, Channel-Adapter, OCR noch Platzhalter.
