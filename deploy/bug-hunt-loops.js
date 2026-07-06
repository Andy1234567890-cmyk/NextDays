export const meta = {
  name: 'bug-hunt-loops',
  description: 'Zwei Bug-Jagd-Loops (datei-lokal + E2E) mit adversarieller 2-Skeptiker-Verifikation über den frisch deployten NextDays-Stand',
  phases: [
    { title: 'Loop1-Finden', detail: 'datei-lokale Finder je Dimension' },
    { title: 'Loop1-Verify', detail: '2 unabhängige Skeptiker je Befund' },
    { title: 'Loop2-Traces', detail: 'End-to-End-Datenfluss-Traces' },
    { title: 'Loop2-Verify', detail: '2 unabhängige Skeptiker je Befund' },
    { title: 'Synthese', detail: 'dedup + konsolidierter Bericht' },
  ],
}

const REPO = '/Users/andystaudinger/NextDays'

// STOP-RULE (Loop Engineering 101, Baustein 4 — Cap): dieses Script ist EINE
// Runde. Die äußere Schleife (Relaunch nach jedem Ergebnis) stoppt bei ODER:
//   (1) success  — eine Runde liefert 0 bestätigte Bugs (Konvergenz), oder
//   (2) cap      — round >= maxRounds aus deploy/bug-hunt-loop-state.json (15).
// Ohne (2) liefe der Loop bei einem hartnäckigen Falsch-Positiv oder einer nicht
// abschließend fixbaren Klasse unbegrenzt. Der Rundenzähler + Verlauf liegen in
// bug-hunt-loop-state.json und werden vor jedem Relaunch geprüft/fortgeschrieben.

