export const meta = {
  name: 'fehlerklassen-audit',
  description: 'Erschöpfende Klassifikation ALLER wiederkehrenden Fehlerklassen über die ganze NextDays-Codebase, an der Wurzel, adversariell gegengeprüft, loop-until-dry',
  phases: [
    { title: 'Klassen-Sweep', detail: 'je Fehlerklasse ein erschöpfender Finder über alle Slices' },
    { title: 'Verify', detail: '2 unabhängige Skeptiker je Befund' },
    { title: 'Slice-Kritiker', detail: 'pro Slice: was wurde übersehen?' },
    { title: 'Synthese', detail: 'Wurzel-Klassen + alle offenen Fundstellen' },
  ],
}

const REPO = '/Users/andystaudinger/NextDays'

// Die 25 API-Slices + core/jobs — jeder Finder deckt ALLE ab (kein Slice fällt raus).
const SLICES = [
  'addons', 'auth', 'booking_engine', 'buchhaltung', 'calendar', 'channel_manager',
  'content', 'crm', 'dashboard', 'guests', 'inbox', 'ocr', 'owner_statements',
  'owners', 'payments', 'pricing', 'properties', 'public_portal', 'rates',
  'reservations', 'site_config', 'tasks', 'travel_agencies', 'whatsapp',
]

