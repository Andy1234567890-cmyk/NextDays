export const meta = {
  name: 'wurzel-audit',
  description: 'Einmaliger Audit gegen die 5 Wurzel-Regeln (CLAUDE.md) — sucht Regel-VERSTÖSSE, keine Einzelbugs; jeder Verstoß adversariell gegengeprüft; laeuft genau EINMAL, kein Relaunch',
  phases: [
    { title: 'Regel-Audit', detail: 'je Wurzelregel ein Auditor ueber die ganze Codebase' },
    { title: 'Verify', detail: '2 unabhaengige Skeptiker je Verstoss' },
    { title: 'Bericht', detail: 'pro Regel: eingehalten oder wo verletzt' },
  ],
}

const REPO = '/Users/andystaudinger/NextDays'

// Die 5 Wurzelregeln aus CLAUDE.md — der Auditor sucht VERSTÖSSE gegen die Regel,
// NICHT beliebige Bugs. Das ist der Unterschied zum alten Symptom-Loop.
const REGELN = [
  {
    key: 'w1-alt-neu-diff',
    regel: 'Wurzel 1: Jede Aktion, die Naechte/Sperren/availability/Restriktionen NEU setzt, MUSS die durch die Aenderung freigewordenen ALTEN pflegen (Alt/Neu-Diff). Kalendernaechte einer Reservierung nur ueber _release_nights; OTA-Modifikation ueber _free_ota_nights mit vorab gesichertem Alt-Zeitraum.',
    suche: 'Suche Stellen, die einen Zeitraum/ein Set NEU belegen/aktualisieren (availability, stop_sell, ari_outbox, ari_restriction_outbox, reservations move/update, calendar block/unblock, channel_manager sync/push), aber die GERAEUMTEN alten Werte NICHT freigeben/zuruecksetzen. Auch: inline kopierte Freigabe-Logik statt _release_nights/_free_ota_nights.',
  },
  {
    key: 'w2-idempotenz',
    regel: 'Wurzel 2: Jede retrybare/oeffentliche/webhook-/geldbewegende Operation MUSS idempotent sein BEVOR der Seiteneffekt passiert (Zustand wiederverwenden, status/claim-Guard, UNIQUE-Backstop).',
    suche: 'Suche Operationen, die bei zweitem Aufruf (Doppelklick/Retry/Webhook-Redelivery) einen zweiten Effekt erzeugen: zweiter PaymentIntent/Charge/Refund/Hold, zweite Buchung, zweiter Job/Enqueue, zweite E-Mail/Nachricht, zweite Rechnung/Nummer, doppelter Insert — ohne _reuse_pending_intent-artige Wiederverwendung, status-Guard oder DB-UNIQUE. Pruefe payments, addons, jobs/queue, inbox, booking_engine, jede webhook-Ingest, jeden oeffentlichen POST.',
  },
  {
    key: 'w3-tenant-scope',
    regel: 'Wurzel 3: JEDER per-ID-Zugriff MUSS explizit auf tenant/owner scopen (Service-Role umgeht RLS). Load+Scope untrennbar (load_scoped oder _require_own_*). Kein rohes inline !=tenant_id nach ungescoptem Load.',
    suche: 'Suche Endpunkte/Methoden, die per Client-ID (reservation_id, invoice_id, payment_id, task_id, property_id, channex_*_id, customer_id, statement_id, page_id, agency_id, addon_id, owner_id) auf eine Ressource zugreifen OHNE tenant/owner-Scope, ODER die eine Ressource laden und den Scope erst spaeter (vergessbar) pruefen, ODER fehlende require_permission/require_.._permission. Pruefe ALLE Slices + Router.',
  },
  {
    key: 'w4-waehrung-fallback',
    regel: 'Wurzel 4: NIE €/EUR hardcoden, NIE erfundene Fallback-Werte. Waehrung aus den Daten; fehlt sie -> klar fehlschlagen (422), nicht ersetzen.',
    suche: 'Suche €/EUR-Literale, "|| \'EUR\'"/"|| 19"/andere erfundene Defaults, formatCurrency/Intl OHNE Waehrungsargument, Mischsummen ueber mehrere Waehrungen, eigene Waehrungs-Formatierer mit EUR-Fallback statt lib/currency. Pruefe apps/api (Rechnung/Pricing/Dashboard/Statements/Channex-Import) UND apps/web (finance, kalender, objekte, quotes, hooks/pdf, lib).',
  },
  {
    key: 'w5-fehlerbehandlung',
    regel: 'Wurzel 5: Kein breites except, das ein Kontroll-Signal verschluckt und still Erfolg markiert. Angreifer-Input darf keinen 500 werfen. Secret/Signatur fehlt -> fail-CLOSED.',
    suche: 'Suche breite except-Bloecke, die ein Signal (ChannexBudgetExhausted, 23505-Konflikt, Retry) verschlucken und danach done/Erfolg markieren; Secret-/Signatur-Vergleiche NICHT ueber secrets_match (Timing/500-Risiko); fail-open statt fail-closed bei fehlendem Secret/fehlender Signatur; falscher HTTP-Code auf Angreifer-Input. Pruefe core/security, core/ratelimit, worker, alle */router.py mit webhook/cron/public-Endpunkten.',
  },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    verstoesse: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
          regel: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          verstoss: { type: 'string' },
          szenario: { type: 'string' },
        },
        required: ['severity', 'regel', 'file', 'verstoss', 'szenario'],
      },
    },
  },
  required: ['verstoesse'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { real: { type: 'boolean' }, grund: { type: 'string' } },
  required: ['real', 'grund'],
}