// Bereits in Runde 1+2 gefixte Befunde — NICHT erneut melden (sonst Endlos-
// schleife). Die Finder erhalten diese Liste als „bekannt & behoben".
const KNOWN_FIXED = `BEREITS GEFIXT (NICHT erneut melden, nur NEUE/andere Bugs):
- Doppelbuchung (EXCLUDE-Constraint + create_reservation_atomic RPC 0104)
- verlorener/doppelter ARI-Push (ari_outbox + outbox_id + Superseding + Retry-Signal)
- Rechnungsnummern-Race (0105, NULLS NOT DISTINCT); Nummer nur serverseitig+bei Finalisierung
- Owner-Scope in owner_statements/calendar/reservations; Owner 403 in Buchhaltung
- Buchhaltungs-Leseendpunkte hinter OWNER_REPORTING; channel-manager /bookings maskiert + Topologie-Lese-Scope
- Cron-Secret getrennt (INTERNAL_CRON_SECRET); RPC-Grants gegen anon/authenticated (0106/0107)
- Worker-Doppelausführung (Heartbeat + locked_by-Guards); enqueue_job-Coalescing nur queued (0108)
- Kleinunternehmer-USt konsistent; finalisierte Rechnungen unlöschbar/unänderbar
- hidden_from_owner gefiltert; Positions-Inserts mit Rollback; Nummern-Kollision 409
- create_public_booking: nur active, serverseitiges Pricing, async Push, recompute
- move()/cancel(): Stop-Sell + keine Freigabe OTA-belegter Tage
- Inbox-Doppelversand (atomares Claim); Cloudflare-Hostname-Rollback
- Rate-Limit tenant-Fairness pro IP; channex_budget retry_after; Stripe-Webhook-Claim; Addon-Idempotenz (0109)
- WhatsApp-Webhook fail-closed; Dockerfile HOSTNAME; diverse EUR/Brand-Hardcodes, ItemsTable MwSt, Monatsgitter-Realtime
GEFIXT IN RUNDE 3 (ebenfalls NICHT erneut melden):
- ari_outbox-Superseding jetzt TAG-GENAU + im schnellen push_availability-Pfad (nicht nur Cron); _newer_covered_days, _superseding_days_by_row, _group_iso_days_to_ranges
- update_invoice_raw sperrt finalisierte Rechnungen (Status+Nummer-Gate); Owner sieht keine season-price-Preise
- Kalender-Preiswährung aus Rate-Plan (BoardProperty.currency, _fetch_rate_plan_bulk); PDF ItemsTable/TotalsDisplay/Girocode-QR mit echter Belegwährung
- Channex-Budget pro Call (ChannexClient before_call/ChannexBudgetExhausted) statt 1 Token je Batch-Job
- Doppel-Storno-Race (0110 Unique-Index + Handling); disconnect_channel Tenant-Eigentum vor Channex-Call (IDOR)
- Teilerstattung → partially_refunded (0111, Webhook amount_refunded vs amount + refund_payment); create_booking_payment idempotent (retrieve_payment_intent)
- Admin-Addon-Schnelltaste fängt 0109-Kollision (409); öffentliche Buchung: max_guests + Vergangenheitsdatum abgelehnt (_public_property)
- connect_property fremde channex_property_id abgewiesen; GoBD-Nummer erst nach Validierung; customer_id tenant-gescopt
- WhatsApp verify_token konstant-zeitig (compare_digest); Gäste-Dedup (0113 guests_tenant_email/phone_uq); properties-Realtime im Kalender
- Nummernkreis-Constraint defensiv (0112); EmailSendModal Brand-Slug ohne Fallback; Banking-Modal Transaktions-Währung
GEFIXT IN RUNDE 4 (ebenfalls NICHT erneut melden):
- create_public_booking reicht Add-ons in den PricingResolver.quote → total_amount/Stripe-PaymentIntent enthält sie (AddonSelection aus req.addons)
- move() lehnt eingecheckte Reservierung ab (checked_in_at-Guard, 409); move() belegt neue Nächte nur wo nicht fremd-OTA-belegt (Open-Guard, kein source-Klobbern)
- OTA-Storno (bookings_sync) pusht Channex nur die WIRKLICH freigewordenen Tage (tag-/quellengenau, kein pauschales availability=1 für ganzen Zeitraum)
- _newer_covered_days filtert status IN (pending,done) — failed-Outbox-Zeile superseded keine ältere Sperre; process_ari_outbox Erfolgs-Update mit status=pending-Guard
- Owner-Dashboard revenue_30d=None + currency='' ohne PM_BOOKING_TOTAL (§4.2); pricing /effective + /quote hinter require_lodgify_permission(PM_BOOKING_TOTAL)
- Storno nur auf ausgestellte Rechnung (status!=draft UND invoice_number gesetzt) — kein draft-Storno, keine verbrannte ST-Nummer
- Rate-Limit listings: IP-Check VOR globalem Tenant-INCR (Cross-Tenant-DoS über gefälschte Opfer-tenant_id)
- PDF usePDFTemplateData: Rabatt-Positionen (category=discount) mindern subtotal/tax negativ; taxGrouped aus Positionen abgeleitet wenn nicht mitgegeben
- purchase_addons Einzel-Insert (Teilkollision verliert keine neuen Add-ons); Add-on-Fehler nach committer Buchung kippt sie nicht (try/except, kein 500+409-Sackgasse)
- Inbox-Scheduler: sending-Reaper (SENDING_REAP_MINUTES, verwaiste sending-Zeile läuft nach Crash wieder an); cancel_scheduled erzwingt Thread-Scope (assigned-only)
- ChannexClient _acquire_budget PRO HTTP-Round-Trip in der Retry-Schleife (auch 429-Retries zählen Token)
- worker _enqueue_reconcile_all Bucket aus time.time() (Wall-Clock) statt loop.time() (Monotonic) → Cross-Instance/Restart-Coalescing
- guests _find_by_email case-insensitiv via ilike + _like_escape (mixed-case Bestands-E-Mail findbar, kein 500 an lower(email)-Index)
- Kalender-KPIs (calendar-board) aggregieren Umsatz/ADR pro Währung, mixedCurrency → keine Mischsumme; Channex-Webhook-Secret secrets.compare_digest; Forecast-Training paginiert (kein 1000-Cap)
GEFIXT IN RUNDE 5 (ebenfalls NICHT erneut melden):
- booking_engine._upsert_guest delegiert an resolve_or_create_guest (case-insensitive ilike + 23505-Handling); kein 500 bei mixed-case-E-Mail/gleicher Telefonnummer/Race gegen 0113-Unique-Indizes
- process_ari_outbox (Cron) berücksichtigt beim Superseding auch neuere done-Zeilen via _newer_covered_days (nicht nur pending-Batch); ältere Storno-Freigabe avail=1 überschreibt keine neuere Buchung avail=0
- create_invoice_from_bestand: invoice_type IMMER 'invoice' (kein Client-isStorno-Beleg); Kleinunternehmer Kopf-tax_rate=0 erzwungen; Positions-Schleife liest snake_case+camelCase (Σ Positionen = Kopf)
- Storno-PDF: TotalsDisplay zeigt negative MwSt (taxAmount !== 0 statt > 0); documentType='cancellation' (korrekte Beschriftung „Stornorechnung")
- Geld-Aggregationen paginiert via core/supabase.fetch_all_rows: owner_statements._reservations, public_portal.earnings, pricing forecast-Training (kein stiller 1000-Zeilen-Cap)
- tasks add_checklist_item/add_checklist_photo prüfen Tenant-Zugehörigkeit der task_id/item_id (IDOR); request_substitution nur durch zugewiesenen Mitarbeiter (§4.3 assignee_id-Check)
- jobs (0114): requeue_stuck_jobs setzt attempts>=max_attempts running-Jobs auf 'dead'; claim_jobs claimt nur attempts<max_attempts (hart-crashende Jobs loopen nicht mehr ewig)
- Rate-Limit listings-tenant pro (tenant, ip) gekeyt (listings:tenant:{t}:ip:{ip}) — Multi-IP-Cross-Tenant-DoS über gefälschte Opfer-tenant_id geschlossen
- move() rechnet Dynamic Pricing für Alt- UND Ziel-Objekt neu (_recompute_dynamic_pricing)
- SelectBankingTransactionModal blockt Cross-Currency-Match (invoiceCurrency-Prop vs transaction.currency); BookingAccountSelectionModal nutzt formatCurrency(betrag, transaction.currency) statt EUR-Hardcode
- owner_expenses add/update validieren statement_id/owner_id/listing_id/reservation_id gegen Tenant (_require_own_fk, kein Fremd-FK)
GEFIXT IN RUNDE 6 (ebenfalls NICHT erneut melden):
- properties-Router: DELETE + POST hinter MANAGE_PROPERTY_SETTINGS (kein cleaner/owner-Delete/Create); GET list/get erzwingen Owner-Self-Scope (§4.2, is_owner + owner_property_ids)
- create_public_booking: nur booking_engine-freigegebene Add-ons in den Quote (_bookable_addon_selections/appears_in-Filter) + quote_items OHNE Add-on-Zeilen; build_positions prüft items_sum + Add-on-Summe gegen total_amount (keine Doppelfaktura)
- Restriktions-Backstop (0115 ari_restriction_outbox): push_stop_sell/rate/min_stay/max_stay/cta_ctd/restrictions persistieren vor dem Channex-Call, process_restriction_outbox-Cron zieht nach; channex-managed ohne Rate-Plan-Mapping bleibt pending (Selbstheilung, kein stilles done)
- reservation_invoice: Positions-total = NETTO (net_amount) statt gross (Zeilenbetrag = Zwischensumme im PDF-Hook/ItemsTable)
- dp-preview-grid + Builder-Checkout nutzen Objektwährung (formatCurrency mit currency, kein €-Hardcode); formatCurrency hat fractionDigits-Param
- usePDFTemplateData isTaxExemptRule deckt EU_OSS/OSS ab (taxAmount=0, konsistent zu TotalsDisplay showVat=false)
- process_ari_outbox Fehler-Zweig mit .eq(status,pending)-Guard (kein done→failed-Rückfall bei Nebenläufigkeit)
- RealtimeRefresh auf 6 Tabellen; dp-preview abonniert price_overrides/dynamic_prices/property_pricing_config/rate_plans/availability/dp_settings
- Marktplatz list_listings paginiert via fetch_all_rows (kein 1000-Cap) + _MAX_LISTING_RESULTS-Deckel (kein N+1 datierte Preisauflösung, geloggt)
- kein inkrementierender POST /number-sequences/next mehr (nur GET-Preview + serverseitiges Ziehen beim Speichern); TranslateRequest max_length=50000 + fmt Literal html|text
GEFIXT IN RUNDE 7 (ebenfalls NICHT erneut melden):
- Stripe-Connect-Endpunkte (get_status/update/accept_tos/set_external_account) prüfen _require_own_connect_account(tenant_id, acct_id) gegen tenant_billing_profile — kein Cross-Tenant-IDOR (Payout-Umleitung/KYC/ToS)
- move() lehnt OTA-Buchung (source_channex_booking_id gesetzt) mit 409 ab (lokaler Move würde Portal-Nächte freigeben → Überbuchung)
- calendar._unblock pusht availability=1 NUR für tatsächlich freie Tage (_contiguous_open_spans, gebuchte/OTA-Tage bleiben gesperrt)
- process_restriction_outbox mit Superseding (_restriction_superseded: neuere pending/done-Zeile für (property,kind,Zeitraum) → alte abhaken statt stale pushen)
- update_invoice_raw lehnt draft→finalized/paid/sent ohne invoice_number ab (kein GoBD-Beleg ohne Nummer)
- worker _retry/_defer via _requeue (fängt jobs_dedup_queued_uq 23505 → done-yield); requeue_stuck_jobs (0116) dedup-sicher (superseded-Zweig); defer_count-Deckel (_MAX_DEFERS) gegen Redis-Livelock → dead
- recompute_property in _CHANNEX_JOB_TYPES + DynamicPricingRecompute(channex_budget=budget) → Rate-Push zieht Token; channex_budget _retry bei TTL==0 → 1s statt volles Fenster
- EmailSendModal nutzt /api/v1/generate-pdf-single (der -multi-Pfad war 404); occupancy-view/occupancyMatrix zählen Blocks/Stop-Sell/OTA (blockedByProp) + availability/stop_sell-Realtime
- InventorySelector currency-Prop (formatCurrency); WhatsApp _apply_status tenant-scoped (je Zeile über tenant_id, kein tenant-loser Update)
GEFIXT IN RUNDE 8 (ebenfalls NICHT erneut melden):
- worker _defer: defer_count wird bei Fortschritt zurückgesetzt (_ProgressBudget zählt vergebene Token) — Batch-Jobs sterben nicht mehr mid-batch als dead
- recompute _push_to_channex re-raist ChannexBudgetExhausted (nicht vom breiten except geschluckt) → Job deferred statt fälschlich done
- process_restriction_outbox Superseding TAG-GENAU (_superseded_restriction_days/_restriction_row_days): nur überlappte Tage überspringen, Restwerte weiter pushen (kein stale Falschpreis)
- cancel() lehnt OTA-Buchung (source_channex_booking_id) mit 409 ab (wie move()) — kein lokaler Storno gibt Portal-Nächte frei
- create_from_reservation finalisiert bestehenden Buchungs-Entwurf beim Check-out (_finalize_reservation_draft, zieht Nummer) statt ihn als already_existed durchzuwinken
- ItemsTable zeigt USt-Spalte pro Position nur wenn Beleg USt ausweist (belegAusweistUst, konsistent zu TotalsDisplay showVat)
- create_invoice_from_bestand liest is_kleinunternehmer AUTORITATIV aus tenant_billing_profile (nicht Client-Flag isSmallBusiness)
- Resolver teilt Aktions-Rabatt pro Steuersatz auf (discount-Zeilen mit tax_rate-Snapshot) — gemischte USt korrekt gutgeschrieben
- LivePreviewModal Girocode nur bei docCurrency === 'EUR' (leere Währung ≠ EUR); owner_statements _addon_sums paginiert via fetch_all_rows
- convert_quote_to_invoice guarded UPDATE (converted_invoice_id IS NULL) + Verlierer verwirft Doppel-Rechnung (Race)
GEFIXT IN RUNDE 9 (ebenfalls NICHT erneut melden):
- build_positions-Fallback bucht Add-ons NICHT mehr doppelt: bei Add-ons (addons_sum>0) ist der Aufenthalt items_sum (Snapshot, add-on-frei) statt des veralteten total_amount; ohne quote_items wird total_amount um addons_sum gekürzt (soweit gedeckt); ohne Add-ons bleibt der Wizard-total_amount-Override die Sammelposition
- SendDocumentModal Girocode nur bei docCurrency === 'EUR' (leere/Fremdwährung ≠ EUR → kein QR), wie R8 für LivePreviewModal
- reservations.dashboard revenue_30d=None + currency='' bei gemischten Währungen (currencies-Set), keine addierte Mischsumme mit beliebigem Label (wie R4 für Kalender-KPIs)
- usePDFTemplateData currency ohne '|| EUR'-Fallback (leer → formatCurrency rendert symbollos, kein erfundenes €) an beiden Stellen (placeholderData + processedData)
- ari_push push_availability_for_property ChannexError-Zweig mit .eq(status,pending)-Guard (kein stale last_error/attempts auf bereits done-Zeile bei Nebenläufigkeit fast-path vs Cron)
GEFIXT IN RUNDE 10 (ebenfalls NICHT erneut melden):
- _project_booking_to_reservation gibt bei OTA-Buchungs-MODIFIKATION (Verkürzung/Verschiebung) die geräumten Alt-Nächte frei (_free_ota_nights, Alt-/Neu-Diff aus vorab gesichertem old_check_in/out) — kein Phantom-Belegungs-Inventarverlust mehr; cancelled-Zweig nutzt denselben Helper
- create_quote/update_quote ziehen is_kleinunternehmer autoritativ aus tenant_billing_profile (_is_kleinunternehmer) → Angebote weisen für §19-Kleinunternehmer KEINE USt aus (Positions-rate=0), konsistent zur daraus konvertierten Rechnung
- ItemsTable elegant/technical-Varianten berechnen den Zeilenbetrag aus unitPrice*quantity*(1-discount) statt aus dem bereits rabattierten item.total → kein Doppelrabatt, Zeilenbetrag == Zwischensumme/Totals (wie Standard-Variante)
- create_deposit_hold idempotent (vorhandenen pending-deposit-Intent via retrieve_payment_intent wiederverwenden) → keine Doppel-Vorautorisierung auf der Gastkarte bei Doppelklick/Retry
- refund_payment prüft Status ('refunded' → 409) + summiert bereits erstattete refund-Rows (_refunded_sum) und lehnt Erstattung über den Restbetrag ab (422) → keine Doppelerstattung; is_full gegen kumulierte Summe
- /channel-manager/bookings hinter _read (MANAGE_PROPERTY_SETTINGS) wie list_channels → kein staff/cleaner/owner liest tenant-weite OTA-Buchungen/Belegungsdaten
- secrets_match (byteweise, robust gegen nicht-ASCII) ersetzt secrets.compare_digest in require_internal_cron_secret + WhatsApp-verify_token + Channex-Webhook-Secret → nicht-ASCII-Header ergibt 401/403 statt 500/Log-Flooding
- SelectBankingTransactionModal reicht invoiceCurrency/transaction.currency an alle formatCurrency-Aufrufe (Badge/Differenz/Warn-Modal) → Fremdwährungsbeträge mit Symbol; NewCustomerModal Labels/Skonto-Hilfetext via currencySymbol(formData.currency)/formatCurrency statt €-Hardcode`