// Fehlerklassen — EMPIRISCH aus den 156 bereits bestätigten Bugs abgeleitet, plus
// die Standard-Schwachstellenklassen für Multi-Tenant-SaaS + Zahlungen + externe
// Sync. Jede Klasse wird ERSCHÖPFEND über die GANZE Codebase getrieben — Ziel ist
// die Wurzel-Klasse UND jede noch offene Fundstelle, nicht nur ein Beispiel.
const FEHLERKLASSEN = [
  {
    key: 'idempotenz',
    title: 'Fehlende Idempotenz / Doppelausführung',
    prompt: `Fehlende Idempotenz: retrybare/öffentliche/webhook-/doppelklick-fähige Operationen, die bei zweitem Aufruf einen zweiten Effekt erzeugen (zweite Zahlung/Erstattung/Kaution, zweite Buchung, zweiter Job, zweite E-Mail/Nachricht, zweite Rechnung/Nummer, doppelter Insert). Prüfe: fehlt ein Idempotency-Key, ein retrieve-vorhandenes, ein UNIQUE-Backstop, ein status/claim-Guard VOR dem Seiteneffekt? Bekannte Wurzel: create_deposit_hold, refund_payment, create_booking_payment, purchase_addons, enqueue_job, Inbox-Versand, Stripe-Webhook. Suche ALLE weiteren Stellen (jobs/queue, jede webhook-Ingest, jeder öffentliche POST).`,
  },
  {
    key: 'tenant-owner-scope',
    title: 'Fehlender Tenant-/Owner-Scope (IDOR, RLS-Bypass)',
    prompt: `Fehlender Tenant-/Owner-Scope bei Service-Role (RLS wird umgangen → Code MUSS explizit scopen). Jeder Endpunkt/jede Methode, die per Client-ID (reservation_id, invoice_id, payment_id, task_id, property_id, channex_*_id, customer_id, statement_id, account_id) auf eine Ressource zugreift, ohne zu prüfen dass sie dem tenant/owner gehört (§4.2 owner nur eigene Objekte, §4.3 staff/cleaner ohne Finanz-/Vertriebseinblick). Auch: fehlende require_permission/require_.._permission, Client-Parameter der den Scope aufweitet, Fremd-FK ungeprüft weitergereicht. Bekannte Wurzel: Stripe-Connect-IDOR, /channel-manager/bookings, properties-DELETE, tasks-checklist, owner_expenses-FK, disconnect_channel. Suche ALLE per-ID-Zugriffe in JEDEM Slice + Router.`,
  },
  {
    key: 'rls-vollstaendigkeit',
    title: 'Fehlendes RLS auf public-Tabellen',
    prompt: `Fehlendes RLS: JEDE public-Tabelle in supabase/migrations/ braucht RLS (anon hat pauschale Grants, RLS ist der einzige methoden-unabhängige Backstop). Prüfe systematisch JEDE 'create table'-Anweisung gegen ein zugehöriges 'enable row level security' + Policy. Liste jede Tabelle OHNE RLS. Prüfe auch: SECURITY DEFINER-Funktionen mit zu weiten GRANTs an anon/authenticated, fehlende REVOKE.`,
  },
  {
    key: 'atomaritaet-race',
    title: 'Fehlende Atomarität / Race Conditions / halbe Zustände',
    prompt: `Fehlende Atomarität: mehrschrittige Schreibvorgänge ohne Transaktion/Advisory-Lock/guarded UPDATE, bei denen ein Fehler nach Schritt 1 einen halben Zustand hinterlässt, ODER zwei gleichzeitige Aufrufe sich überschreiben (TOCTOU: check-dann-write ohne Lock). Auch: Nebenläufigkeit fast-path vs Cron auf derselben Zeile ohne status-Guard, Insert+Update ohne Rollback, Nummernvergabe-Race. Bekannte Wurzel: create_reservation_atomic, Rechnungsnummern-Race, Doppel-Storno, convert_quote_to_invoice, ari_outbox pending-Guard, worker-Claim. Suche ALLE mehrschrittigen Writes in JEDEM Slice.`,
  },
  {
    key: 'externer-sync-diff',
    title: 'Externer Sync ohne Alt/Neu-Diff (Inventar-/Kalenderleck)',
    prompt: `Externer Sync (Channex/OTA/Stripe) ohne Alt/Neu-Diff: eine bestehende Entität wird auf neue Werte aktualisiert, aber die durch die Änderung freigewordenen alten Ressourcen (Kalendernächte, Sperren, availability, Restriktionen) werden nicht zurückgesetzt/freigegeben → Phantom-Belegung/Inventarverlust auf allen Kanälen. Bekannte Wurzel: OTA-Buchungs-Modifikation (Verkürzung/Verschiebung) gab Alt-Nächte nie frei; move()/cancel() Freigabe. Suche ALLE Stellen in channel_manager/bookings_sync, ari_push, reconcile, reservations/service (move/cancel/update), calendar, wo ein Zeitraum/Set aktualisiert wird ohne die Differenz zum alten Zustand zu behandeln.`,
  },
  {
    key: 'geld-steuer-korrektheit',
    title: 'Geld-/Steuer-/GoBD-Korrektheit',
    prompt: `Geld-/Steuer-/GoBD-Fehler: Kopf vs. Σ Positionen inkonsistent, Doppelfaktura (Add-ons/Rabatt zweimal), Kleinunternehmer §19 nicht durchgezogen (USt ausgewiesen wo verboten), Rundungsdrift in Decimal/float, Rabatt doppelt angewandt, Storno auf falschen Belegtyp, Rechnungsnummer mit Lücke/Doppel, finalisierte Belege mutierbar, Erstattung über Restbetrag hinaus. Bekannte Wurzel: build_positions-Fallback, Quote-§19, ItemsTable-Doppelrabatt, is_kleinunternehmer-Quelle, refund-Restbetrag, GoBD-Nummernkreis. Prüfe buchhaltung (service/reservation_invoice/storno), pricing/resolver, payments, addons, owner_statements — JEDE Betragsrechnung.`,
  },
  {
    key: 'waehrung-hardcode',
    title: 'Währungs-Hardcode / erfundene Fallback-Werte',
    prompt: `Währungs-/Fallback-Fehler (Regeln: kein €/EUR-Hardcode bei 27 EU-Ländern; NIE Fallback-/Default-Ersatzwerte, bei fehlenden Daten klar fehlschlagen statt erfinden). Suche: '|| EUR', "EUR"-Literale, €-Symbol in Labels/QR/PDF, formatCurrency-Aufrufe OHNE Währungsargument, Mischsummen über mehrere Währungen, sowie erfundene Defaults (|| 19 %, || 'draft', Fantasie-Ersatzwerte statt Fehler). Prüfe apps/web/components/finance, /kalender, /objekte, /quotes, hooks/pdf, lib, UND apps/api (Rechnung/Pricing/Dashboard/Channex-Import). Nenne jede Fundstelle.`,
  },
  {
    key: 'pagination-nplus1',
    title: 'PostgREST-1000-Cap / N+1 / stille Truncation',
    prompt: `Pagination/N+1: Aggregations-/Listen-Queries die über PostgREST laufen und den 1000-Zeilen-Cap (PGRST_DB_MAX_ROWS) still treffen → falsche Summen/unvollständige Listen (Umsatz, Auslastung, Forecast, Statements, Marktplatz). fetch_all_rows(core/supabase) ist der Fix — suche JEDE .select() auf potenziell >1000 Zeilen ohne Pagination, und N+1-Schleifen (pro Zeile eine Query). Prüfe ALLE Slices mit Aggregation/Report/Liste.`,
  },
  {
    key: 'realtime-fehlend',
    title: 'Fehlende Realtime-Abos (stale UI)',
    prompt: `Fehlende Realtime-Abos (Projektregel: JEDE Liste/Detail-UI MUSS useRealtime/WebSocket auf ALLE speisenden Tabellen abonnieren, kein Polling/Reload). Suche Listen/Detail-Komponenten in apps/web/components (kalender, objekte, finance, quotes, gaeste, inbox, dashboard, owner-statements, stop-sell, zahlungen, reisebueros, dynamic-pricing), die Daten anzeigen aber NICHT alle relevanten Tabellen abonnieren → stale Daten. Nenne Komponente + fehlende Tabelle(n).`,
  },
  {
    key: 'fehlerbehandlung-swallow',
    title: 'Verschluckte Exceptions / falscher Statuscode / fail-open',
    prompt: `Fehlerbehandlung: breite 'except Exception' die spezifische Signale (ChannexBudgetExhausted, Konflikt 23505, Retry-Signale) verschlucken → Job fälschlich 'done' statt deferred; unbehandelte Exception auf angreiferkontrolliertem Input → 500 statt 401/403 (z.B. compare_digest non-ASCII); fail-open statt fail-closed bei fehlendem Secret/Signatur; falscher HTTP-Code. Bekannte Wurzel: recompute _push_to_channex, worker _defer, secrets_match, WhatsApp fail-closed. Suche breite except-Blöcke + Secret-/Signaturprüfungen in ALLEN Slices + core.`,
  },
  {
    key: 'auth-secret',
    title: 'Auth-/Secret-/Signatur-Schwächen',
    prompt: `Auth/Secret/Signatur: Timing-unsicherer Secret-Vergleich (!= statt konstant-zeitig), Secret-Verwechslung (webhook-Secret autorisiert internen Endpunkt), fehlende/umgehbare Signaturprüfung an Webhooks, JWT-Bypass, Cron-Endpunkt ohne Guard, ratelimit umgehbar. Prüfe core/security, core/ratelimit*, ALLE */router.py mit webhook/cron/public-Endpunkten (whatsapp, channel_manager, payments/stripe, inbox, pricing, public_portal, booking_engine).`,
  },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
          klasse: { type: 'string' },
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          problem: { type: 'string' },
          scenario: { type: 'string' },
          root_cause: { type: 'string' },
        },
        required: ['severity', 'klasse', 'title', 'file', 'problem', 'scenario'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { real: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['real', 'reason'],
}

// KNOWN_FIXED aus dem Bug-Hunt-Loop laden wäre ideal; hier inline die Kernaussage:
// bereits gefixte Einzelstellen NICHT erneut melden, aber NEUE Fundstellen
// derselben Klasse SEHR WOHL (das ist der Zweck des Wurzel-Audits).
const KNOWN = `Bereits gefixt (NICHT die exakt gleiche Stelle erneut melden, aber JEDE ANDERE offene Fundstelle derselben Klasse schon): 156 Bugs aus 10 Runden — u.a. create_reservation_atomic, ari_outbox-Superseding, Rechnungsnummern-Race, Owner-Scope in owner_statements/calendar/reservations/buchhaltung/properties, Stripe-Connect-IDOR, /channel-manager/bookings-Scope, OTA-Modifikation-Freigabe, create_deposit_hold/refund-Idempotenz, Quote-§19, ItemsTable-Doppelrabatt, build_positions-Fallback, secrets_match, diverse EUR-Hardcodes, fetch_all_rows-Pagination, tasks-IDOR, owner_expenses-FK, RLS 0058/0059/0073/0085/0108-0116, worker-Claim/defer_count. Melde die WURZEL der Klasse + ALLE noch offenen Stellen.`

async function findAndVerify(items, findPhase, verifyPhase, extraContext) {
  const results = await pipeline(
    items,
    (d) => agent(
      `Du bist ein akribischer Wurzel-Auditor für das NextDays-Monorepo in ${REPO}. ` +
      `FEHLERKLASSE: ${d.title}\n\n${d.prompt}\n\n` +
      `Prüfe diese Klasse ERSCHÖPFEND über ALLE Slices (${SLICES.join(', ')}) plus ` +
      `apps/api/src/core, apps/api/src/jobs, supabase/migrations UND das relevante ` +
      `Frontend in apps/web. Lies den ECHTEN Code. ${extraContext || ''}\n\n${KNOWN}\n\n` +
      `Für JEDEN Fund: severity, klasse="${d.key}", title, Datei:Zeile, konkretes ` +
      `Problem, Auslöse-Szenario, root_cause (die zugrunde liegende Klasse). Sei ` +
      `vollständig — lieber eine Stelle zu viel als eine vergessen. Nur echte, am ` +
      `Code belegbare Bugs, keine Vermutung. Leere Liste nur wenn WIRKLICH nichts offen.`,
      { label: `sweep:${d.key}`, phase: findPhase, schema: FINDINGS_SCHEMA, effort: 'high' },
    ),
    (result, d) => {
      const findings = (result && result.findings) || []
      if (!findings.length) return []
      return parallel(
        findings.flatMap((f) => [0, 1].map((skeptic) => () =>
          agent(
            `Du bist Skeptiker #${skeptic + 1}. Versuche, diesen Befund zu WIDERLEGEN, ` +
            `indem du den echten Code in ${REPO} liest. Ist es WIRKLICH ein Bug, oder ` +
            `übersieht der Melder einen Schutz (Constraint, Guard, RLS, Validierung, ` +
            `Transaktion, bereits vorhandener Fix)?\n\nKlasse: ${f.klasse}\n` +
            `[${f.severity}] ${f.title}\nDatei: ${f.file}:${f.line || '?'}\n` +
            `Problem: ${f.problem}\nSzenario: ${f.scenario}\n\n` +
            `real=true NUR wenn am Code bestätigt; real=false wenn ein Schutz existiert.`,
            { label: `verify:${d.key}:${skeptic}`, phase: verifyPhase, schema: VERDICT_SCHEMA, effort: 'high' },
          ).then((v) => ({ finding: f, skeptic, verdict: v })),
        )),
      )
    },
  )
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
  for (const rec of byFinding.values()) {
    if (rec.reals === rec.total && rec.total >= 2) confirmed.push({ ...rec.finding, verify: rec.reasons })
  }
  return confirmed
}

// --- Runde 1: alle Fehlerklassen erschöpfend ---
phase('Klassen-Sweep')
log(`${FEHLERKLASSEN.length} Fehlerklassen, je erschöpfend über ${SLICES.length} Slices + core/jobs/migrations/web`)
let confirmed = await findAndVerify(FEHLERKLASSEN, 'Klassen-Sweep', 'Verify')
log(`Runde 1: ${confirmed.length} bestätigte Fundstellen`)

const seen = new Set(confirmed.map((f) => `${f.file}:${f.line}:${f.title}`))

// --- Slice-Kritiker: pro Slice ein Agent, der GEZIELT sucht was die Klassen-
// Finder in DIESEM Slice übersehen haben (andere Achse → fängt Lücken). ---
phase('Slice-Kritiker')
const alleKlassen = FEHLERKLASSEN.map((k) => k.title).join('; ')
const kritikItems = SLICES.map((s) => ({
  key: s,
  title: `Slice-Kritiker: ${s}`,
  prompt: `Prüfe AUSSCHLIESSLICH den Slice apps/api/src/features/${s}/ (Service, Router, Schemas) plus dessen Frontend, GEGEN ALLE diese Fehlerklassen gleichzeitig: ${alleKlassen}. Was hat ein klassen-fokussierter Sweep in GENAU diesem Slice übersehen? Gehe jede öffentliche Methode + jeden Endpunkt durch. Melde jede offene Stelle.`,
}))
const kritikConfirmed = await findAndVerify(kritikItems, 'Slice-Kritiker', 'Verify')
const kritikNeu = kritikConfirmed.filter((f) => !seen.has(`${f.file}:${f.line}:${f.title}`))
kritikNeu.forEach((f) => seen.add(`${f.file}:${f.line}:${f.title}`))
confirmed = [...confirmed, ...kritikNeu]
log(`Slice-Kritiker: ${kritikNeu.length} zusätzliche Fundstellen`)

// --- Synthese: nach Klasse gruppieren, nach Schwere sortieren ---
phase('Synthese')
const byKlasse = {}
for (const f of confirmed) {
  const k = f.klasse || f.root_cause || 'sonstige'
  ;(byKlasse[k] = byKlasse[k] || []).push(f)
}
const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
confirmed.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))

return {
  wurzelklassen: FEHLERKLASSEN.map((k) => ({
    key: k.key,
    titel: k.title,
    offene_fundstellen: (byKlasse[k.key] || []).length,
  })),
  alle_fundstellen: confirmed,
  counts: {
    total: confirmed.length,
    critical: confirmed.filter((f) => f.severity === 'CRITICAL').length,
    high: confirmed.filter((f) => f.severity === 'HIGH').length,
    medium: confirmed.filter((f) => f.severity === 'MEDIUM').length,
    low: confirmed.filter((f) => f.severity === 'LOW').length,
    je_klasse: Object.fromEntries(Object.entries(byKlasse).map(([k, v]) => [k, v.length])),
  },
}
