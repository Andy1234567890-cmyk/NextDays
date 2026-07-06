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

### Behoben (kritische Befunde der Bug-Jagd 07/2026)
- **Doppelbuchung DB-seitig ausgeschlossen** (Migration 0104): Reservierung +
  Kalender-Belegung + `ari_outbox`-Eintrag entstehen atomar über die RPC
  `create_reservation_atomic` (Advisory-Lock je Objekt, guarded
  `availability`-Upsert). Zusätzlich EXCLUDE-Constraint
  `reservations_no_local_overlap` (btree_gist, `daterange &&`) als Backstop —
  zwei gleichzeitige Buchungen desselben Zeitraums können nicht mehr beide
  durchkommen (`booking_engine.create_public_booking`, `reservations.create`;
  `move()` validiert den Ziel-Zeitraum jetzt VOR dem Kalender-Umbau). OTA-
  Importe (`source_channex_booking_id`) sind vom Constraint ausgenommen — echte
  Überbuchungen bleiben lokal sichtbar.
- **Kein verlorener Verfügbarkeits-Push mehr**: die `ari_outbox`-Zeile
  (`availability=0`) wird in DERSELBEN Transaktion wie die Reservierung
  persistiert (statt erst im Worker); Freigaben (Storno/Move) schreiben die
  Outbox-Zeile vor dem Job-Enqueue. Scheitert das Einreihen, zieht der
  `process_ari_outbox`-Tick den Push nach — der gebuchte Tag bleibt nie still
  bei Booking.com offen.
- **Rechnungsnummern race-sicher** (Migration 0105): `number_sequences` mit
  `UNIQUE NULLS NOT DISTINCT`; `next_document_number()` legt den Erst-Zähler
  per `INSERT … ON CONFLICT DO NOTHING` + erneutem `FOR UPDATE` an — zwei
  parallele erste Checkouts bekommen RE-0001/RE-0002 statt zweimal RE-0001.
  Backstop: partieller Unique-Index `invoices_tenant_number_uidx` (GoBD).
- **Cross-Owner-Leck in Abrechnungen geschlossen**: `owner_statements` erzwingt
  Owner-Self-Scope (`owners.user_id` → eigene `owner_id`) in `list`/`get`/
  `preview`; alle Schreibpfade (generate/update/finalize/cancel/delete/
  expenses) sind für die owner-Rolle gesperrt (403, §4.2 read-only).
- **Internes Cron-Secret getrennt** (`INTERNAL_CRON_SECRET`): die internen
  tenant-übergreifenden Endpunkte (pricing/recompute, channel_manager/
  reconcile, owner-statements/auto-run, inbox/dispatch-*) akzeptieren nicht
  mehr das outbound an Channex geteilte `CHANNEX_WEBHOOK_SECRET`; Vergleich
  zeitkonstant, ohne konfiguriertes Secret sind die Endpunkte deaktiviert (503).
- **Worker-Doppelausführung beendet**: laufende Jobs refreshen `locked_at` per
  Heartbeat (60 s) — der Reaper (300 s) requeued nur noch Jobs toter Worker,
  nicht mehr legitime Langläufer (reconcile über hunderte Objekte);
  `_finish`/`_retry`/`_defer` schreiben nur noch den EIGENEN laufenden Claim
  (`locked_by`-Guard). Migration 0106 sperrt `claim_jobs`/`requeue_stuck_jobs`
  gegen anon/authenticated (nur noch service_role).

### Behoben (2. Bug-Jagd-Runde 07/2026 — 31 verifizierte Befunde)
Zweiter Multi-Agenten-Loop (86 Agenten, adversariell 2-fach verifiziert) über den
deployten Stand; alle 31 Befunde gefixt (2 Critical, 15 High, 12 Medium, 2 Low):
- **Owner-Sperre in der Betriebsbuchhaltung** (§4.2): die owner-Rolle besitzt
  zwar OWNER_REPORTING (für die eigene Auszahlungs-Abrechnung), hat in der
  tenant-weiten Debitorenbuchhaltung aber nichts zu suchen — sie konnte vorher
  Rechnungen/Kunden-PII ALLER Objekte lesen UND schreiben. Jetzt hart 403
  (Lesen + Schreiben), Owner-Finanzsicht ausschließlich /owner-statements.