// Nur bestätigte, echte Bugs. Schema erzwingt strukturierte Rückgabe.
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          problem: { type: 'string' },
          scenario: { type: 'string' },
          dimension: { type: 'string' },
        },
        required: ['severity', 'title', 'file', 'problem', 'scenario'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    real: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['real', 'reason'],
}

// Loop 1: datei-lokale Finder. Bewusst auf die Fix-Runde + Hotspots fokussiert.
const L1_DIMENSIONS = [
  { key: 'reservations-booking', prompt: `Prüfe apps/api/src/features/reservations/service.py und apps/api/src/features/booking_engine/service.py in ${REPO}. Fokus: die NEUE atomare Buchung über RPC create_reservation_atomic (Migration 0104), move()-Reihenfolge (UPDATE vor Kalender), _write_ari_outbox, _map_booking_conflict, Owner-Scope (_owner_scope_pids). Suche: Race Conditions, halbe Zustände bei Fehler, falsche Exception-Codes, Off-by-one Nächte/Tage, Owner-Scope-Lücken, fehlende tenant-Prüfung.` },
  { key: 'channex-ari', prompt: `Prüfe apps/api/src/features/channel_manager/ari_push.py, bookings_sync.py, worker.py in ${REPO}. Fokus: die NEUEN Fixes — _resolve_channex_rate_plans (Plural, alle Rate-Plans), push_*-Methoden geben bool zurück (Fehlersignal → _handle_push_ari wirft), _property_currency (kein EUR-Hardcode), ari_outbox-Handling mit outbox_id. Suche: verlorene Pushes, Doppel-Pushes, falsche Rate-Plan-Iteration, Retry-Schleifen, Reihenfolge-Bugs beim Outbox.` },
  { key: 'buchhaltung', prompt: `Prüfe apps/api/src/features/buchhaltung/service.py, reservation_invoice.py, storno.py in ${REPO}. Fokus: Kleinunternehmer-USt (_compute_line mit is_klein, create_invoice/update_invoice/create_invoice_from_bestand), Nummernkreis-Nutzung (next_document_number), invoices_tenant_number_uidx. Suche: Kopf-vs-Positionen-Inkonsistenz, GoBD-Verstöße, Race bei Nummernvergabe, fehlende tenant-Prüfung, Rundungsfehler in Decimal.` },
  { key: 'auth-scope', prompt: `Prüfe apps/api/src/features/calendar/service.py+router.py, apps/api/src/features/owner_statements/service.py, apps/api/src/features/buchhaltung/router.py, apps/api/src/features/auth/owner_scope.py in ${REPO}. Fokus: Owner-Scope (§4.2, nur eigene Objekte), Buchhaltungs-Leseendpunkte hinter OWNER_REPORTING, Preis-Maskierung für Owner. Suche: Endpunkte ohne Scope-Check, Bypass über Client-Parameter, fehlende Permission-Guards, Datenleck fremder Tenants/Owner.` },
  { key: 'security-ratelimit', prompt: `Prüfe apps/api/src/core/ratelimit_middleware.py, apps/api/src/core/security.py, apps/api/src/features/whatsapp/router.py, apps/api/src/features/inbox/router.py, apps/api/src/features/pricing/router.py in ${REPO}. Fokus: Rate-Limit-JWT-Bypass-Fix (IP-Kopplung für listings-tenant), require_internal_cron_secret (Trennung von CHANNEX_WEBHOOK_SECRET), WhatsApp-Signatur fail-closed. Suche: umgehbare Limits, Secret-Verwechslung, unsignierte Token-Auswertung, fehlende Signaturprüfung, Timing-Angriffe.` },
  { key: 'migrations-grants', prompt: `Prüfe supabase/migrations/0104_reservations_atomic_booking.sql, 0105_number_sequences_race.sql, 0106_jobs_rpc_grants.sql, 0107_reservation_rpc_grants.sql in ${REPO}. Fokus: SQL-Korrektheit, SECURITY DEFINER vs INVOKER, GRANT/REVOKE-Vollständigkeit (anon/authenticated wirklich gesperrt?), EXCLUDE-Constraint-Semantik, plpgsql-Fehler, Idempotenz für den Migrations-Runner, RLS-Vollständigkeit neuer Objekte. Suche: verbliebene offene Grants, SQL-Injection über jsonb-Keys, fehlende Constraints, race-anfällige Funktionen.` },
  { key: 'channex-budget', prompt: `Prüfe apps/api/src/jobs/channex_budget.py und apps/api/src/jobs/queue.py in ${REPO}. Fokus: der NEUE all-or-nothing Lua-Token-Bucket (_TWO_LEVEL_LUA), try_consume, Fehlerbehandlung bei Redis-Ausfall. Suche: Token-Lecks, Race Conditions im Lua, falsche Retry-Berechnung, off-by-one bei Limits, Deadlocks.` },
  { key: 'frontend-finance', prompt: `Prüfe apps/web/hooks/pdf/usePDFTemplateData.ts, apps/web/components/finance/pdf-templates/common/ItemsTable.tsx, apps/web/components/finance/StornoInvoice.tsx, apps/web/components/finance/EmailSendModal.tsx in ${REPO}. Fokus: PDF-Steuer pro Position (nicht global), MwSt-Anzeige ohne erfundenen 19-Fallback, Storno-PDF über generate-pdf-single, Brand-Fallbacks entfernt. Suche: Steuer-Inkonsistenzen Kopf-vs-Zeilen, 0%-Sätze fälschlich als 19%, kaputte PDF-Downloads, verbliebene €/Brand-Hardcodes, XSS über innerHTML.` },
]

