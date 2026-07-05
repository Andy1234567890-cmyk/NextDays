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
- WhatsApp-Webhook fail-closed; Dockerfile HOSTNAME; diverse EUR/Brand-Hardcodes, ItemsTable MwSt, Monatsgitter-Realtime`

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
  { key: 'trace-luecken-kritik', prompt: `Vollständigkeits-Kritiker für ${REPO}: Welche Bereiche hat die letzte Fix-Runde (6 Critical + 17 High) NICHT berührt und könnten dieselben Fehlerklassen haben? Denke an: inbox/scheduler.py (Doppelversand), pricing/resolver.py + recompute.py, guests/, addons/, payments/, public_portal/, site_config/, weitere RPCs/Migrationen mit offenen Grants (wie 0107 gerade fand!), fehlende DB-Transaktionen wo mehrere Schreibvorgänge atomar sein müssten, N+1 bei 1000 Usern, fehlende Pagination-Limits. Prüfe deployte Realität, nicht Vermutung.` },
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