- **Finalisierte Rechnungen GoBD-unlöschbar/unänderbar**: `delete_invoice`/
  `update_invoice` prüfen nicht mehr nur das nie gesetzte `is_locked`, sondern
  Status + vergebene Nummer — nur echte Entwürfe ohne Nummer sind mutierbar.
- **Nummernkreis serverseitig + nur bei Finalisierung**: `create_invoice_from_bestand`
  zieht die GoBD-Nummer atomar über `next_document_number` (ignoriert die
  fälschbare Client-Nummer), Entwürfe ziehen KEINE Nummer mehr (keine Lücken);
  der Client fabriziert keine `Date.now()`-Nummer mehr; Duplikat-Kollision → 409.
- **owner_statements**: als `hidden_from_owner` markierte Ausgaben werden dem
  Eigentümer weder gelistet noch (bei Live-Summen) eingerechnet.
- **booking_engine**: `create_public_booking` bucht nur noch `active`-Objekte
  (nicht draft/inactive), bestimmt den Preis SERVERSEITIG (Gast kann
  total_amount nicht mehr auf 0 setzen), pusht Channex asynchron über die Queue
  und stößt Dynamic-Pricing-Recompute an.
- **reservations**: `move()` prüft jetzt Stop-Sell; `cancel()`/`move()` geben
  Nächte NICHT frei (und pushen kein availability=1), die noch von einer anderen
  aktiven (z. B. OTA-)Buchung belegt sind.
- **ari_outbox**: eine ältere pending-Zeile wird von einer neueren überholenden
  Absicht supersedet (kein Wieder-Öffnen real belegter Tage); done-Update mit
  pending-Guard.
- **channel-manager**: `/bookings` maskiert Beträge + Buchungsquelle rollen-
  konform (staff/cleaner sehen keine Umsätze/OTA-Namen); Topologie-Lese-
  Endpunkte (properties/channels/status) verlangen MANAGE_PROPERTY_SETTINGS.
- **Inbox-Doppelversand** geschlossen: atomares Claim (`UPDATE … WHERE
  status='pending'`) in Timer + Cron beider Dispatch-Pfade.
- **Cloudflare-Custom-Hostname** wird bei DB-Insert-Fehler zurückgerollt (keine
  Waise).
- **enqueue_job-Coalescing** (Migration 0108): Coalescing nur noch gegen
  wartende ('queued') Jobs — ein Update gegen einen laufenden Job erzeugt jetzt
  einen neuen queued-Job (die Änderung geht nicht mehr lautlos verloren).
- **Rate-Limit-Fairness** pro IP gekeyt (kein Cross-Tenant-DoS über unsignierte
  tenant_id); **Channex-Budget** meldet retry_after nur der blockierenden Ebene;
  **Stripe-Webhook** claimt Events atomar (ON CONFLICT) und gibt sie bei
  Verarbeitungsfehler frei (Retry); **Addon-Käufe** idempotent (Migration 0109,
  Unique-Index gegen Doppelklick); Frontend: PDF-MwSt-Feldname korrigiert,
  Monatsgitter abonniert alle preis-speisenden Tabellen (Realtime),
  Banking-Abgleich zeigt die echte Transaktions-Währung (kein €-Hardcode).