// Loop 2: End-to-End-Datenfluss-Traces (kennen die Fix-Runde).
const L2_TRACES = [
  { key: 'trace-buchung-ari', prompt: `Trace den KOMPLETTEN Datenfluss einer Buchung in ${REPO}: reservations.create/booking_engine.create_public_booking → create_reservation_atomic (0104) → ari_outbox → worker _handle_push_ari → push_availability_for_property → Channex. Suche über Dateigrenzen hinweg: kann eine Buchung ohne Channex-Push enden? Kann ein Push verloren gehen oder doppelt laufen? Stimmen die outbox_id-Übergaben? Race zwischen RPC-Commit und Job-Enqueue? Prüfe auch move() und cancel().` },
  { key: 'trace-geld', prompt: `Trace den KOMPLETTEN Geld-/Rechnungsfluss in ${REPO}: Checkout → create_from_reservation → next_document_number → invoices + invoice_line_items → Storno. Suche: kann eine Rechnungsnummer doppelt/mit Lücke vergeben werden? Sind Kopf und Positionen bei Kleinunternehmer/gemischten Sätzen konsistent? Kann der invoices_tenant_number_uidx legitime Belege blockieren? GoBD-Verstöße über den ganzen Fluss?` },
  { key: 'trace-auth-scope', prompt: `Trace Berechtigungen/Scoping über ALLE Slices in ${REPO}: welche GET/POST-Endpunkte laufen mit Service-Role (RLS umgangen) und scopen NICHT explizit auf tenant/owner? Prüfe systematisch calendar, reservations, buchhaltung, owner_statements, pricing, channel_manager, inbox. Suche: fehlende require_permission/require_lodgify_permission, Owner der fremde Daten sieht, staff/cleaner der Finanzdaten liest, Client-Parameter der Scope ausweitet.` },
  { key: 'trace-worker-resilienz', prompt: `Trace die Worker-Resilienz in ${REPO}: worker.py claim_jobs → _dispatch → _job_heartbeat → _finish/_retry/_defer + Reaper (requeue_stuck_jobs) + Migration 0102/0106/0107. Suche: kann ein Job doppelt laufen? Kann der Heartbeat einen fremden Claim auffrischen? locked_by-Guard-Lücken? Kann ein Push-Fehler den Job in eine Endlosschleife bringen? Interagiert der neue bool-Rückgabewert korrekt mit _retry?` },
  { key: 'trace-realtime-currency', prompt: `Trace Realtime + Mehrwährung im Frontend in ${REPO}: welche Listen/Detail-UIs abonnieren NICHT alle relevanten Tabellen (stale Daten)? Wo wird noch €/EUR hartkodiert statt formatCurrency/Objekt-Währung? Prüfe kalender/, objekte/, finance/, quotes/. Suche: fehlende useRealtime-Abos, verbliebene Währungs-Hardcodes, Preis-Quellen die nicht live nachziehen.` },
  { key: 'trace-luecken-kritik', prompt: `Vollständigkeits-Kritiker für ${REPO}: ZEHN Fix-Runden (insgesamt 156 bestätigte Bugs) sind bereits durch — siehe die BEREITS-GEFIXT-Liste, melde davon NICHTS erneut (auch keine Variante/Nachbarstelle eines bereits gefixten Bugs, außer sie ist ein GENUIN anderer, konkret belegbarer Fehler). Prüfe systematisch die noch UNGEPRÜFTEN Slices/Router auf dieselben Fehlerklassen: fehlende require_permission/require_lodgify_permission an Schreib-/Lese-Endpunkten (wie der properties-DELETE- und Stripe-Connect-IDOR-Fund!), Owner-/Tenant-Scope-Lücken bei per-ID-Zugriff auf externe Ressourcen, fehlendes RLS auf public-Tabellen, fehlende DB-Transaktionen/Atomarität, N+1/Pagination (PostgREST 1000-Cap in ANDEREN Aggregations-Queries), fehlende Idempotenz bei öffentlichen/retry-baren Endpunkten, €-Hardcodes, fehlende Realtime-Abos. Kandidaten: site_config/, content/, media/, quotes/, travel_agencies/, channels/, addons/, inbox/-Randpfade, guests/, owners/, weitere per-ID-Endpunkte die eine externe/fremde Ressourcen-ID ungeprüft weiterreichen. Sei streng: nur echte, am deployten Code belegbare Bugs, keine Vermutung.` },
]