const KNOWN = `Bereits an der Wurzel geschlossen (die zentralen Helfer existieren — melde NUR STELLEN, die sie NICHT nutzen bzw. die Regel VERLETZEN, nicht die Helfer selbst): _release_nights + _free_ota_nights (Wurzel 1), _reuse_pending_intent (Wurzel 2), core.supabase.load_scoped + _require_own_* (Wurzel 3), lib/currency.formatCurrency/currencySymbol + owner_statements Tenant-Waehrung (Wurzel 4), core.security.secrets_match + Worker-Signal-Handling (Wurzel 5). 156 Einzelbugs aus 10 Runden sind gefixt — melde KEINE davon erneut, nur GENUIN offene Regel-Verstoesse.`

phase('Regel-Audit')
log(`Audit gegen ${REGELN.length} Wurzelregeln — sucht VERSTÖSSE, laeuft EINMAL`)

const perRegel = await pipeline(
  REGELN,
  (r) => agent(
    `Du bist ein Wurzel-Auditor fuer das NextDays-Monorepo in ${REPO}. Pruefe die ` +
    `Codebase auf VERSTÖSSE gegen GENAU DIESE Regel — nicht auf beliebige Bugs.\n\n` +
    `REGEL — ${r.regel}\n\nSUCHE: ${r.suche}\n\n${KNOWN}\n\n` +
    `Lies den ECHTEN, aktuellen Code. Fuer jeden Verstoss: severity, regel="${r.key}", ` +
    `Datei:Zeile, konkreter Verstoss, Ausloese-Szenario. Wenn die Regel ueberall ` +
    `eingehalten wird, gib eine LEERE Liste zurueck — das ist ein gueltiges, ` +
    `ehrliches Ergebnis, KEIN Grund weiterzusuchen. Nur echte, am Code belegbare ` +
    `Verstoesse, keine Vermutung.`,
    { label: `audit:${r.key}`, phase: 'Regel-Audit', schema: FINDINGS_SCHEMA, effort: 'high' },
  ),
  (result, r) => {
    const v = (result && result.verstoesse) || []
    if (!v.length) return { regel: r.key, eingehalten: true, verstoesse: [] }
    return parallel(
      v.flatMap((f) => [0, 1].map((s) => () =>
        agent(
          `Du bist Skeptiker #${s + 1}. Widerlege diesen gemeldeten Regel-Verstoss, ` +
          `indem du den echten Code in ${REPO} liest. Ist die Regel WIRKLICH verletzt, ` +
          `oder uebersieht der Melder einen vorhandenen Schutz (Helfer, Guard, ` +
          `Constraint, Validierung)?\n\nRegel: ${f.regel}\n[${f.severity}] ` +
          `${f.file}:${f.line || '?'}\nVerstoss: ${f.verstoss}\nSzenario: ${f.szenario}\n\n` +
          `real=true NUR wenn der Verstoss am Code bestaetigt ist; real=false sonst.`,
          { label: `verify:${r.key}:${s}`, phase: 'Verify', schema: VERDICT_SCHEMA, effort: 'high' },
        ).then((vd) => ({ finding: f, verdict: vd })),
      )),
    ).then((votes) => {
      const byF = new Map()
      for (const vt of votes) {
        if (!vt) continue
        const k = `${vt.finding.file}:${vt.finding.line}:${vt.finding.verstoss}`
        if (!byF.has(k)) byF.set(k, { finding: vt.finding, reals: 0, total: 0, gruende: [] })
        const rec = byF.get(k)
        rec.total++
        if (vt.verdict && vt.verdict.real) rec.reals++
        if (vt.verdict) rec.gruende.push(vt.verdict.grund)
      }
      const bestaetigt = [...byF.values()]
        .filter((rec) => rec.reals === rec.total && rec.total >= 2)
        .map((rec) => ({ ...rec.finding, verify: rec.gruende }))
      return { regel: r.key, eingehalten: bestaetigt.length === 0, verstoesse: bestaetigt }
    })
  },
)

phase('Bericht')
const alle = perRegel.flatMap((p) => p.verstoesse)
const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
alle.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))

return {
  regeln: perRegel.map((p) => ({
    regel: p.regel,
    eingehalten: p.eingehalten,
    verstoesse: p.verstoesse.length,
  })),
  verstoesse: alle,
  zusammenfassung: {
    regeln_eingehalten: perRegel.filter((p) => p.eingehalten).length,
    regeln_verletzt: perRegel.filter((p) => !p.eingehalten).length,
    verstoesse_total: alle.length,
    critical: alle.filter((f) => f.severity === 'CRITICAL').length,
    high: alle.filter((f) => f.severity === 'HIGH').length,
  },
}