### Behoben (3. Bug-Jagd-Runde 07/2026 — 30 verifizierte Befunde)
Dritter Multi-Agenten-Loop über den deployten Stand; alle 30 Befunde gefixt
(2 Critical, 13 High, 6 Medium, 9 Low). Migrationen 0110–0113. Kernpunkte:
- **ari_outbox-Superseding tag-genau + im schnellen Pfad**: der Verfügbarkeits-
  Push überspringt nur die von einer NEUEREN Outbox-Zeile abgedeckten TAGE
  (statt ganze Zeilen bei Teil-Überlappung zu verwerfen) und tut das auch im
  Sofort-Push, nicht nur im Cron — kein still verlorener/überschriebener
  availability-Wert mehr.
- **Doppel-Storno + Doppel-Addon DB-seitig ausgeschlossen** (0110/0109): je
  Original genau ein Storno (`invoices_storno_per_original_uidx`), je
  Reservierung ein aktives Addon; Gäste-Dedup `(tenant_id, lower(email))` (0113);
  Teilrückerstattungs-Status `partially_refunded` (0111).

### Behoben (4. Bug-Jagd-Runde 07/2026 — 22 verifizierte Befunde)
Vierter Multi-Agenten-Loop (66 Agenten, adversariell 2-fach verifiziert) über den
deployten Stand; alle 22 Befunde gefixt (1 Critical, 11 High, 5 Medium, 5 Low),
ohne neue Migration (reine Code-Fixes gegen den 0104–0113-Stand):
- **Zusatzleistungen werden jetzt kassiert** (Critical): `create_public_booking`
  reicht die gewählten Add-ons in den Preis-Quote → `total_amount` (und damit der
  Stripe-PaymentIntent) enthält sie. Zuvor blieben gebuchte Add-ons `pending` und
  wurden nie belastet.
- **Eingecheckter Gast nicht mehr verschiebbar**: `move()` lehnt eine bereits
  eingecheckte Reservierung ab (409) — sonst würden belegte Nächte freigegeben und
  als `availability=1` an OTAs gepusht, während der Gast noch im Zimmer ist.
- **OTA-Storno gibt nur die wirklich freigewordenen Tage frei**: der Channex-Push
  läuft tag-/quellengenau (nicht pauschal der ganze Zeitraum) — ein überlappender
  manueller Block/Fremdkanal-Tag bleibt gesperrt (kein Overselling).
- **Superseding ignoriert gescheiterte Pushes**: `_newer_covered_days` zählt nur
  `pending`/`done`-Outbox-Zeilen als Supersessor — eine `failed`-Zeile unterdrückt
  keine ältere echte Sperre mehr.
- **Preis-/Umsatz-Maskierung für Owner geschlossen (§4.2)**: Dashboard-Umsatz-KPI
  (`revenue_30d=None` ohne `PM_BOOKING_TOTAL`) und die Preis-Endpunkte
  `pricing/effective`+`/quote` (jetzt hinter `PM_BOOKING_TOTAL`) geben einem
  Eigentümer keine Gesamtpreise mehr.
- **Storno nur auf ausgestellte Rechnung**: ein Entwurf (`draft`,
  `invoice_number=NULL`) lässt sich nicht mehr stornieren (keine verbrannte
  ST-Nummer / Gutschrift auf Nicht-Beleg / GoBD-Verstoß).
- **Cross-Tenant-DoS im Rate-Limit entschärft**: beim listings-Bucket wird das
  IP-Limit VOR dem globalen Tenant-Zähler geprüft — eine gefälschte
  Opfer-tenant_id von wenigen IPs kann dessen Fenster nicht mehr vollschreiben.
- **PDF-Summen: Rabatt-Positionen zählen negativ**, `taxGrouped` wird bei
  gemischten Sätzen aus den Positionen abgeleitet (kein falsches Kopf-Satz-Label).