async function findAndVerify(items, findPhase, verifyPhase) {
  // pipeline: jeder Finder läuft, seine Befunde werden sofort adversariell
  // von 2 unabhängigen Skeptikern gegengeprüft (kein Barrier zwischen Findern).
  const results = await pipeline(
    items,
    (d) => agent(
      `Du bist ein akribischer Bug-Finder für das NextDays-Monorepo. ${d.prompt}\n\n` +
      `${KNOWN_FIXED}\n\n` +
      `Melde NUR echte, am Code belegbare, NEUE Bugs (keine Stil-Nits, keine ` +
      `Vermutungen, KEINE der oben als gefixt gelisteten). Lies den ECHTEN, aktuellen ` +
      `Code — die genannten Fixes sind bereits im Repo. Für jeden Bug: Schweregrad, ` +
      `kurzer Titel, Datei:Zeile, konkretes Problem, Auslöse-Szenario. Wenn du nichts ` +
      `Belastbares Neues findest, gib eine leere Liste zurück. Setze dimension="${d.key}".`,
      { label: `find:${d.key}`, phase: findPhase, schema: FINDINGS_SCHEMA, effort: 'high' },
    ),
    (result, d) => {
      const findings = (result && result.findings) || []
      if (!findings.length) return []
      // Jeder Fund → 2 unabhängige Skeptiker, die zu WIDERLEGEN versuchen.
      return parallel(
        findings.flatMap((f) => [0, 1].map((skeptic) => () =>
          agent(
            `Du bist Skeptiker #${skeptic + 1}. Versuche, diesen gemeldeten Bug zu WIDERLEGEN, ` +
            `indem du den echten Code in ${REPO} liest. Ist er WIRKLICH ein Bug, oder übersieht ` +
            `der Melder einen Schutz (Constraint, Guard, RLS, Validierung, Transaktion)?\n\n` +
            `Bug: [${f.severity}] ${f.title}\nDatei: ${f.file}:${f.line || '?'}\n` +
            `Problem: ${f.problem}\nSzenario: ${f.scenario}\n\n` +
            `Antworte real=true NUR wenn du den Bug am Code bestätigen kannst; real=false, ` +
            `wenn ein Schutz existiert oder das Szenario nicht eintreten kann.`,
            { label: `verify:${d.key}:${skeptic}`, phase: verifyPhase, schema: VERDICT_SCHEMA, effort: 'high' },
          ).then((v) => ({ finding: f, skeptic, verdict: v })),
        )),
      )
    },
  )
  // Nur Befunde, die BEIDE Skeptiker als real bestätigen (kein Widerspruch).
  const byFinding = new Map()
  for (const votes of results) {
    if (!votes) continue
    for (const v of votes) {
      if (!v) continue
      const key = `${v.finding.file}:${v.finding.line}:${v.finding.title}`
      if (!byFinding.has(key)) byFinding.set(key, { finding: v.finding, reals: 0, total: 0, reasons: [] })
      const rec = byFinding.get(key)
      rec.total++
      if (v.verdict && v.verdict.real) rec.reals++
      if (v.verdict) rec.reasons.push(`#${v.skeptic}: ${v.verdict.reason}`)
    }
  }
  const confirmed = []
  const plausible = []
  for (const rec of byFinding.values()) {
    if (rec.reals === rec.total && rec.total >= 2) confirmed.push({ ...rec.finding, verify: rec.reasons })
    else if (rec.reals >= 1) plausible.push({ ...rec.finding, votes: `${rec.reals}/${rec.total}`, verify: rec.reasons })
  }
  return { confirmed, plausible }
}

phase('Loop1-Finden')
log(`Loop 1: ${L1_DIMENSIONS.length} datei-lokale Finder + je 2 Skeptiker`)
const loop1 = await findAndVerify(L1_DIMENSIONS, 'Loop1-Finden', 'Loop1-Verify')
log(`Loop 1 fertig: ${loop1.confirmed.length} bestätigt, ${loop1.plausible.length} plausibel`)

phase('Loop2-Traces')
log(`Loop 2: ${L2_TRACES.length} End-to-End-Traces + je 2 Skeptiker`)
const loop2 = await findAndVerify(L2_TRACES, 'Loop2-Traces', 'Loop2-Verify')
log(`Loop 2 fertig: ${loop2.confirmed.length} bestätigt, ${loop2.plausible.length} plausibel`)

phase('Synthese')
// dedup über beide Loops (file:line).
const allConfirmed = [...loop1.confirmed, ...loop2.confirmed]
const seen = new Set()
const deduped = []
for (const f of allConfirmed) {
  const key = `${f.file}:${f.line}`
  if (seen.has(key)) continue
  seen.add(key)
  deduped.push(f)
}
const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
deduped.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))

return {
  confirmed: deduped,
  plausible: [...loop1.plausible, ...loop2.plausible],
  counts: {
    loop1_confirmed: loop1.confirmed.length,
    loop2_confirmed: loop2.confirmed.length,
    deduped_confirmed: deduped.length,
    plausible: loop1.plausible.length + loop2.plausible.length,
    critical: deduped.filter((f) => f.severity === 'CRITICAL').length,
    high: deduped.filter((f) => f.severity === 'HIGH').length,
  },
}