- **Weitere**: Add-on-Teilkollision verliert keine neuen Add-ons mehr
  (Einzel-Insert); Add-on-Fehler nach committer Buchung kippt sie nicht (kein
  500 + 409-Retry-Sackgasse); Inbox-`sending`-Reaper (verlorene geplante Nachricht
  läuft nach Crash wieder an) + Thread-Scope für `cancel_scheduled`; Channex-Budget
  zählt pro echtem HTTP-Round-Trip (auch 429-Retries); Reconcile-Coalescing über
  Wall-Clock-Bucket (Cross-Instance/Restart); Gäste-Resolver findet mixed-case
  E-Mails (case-insensitiv, kein 500); Kalender-KPIs mischen keine Währungen mehr;
  Channex-Webhook-Secret zeitkonstant verglichen; Forecast-Training paginiert
  (kein stiller 1000-Zeilen-Cap).

### Behoben (5. Bug-Jagd-Runde 07/2026 — 17 verifizierte Befunde)
Fünfter Multi-Agenten-Loop über den deployten Stand; alle 17 Befunde gefixt
(6 High, 8 Medium, 3 Low). Migration 0114. Kernpunkte:
- **Öffentliche Buchung crasht nicht mehr bei wiederkehrendem Gast**:
  `booking_engine._upsert_guest` delegiert jetzt an den zentralen
  `resolve_or_create_guest` (case-insensitive E-Mail-Suche + 23505-Handling) statt
  einer eigenen case-sensitiven Insert-Logik, die bei mixed-case-E-Mail/gleicher
  Telefonnummer/Race mit 500 gegen die 0113-Unique-Indizes lief.
- **Cron-ARI-Superseding gegen done-Zeilen**: `process_ari_outbox` berücksichtigt
  jetzt auch neuere bereits erfolgreich gepushte (done) Outbox-Zeilen als
  Supersessor (nicht nur die pending-Batch) — eine ältere Storno-Freigabe (avail=1)
  überschreibt keine neuere Buchung (avail=0) mehr (Überbuchung).
- **Kein Client-fabrizierter Storno + §19-Konsistenz**: `create_invoice_from_bestand`
  erzeugt immer `invoice_type='invoice'` (Storno nur über den echten Weg mit
  Negation/Original-Verweis); bei Kleinunternehmer wird der Kopf-`tax_rate` auf 0
  gezwungen; die Positions-Schleife liest snake_case + camelCase (Σ Positionen = Kopf).
- **Storno-PDF vollständig**: die (negative) MwSt-Zeile wird ausgewiesen
  (`taxAmount !== 0` statt `> 0`) und der Beleg als „Stornorechnung" beschriftet
  (`documentType='cancellation'`).
- **Geld-Aggregationen vollständig (PostgREST-1000-Cap)**: neuer Helfer
  `core/supabase.fetch_all_rows` paginiert; Owner-Statement-Summen,
  Portal-Einnahmen und Forecast-Training laden jetzt ALLE Zeilen (kein stiller
  Datenverlust bei >1000 Reservierungen/Snapshots).
- **Tasks-IDOR + §4.3**: `add_checklist_item`/`add_checklist_photo` prüfen die
  Tenant-Zugehörigkeit der Aufgabe (checklist-Tabellen tragen keine tenant_id);
  `request_substitution` nur durch den zugewiesenen Mitarbeiter.
- **Job-Queue: hart-crashende Jobs gehen 'dead'** (0114): `requeue_stuck_jobs`
  setzt running-Jobs mit erschöpftem Budget auf 'dead' statt sie endlos zu
  requeuen; `claim_jobs` claimt keine Jobs mit `attempts >= max_attempts` mehr.
- **Rate-Limit Cross-Tenant-DoS geschlossen**: der listings-Tenant-Zähler ist jetzt
  pro (Tenant, IP) gekeyt — mehrere Angreifer-IPs mit gefälschter Opfer-tenant_id
  können das Fenster der echten Mitarbeiter (andere IP) nicht mehr vollschreiben.
- **Weitere**: `move()` rechnet Dynamic Pricing für Alt- + Ziel-Objekt neu;
  Bank-Transaktion↔Rechnung nur bei gleicher Währung verknüpfbar;
  `BookingAccountSelectionModal` nutzt die echte Transaktions-Währung (kein
  €-Hardcode); `owner_expenses` validieren statement_id/owner_id/listing_id/
  reservation_id gegen den Tenant (kein Fremd-FK).

### Behoben (6. Bug-Jagd-Runde 07/2026 — 17 verifizierte Befunde)
Sechster Multi-Agenten-Loop über den deployten Stand; alle 17 Befunde gefixt
(1 Critical, 8 High, 6 Medium, 2 Low). Migration 0115. Kernpunkte:
- **CRITICAL — properties-Router abgesichert**: `DELETE`/`POST /properties`
  verlangen jetzt `MANAGE_PROPERTY_SETTINGS` (zuvor genügte ein beliebiges
  Tenant-JWT — cleaner/owner konnten jedes Objekt löschen/anlegen); `GET
  /properties` + `/{id}` erzwingen den Owner-Self-Scope (§4.2, Eigentümer sieht
  nur zugeordnete Objekte, kein Stammdaten-Leak fremder Objekte).
- **Add-on-Fakturierung korrekt**: `create_public_booking` preist nur die für die
  Buchungsstrecke freigegebenen Add-ons ein (appears_in-Filter, gleiche Auswahl wie
  purchase_addons) und persistiert `quote_items` OHNE die Add-on-Zeilen — die
  Check-out-Rechnung fakturiert die Add-ons nicht mehr doppelt (build_positions
  prüft items_sum + Add-on-Summe gegen total_amount).
- **Restriktions-Pushes dauerhaft abgesichert** (0115 `ari_restriction_outbox`):
  Stop-Sell/Rate/Min-/Max-Stay/CTA-CTD werden vor dem Channex-Call persistiert und
  vom neuen `process_restriction_outbox`-Cron nachgezogen — ein Verkaufsstopp geht
  bei Channex-Ausfall/Job-Tod nicht mehr verloren, und ein channex-managtes Objekt
  ohne Rate-Plan-Mapping heilt sich beim Retry selbst (kein stilles Verwerfen).
- **Reservierungsrechnungs-Positionen NETTO**: `total` = quantity*unitPrice (netto)
  statt brutto — Zeilenbetrag und Zwischensumme stimmen im PDF wieder überein.
- **Mehrwährung**: Dynamic-Pricing-Vorschau + Builder-Checkout nutzen die Objekt-
  Währung (kein €-Hardcode); OSS-Steuerregel im PDF-Hook konsistent steuerfrei.
- **Marktplatz skaliert**: öffentliches Listing paginiert (kein 1000-Cap) und
  deckelt die datierte Preisauflösung (kein N+1 über hunderte Objekte).
- **Weitere**: Dynamic-Pricing-Vorschau abonniert alle preis-speisenden Tabellen
  (RealtimeRefresh auf 6 Tabellen erweitert); process_ari_outbox-Fehler-Zweig mit
  pending-Guard; Bank-Transaktion-Modals bleiben mehrwährungsfähig; kein
  inkrementierender `POST /number-sequences/next` mehr (GoBD-Lücke); Übersetzungs-
  Endpoint mit Längen-/Format-Limit (Kostenschutz Google-API).

### Behoben (7. Bug-Jagd-Runde 07/2026 — 13 verifizierte Befunde)
Siebter Multi-Agenten-Loop über den deployten Stand; alle 13 Befunde gefixt
(1 Critical, 6 High, 2 Medium, 4 Low). Migration 0116. Kernpunkte:
- **CRITICAL — Stripe-Connect-IDOR geschlossen**: die vier Connect-Endpunkte
  (Status/Update/ToS/Bank-IBAN) prüfen jetzt, dass die `stripe_account_id` dem
  Tenant des Aufrufers gehört (`tenant_billing_profile`). Zuvor konnte ein
  Admin/Co-Admin mit MANAGE_BILLING die Account-ID EINES ANDEREN Tenants
  angeben — Auszahlungs-IBAN umleiten, KYC überschreiben, Status auslesen
  (direkter Geldabfluss).
- **OTA-Buchung nicht mehr lokal verschiebbar**: `move()` lehnt eine OTA-
  importierte Reservierung ab — ein lokaler Move hätte die Nächte lokal
  freigegeben und `availability=1` gepusht, während die Buchung im Portal
  bestehen bleibt (Überbuchung). Analog gibt `calendar._unblock` jetzt NUR die
  wirklich freien Tage frei (tag-genau, keine gebuchten/OTA-Tage).
- **Restriktions-Outbox mit Superseding**: der Cron-Nachzieher überspringt eine
  veraltete pending-Zeile, wenn für dasselbe (Objekt, kind, Zeitraum) eine
  neuere Absicht existiert — ein stale Retry überschreibt keinen jüngeren
  Stop-Sell/Preis mehr (Re-Open/Überbuchung).
- **GoBD**: `update_invoice_raw` kann einen nummernlosen Entwurf nicht mehr auf
  `finalized`/`paid`/`sent` heben (Beleg ohne Rechnungsnummer + unrettbar).
- **Job-Queue robust** (0116): `_retry`/`_defer` + Reaper kollidieren nicht mehr
  mit dem dedup-Index (23505 → Job blieb 'running' stecken); ein Budget-
  Livelock bei dauerhaft totem Redis endet nach `defer_count`-Deckel in 'dead'.
- **Channex-Budget**: `recompute_property` (die meisten Rate-Calls) zieht jetzt
  pro HTTP-Call ein Token (kein Umgehen des Konto-Limits); `retry_after` wartet
  bei TTL==0 ~1 s statt eines vollen Fensters.
- **Weitere**: PDF-Versand nutzt den existierenden `generate-pdf-single`-Endpunkt
  (der `-multi`-Pfad war 404); Auslastungs-Heatmap zählt Blocks/Stop-Sell/OTA-
  Belegung (+ availability/stop_sell-Realtime); InventorySelector zeigt die
  Belegwährung; WhatsApp-Status-Update tenant-scoped.

### Behoben (9. Bug-Jagd-Runde 07/2026 — 5 verifizierte Befunde)
Neunter Multi-Agenten-Loop über den deployten Stand; alle 5 Befunde gefixt
(2 High, 2 Medium, 1 Low), ohne neue Migration. Drei davon waren Lücken in
eigenen früheren Fixes:
- **Keine Add-on-Doppelfaktura mehr im Fallback** (Nacharbeit R6): Wenn die
  Buchungs-Aufschlüsselung nicht mehr zum Gesamtpreis passt (Gast kauft/storniert
  nachträglich ein Add-on → `addons_sum` verschiebt sich, `total_amount` bleibt),
  nahm der Fallback bislang den vollen (add-on-haltigen) `total_amount` als
  Sammelposition UND buchte die Add-ons erneut on-top. Jetzt ist der Aufenthalt
  der verlässliche Snapshot `items_sum` (add-on-frei per Invariante); ohne
  `quote_items` wird `total_amount` um die gedeckte Add-on-Summe gekürzt; ohne
  Add-ons bleibt der Wizard-`total_amount`-Override die Sammelposition. Betroffen
  war die verpflichtende GoBD-Check-out-Rechnung.
- **Girocode-QR im Versand-Modal** (Nacharbeit R8): `SendDocumentModal` erzeugt
  nur noch bei ausdrücklich als EUR ausgewiesener Rechnung einen EPC-QR — leere
  ODER Fremdwährung ergibt keinen QR (kein `EUR`-Präfix auf einem CHF/PLN- oder
  währungslosen Betrag → keine falsche Überweisungssumme). Bisher nur in
  `LivePreviewModal` gefixt, nicht in der eigentlichen Versand-Instanz.
- **Dashboard-Umsatz bei Mehrwährung**: `reservations.dashboard` addiert
  EUR/CHF/… nicht mehr stumpf zu einer Zahl mit beliebigem Label — bei mehr als
  einer Währung im 30-Tage-Fenster ist `revenue_30d=None` + `currency=''` (Frontend
  blendet die KPI aus, wie beim maskierten Owner). Gleiche Klasse wie der R4-Fix
  der Kalender-KPIs.
- **Kein erfundenes € im PDF-Hook**: `usePDFTemplateData` reicht `currency` ohne
  `|| 'EUR'`-Fallback durch (leer → `formatCurrency` rendert bewusst symbollos)
  — an beiden Stellen (`placeholderData` + `processedData`); hebelt das
  gewollte Verhalten nicht mehr aus (Regeln „keine Fallbacks"/„kein €-Hardcode").
- **ari_push Fehlerpfad mit `pending`-Guard**: der `ChannexError`-Zweig in
  `push_availability_for_property` schreibt `attempts`/`last_error` nur noch auf
  eine noch `pending` Outbox-Zeile — ein verzögerter Fehler des schnellen
  Job-Pfads überschreibt keine bereits vom Cron auf `done` gesetzte Zeile mehr
  (Guard-Invariante wie überall sonst im Modul).

Stop-Rule ergänzt (Loop Engineering 101, Baustein 4): die Bug-Jagd-Schleife hat
jetzt einen Iterations-Cap (`deploy/bug-hunt-loop-state.json`, `maxRounds=15`) —
sie stoppt bei 0 bestätigten Bugs (Konvergenz) ODER beim Cap, nicht mehr
unbegrenzt.

### Behoben (8. Bug-Jagd-Runde 07/2026 — 11 verifizierte Befunde)
Achter Multi-Agenten-Loop über den deployten Stand; alle 11 Befunde gefixt
(6 High, 4 Medium, 1 Low), ohne neue Migration. Mehrere waren Nacharbeit an
eigenen jüngsten Fixes:
- **Job-Queue-Resilienz**: `defer_count` (R7-Livelock-Deckel) wird bei echtem
  Fortschritt zurückgesetzt — ein Batch-Job (process_ari_outbox mit 500 Zeilen),
  der je Tick voranarbeitet, stirbt nicht mehr fälschlich mid-batch als 'dead'
  (Fortschritts-Zähler über einen Budget-Wrapper). `recompute_property` verschluckt
  `ChannexBudgetExhausted` nicht mehr (re-raise → Job wird deferred statt 'done').
- **Restriktions-Superseding jetzt TAG-GENAU** (wie der Availability-Pfad): eine
  schmale neuere Zeile (Preis 15.–16.) unterdrückt nicht mehr den weiten älteren
  Wert (1.–31.) für dessen ganzen Zeitraum — die restlichen Tage gehen weiter an
  Channex (kein stale Falschpreis/-Sperre).
- **OTA-cancel-Guard**: `cancel()` lehnt eine OTA-importierte Buchung ab (wie
  `move()`) — kein lokaler Storno, der am Portal gehaltene Nächte freigibt.
- **GoBD**: ein Buchungs-Entwurf blockiert die Check-out-Rechnung nicht mehr — er
  wird beim Check-out finalisiert (Nummer gezogen); `is_kleinunternehmer` kommt
  autoritativ aus `tenant_billing_profile` (nicht aus dem Client-Flag); der
  Aktions-Rabatt wird pro Steuersatz aufgeteilt (gemischte USt korrekt);
  Angebots-Umwandlung race-sicher (guarded UPDATE, kein Doppel-Beleg).
- **Weitere**: PDF-Positionsspalte zeigt bei Reverse-Charge/steuerfrei/OSS keinen
  USt-Satz mehr (konsistent zum steuerfreien Kopf); Girocode-QR nur bei
  ausdrücklich EUR (leere Währung ≠ EUR); Owner-Statement-Add-on-Umsatz paginiert
  (kein 1000-Cap → korrekte Auszahlung).

### Behoben (High-Befunde der Bug-Jagd 07/2026)
- **Owner-Scope im Kalender + Reservierungen (§4.2)**: Eigentümer sehen jetzt nur
  ihre zugeordneten Objekte (neuer gemeinsamer Helfer `auth/owner_scope.py`).
  `calendar` (availability/board/check/stop-sell/season-price) und `reservations`
  (list/detail/dashboard) filtern über `owner_property_assignments`; fremde
  Objekte wirken wie „nicht gefunden". Tagespreise werden für Eigentümer entfernt
  (kein Preis-Recht), das Owner-Dashboard zeigt nur eigene KPIs statt tenant-weit.
- **Buchhaltungs-Leseendpunkte** verlangen jetzt `OWNER_REPORTING` (wie die
  Schreibpfade): Kunden-PII, Rechnungen, Nummernkreise und Firmenprofile waren
  vorher für jeden authentifizierten Nutzer (staff/cleaner) lesbar.
- **Kleinunternehmer-Rechnung konsistent** (§19 UStG): Positions-USt wird jetzt
  auf 0 gezwungen, wenn der Kopf steuerfrei ist (`create_invoice`,
  `create_invoice_from_bestand`, `update_invoice`) — Σ Positionen == Kopf, kein
  GoBD-Widerspruch, kein falscher Storno.
- **OTA-Import-Währung aus dem Objekt-Rate-Plan** statt hartem EUR-Fallback
  (`bookings_sync.py`) — PLN/CZK/CHF-Buchungen tragen die echte Währung.
- **Channex-Budget-Token-Leck geschlossen**: `try_consume` verbraucht Account-
  und Property-Token jetzt atomar all-or-nothing (Lua) — eine Property-Ablehnung
  verbrennt kein Account-Token mehr (kein Leerlaufen des Kontobudgets über
  retryte, abgelehnte Jobs).
- **Restriktionen/Stop-Sell/Rate erreichen ALLE Rate-Plans** (nicht nur einen
  zufälligen `.limit(1)`): neuer `_resolve_channex_rate_plans` (Plural); ein
  Stop-Sell sperrt jetzt jeden Rate-Plan (sonst verkauft z. B. Expedia weiter).
- **ARI-Push-Retry bei Channex-Ausfall**: die push-Methoden signalisieren
  Fehler an den Worker-Handler, der den Job-Backoff (1/5/15 min) auslöst — der
  verlorene Push hing vorher allein am 15-min-Reconcile-Tick.
- **Rate-Limit-JWT-Bypass geschlossen**: die (unsignierte) `tenant_id` im
  listings-Pfad hebelt das strengere IP-Limit nicht mehr aus — das
  Tenant-Bucket ist zusätzlich an ein IP-Limit gekoppelt (Token-Rotation von
  einer IP kann nicht mehr als das IP-Fenster erzeugen).
- **WhatsApp-Webhook fail-closed**: ohne `WHATSAPP_APP_SECRET` wird die
  Signaturprüfung nur noch lokal übersprungen; in Prod/Staging antwortet der
  öffentliche Endpoint mit 503 statt gefälschte Nachrichten zu verarbeiten.
- **apps/web/Dockerfile**: `ENV HOSTNAME=0.0.0.0` (Next.js-standalone band sonst
  an den Container-Hostnamen → 502/Healthcheck-Fail nach Deploy).
- **Frontend-Konsistenz**: PDF-Steuer pro Position statt globalem Satz
  (`usePDFTemplateData`), MwSt.-Anzeige ohne erfundenen 19er-Fallback
  (`ItemsTable`, 0 % bleibt 0 %), Tagespreis-Währung im Belegungsplan
  (`calendar-board`), €-Hardcodes in Richtlinien/Saisonpreisen aus dem
  Rate-Plan, Brand-Fallback „NextDays"→leer bzw. „myNextDays", Storno-PDF über
  den existierenden `/generate-pdf-single` (vorher 404), währungsneutrales Icon.

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
