export const meta = {
  name: 'bug-hunt-loop-1b',
  description: 'Loop 1 (robust, Wellen à 5): 14 Finder-Dimensionen übers ganze Projekt + 2 adversarielle Verifizierer je Fund',
  phases: [
    { title: 'Finden', detail: '14 Finder in 3 Wellen (max 5 parallel)' },
    { title: 'Verifizieren', detail: '2 unabhängige Skeptiker je Fund' },
  ],
}

const REPO = '/Users/andystaudinger/NextDays'

const KONVENTIONEN = `PROJEKT-KONVENTIONEN (Verstoß = Befund!):
- Backend nutzt service-role-Key → RLS wird UMGANGEN: JEDE Query auf Tenant-Tabellen braucht explizites .eq("tenant_id", ...). Owner sieht nur SEINE Objekte (read-only). Ein Objekt gehört genau EINEM Eigentümer.
  AUSNAHME: der ÖFFENTLICHE Marktplatz (booking_engine/service.py list_listings, plattform-Sichten) ist BEWUSST tenant-übergreifend und nutzt .eq("status","active") — das ist KEIN Bug, nicht melden.
- JEDE public-Tabelle in supabase/migrations MUSS RLS haben. Partielle Unique-Indizes + PostgREST-upsert(on_conflict) = 42P10-Falle (braucht RPC).
- KEINE Fallback-/Default-Ersatzwerte bei fehlenden Daten — klar fehlschlagen statt erfinden.
- NIE €/"EUR" hartkodieren (27 EU-Länder); Währung aus den Daten, formatCurrency nutzen.
- Channex-Restrictions (min_stay/rate/stop_sell/CTA/CTD) MÜSSEN pro Datum (date) gesendet werden; date_from/date_to wird von Channex still ignoriert (200 ohne Effekt). availability ist NICHT betroffen.
- Stop-Sell sperrt den Tag auf ALLEN Kanälen, keine Ausnahme.
- UI: Realtime-Pflicht (useRealtime/WebSocket, KEIN Polling); rem statt px (px nur Border/SVG ≤2px); keine arbitrary Hex-Farben (bg-[#…]); Buttons rounded-full; Kundentexte NIE "Channex" (→ "Booking, Airbnb & Co."/"Portale"); Marke heißt "myNextDays"; User-Strings über next-intl.
- Frontend↔Backend nur über Proxy-Route + lib/<domäne>.ts-Muster.
- Next.js-standalone-Dockerfiles brauchen ENV HOSTNAME=0.0.0.0.
- Kein "Claude"/KI-Verweis irgendwo im Repo.`

const REGELN = `ARBEITSREGELN:
- Repo: ${REPO}. Du DARFST lesen (Read/Grep/Glob/Bash git diff|status|cat) und read-only per ssh root@65.21.144.136 prüfen (docker ps/inspect/logs, psql SELECT).
- STRIKT VERBOTEN: jede Änderung — kein Edit/Write, kein docker rm/restart/deploy, kein UPDATE/INSERT/DELETE, kein commit/push.
- Auch UNCOMMITTETE Änderungen (git status zeigt viele modifizierte Dateien) sind Prüfgegenstand.
- Jeder Befund braucht KONKRETEN Beweis: Datei+Zeile+Code-Zitat + konkretes Fehlerszenario (Eingabe/Zustand → falsches Verhalten). Keine Vermutungen, keine Stil-Nörgelei ohne Auswirkung.
- ARBEITE ZÜGIG: höchstens ~15 Tool-Aufrufe, dann liefere. Lieber 2 solide Befunde als endloses Lesen.
- Max. 6 Befunde, die schwersten zuerst.`

const FINDINGS = {
  type: 'object', required: ['findings'],
  properties: { findings: { type: 'array', items: {
    type: 'object', required: ['title', 'file', 'severity', 'description', 'evidence', 'szenario'],
    properties: {
      title: { type: 'string' }, file: { type: 'string' }, line: { type: 'number' },
      severity: { enum: ['critical', 'high', 'medium', 'low'] },
      description: { type: 'string' }, evidence: { type: 'string' }, szenario: { type: 'string' },
    } } } },
}
const VERDICT = {
  type: 'object', required: ['refuted', 'reason'],
  properties: { refuted: { type: 'boolean' }, reason: { type: 'string' },
    severity_neu: { enum: ['critical', 'high', 'medium', 'low', 'unchanged'] } },
}

const FINDERS = [
  { key: 'tenant-scoping', prompt: `Sicherheits-Audit Tenant-Isolation: Durchsuche apps/api/src/features/ nach Supabase-Queries (.table(...)) OHNE explizites .eq("tenant_id",...) (Backend-Client nutzt service-role-Key, UMGEHT RLS!). Prüfe auch Owner-Scope, Guest-Masking, Router-Endpunkte ohne Berechtigungsprüfung, IDs aus Payload ohne Ownership-Check. ACHTUNG: der öffentliche Marktplatz (booking_engine list_listings) ist bewusst tenant-übergreifend — NICHT melden.` },
  { key: 'rls-migrations', prompt: `Prüfe supabase/migrations/: Hat JEDE public-Tabelle RLS + Policies? Partielle Unique-Indizes mit PostgREST-upsert (42P10)? Fehlende Indizes auf tenant_id/FK bei großen Tabellen? Nicht-idempotente Migrations? SECURITY-DEFINER-Funktionen ohne search_path? Zu breite Grants (execute für anon wo service_role gehört)?` },
  { key: 'buchhaltung', prompt: `Prüfe Buchhaltung (auch UNCOMMITTET — git diff!): apps/api/src/features/buchhaltung/ (service.py, reservation_invoice.py, storno.py, schemas.py). Geld-Rechnung (Rundung, cents, MwSt.), Storno-Logik (Doppel-/Storno-von-Storno/Teilstorno), Rechnungsnummern (Lücke/Duplikat/Race), Währung aus Daten, Tenant-Scope, Zustandsübergänge.` },
  { key: 'pricing-calendar', prompt: `Prüfe Pricing+Kalender (auch UNCOMMITTET — git diff!): apps/api/src/features/pricing/ (resolver.py, recompute.py), calendar/ (service.py). Datums-Grenzfälle (An-/Abreisetag, inkl./exkl. Ranges, UTC/Zeitzonen), Überlappung, price_overrides als EINZIGE Preisquelle, Off-by-one Nächte vs. Tage.` },
  { key: 'reservations', prompt: `Prüfe Reservierungen (auch UNCOMMITTET!): apps/api/src/features/reservations/ (router.py, service.py, tests/test_check_in_out.py), owners/, properties/. Doppelbuchungs-Races, Check-in/out-Zustandsmaschine, Validierung (Vergangenheit, from>to), fehlende Realtime/ARI-Folge, Tenant-/Owner-Scope.` },
  { key: 'worker-jobs', prompt: `Prüfe Job-Queue: apps/api/src/worker.py, jobs/ (queue.py, channex_budget.py), migrations 0102/0103 (claim_jobs, enqueue_job, requeue_stuck_jobs). Races bei mehreren Workern, dedup_key-Coalescing, Retry/Backoff/attempts (_defer!), Reaper (300s requeue → laufender langer Job doppelt?), Budget-Gate, Heartbeat, Shutdown-Drain.` },
  { key: 'channex-ari', prompt: `Prüfe Channex: apps/api/src/features/channel_manager/ (common.py, content_sync.py, ari*, outbox, webhooks). RESTRICTIONS pro Datum (date_from/date_to ignoriert Channex still!), availability ausgenommen. Facility-Mapping, Reconcile, Outbox (Reihenfolge/Retry/verlorene Pushes), Webhook-Signatur, Channex-Ausfall-Handling, Stop-Sell (ALLE Kanäle).` },
  { key: 'security-auth', prompt: `Sicherheits-Audit: apps/api/src/core/ (security.py, ratelimit*.py, config.py, supabase.py), apps/web/middleware.ts + Proxy-Routen (app/api/). JWT (aud/exp/alg), Rate-Limit-Bypass (XFF/hops), Secrets-Leak in Logs/Responses, fehlende Auth, CORS zu breit, SSRF/Injection in Proxies, Webhooks ohne Signatur, service-role-Key Richtung Frontend.` },
  { key: 'web-finance', prompt: `Prüfe Finance-Frontend (auch UNCOMMITTET — git diff!): apps/web/components/finance/ (create-invoice/, SendDocumentModal, pdf-templates/ + common/ItemsTable, TotalsDisplay). Rechen-/Anzeige-Fehler (Summen/MwSt./Rabatt), hartkodiertes €/EUR statt formatCurrency, hartkodierte Strings statt next-intl, Zustands-Bugs (use-invoice-actions), PDF-Templates die bei fehlenden Feldern crashen/falsch rechnen.` },
  { key: 'web-kalender', prompt: `Prüfe Kalender/Objekte-Frontend (auch UNCOMMITTET!): apps/web/components/kalender/ (calendar-board, calendar-views, reservation-detail-slider), app/(dashboard)/kalender+objekte. Realtime-Pflicht (useRealtime fehlt? Polling=Bug), Stale-State nach Mutationen, Datums-/Zeitzonen-Fehler im Board, Drag/Resize, Keys/Memoization die falsche Zellen rendern.` },
  { key: 'conventions-ui', prompt: `Konventions-Audit apps/web/ (grep, dann Treffer LESEN): px außer Border/SVG≤2px; arbitrary Hex (bg-[#…]); Buttons ohne rounded-full; "Channex" in KUNDENtexten (nicht Code-Kommentare/Logs); "NextDays" statt "myNextDays" in UI; hartkodierte User-Strings statt next-intl; hartkodiertes €/EUR. NUR echte Treffer mit Datei+Zeile.` },
  { key: 'contract-fe-be', prompt: `Vertrags-Audit FE↔BE: Vergleiche apps/web/lib/*.ts + app/api/-Proxies mit FastAPI-Routern/Schemas (apps/api/src/features/*/router.py+schemas.py). Feld-Mismatches (Name/Typ/optional), Endpunkte die FE ruft aber BE nicht (mehr) hat, Fehlerformate, snake_case/camelCase, veraltete Annahmen nach UNCOMMITTETEN Schema-Änderungen (git diff apps/api/src/features/*/schemas.py!).` },
  { key: 'infra-compose', prompt: `Prüfe Deploy/Infra: deploy/supabase/docker-compose.yml, deploy/api-standalone/, redis-standalone/, worker/, kong/, backup/, apps/*/Dockerfile. Healthcheck-Fehler, Netz-/Alias-Inkonsistenzen (supabase-internal/coolify), Volume-/Bind-Mount-Risiken, Memory-Limits vs. Last, Env-Var-Fallen (\${VAR}), depends_on/restart-Logik, was bei Neustart/Deploy bricht. Read-only ssh erlaubt.` },
  { key: 'worktree-hygiene', prompt: `Prüfe den UNCOMMITTETEN Arbeitsstand: git status + git diff komplett (auch CHANGELOG.md). Halbfertige Änderungen (Code referenziert Nicht-Existentes), Debug-Reste (console.log/print/auskommentiert), abgeschwächte Test-Asserts, Importe ins Leere, Inkonsistenzen zwischen geänderten Dateien (A nutzt Feld, B liefert nicht), blockierende TODO/FIXME.` },
]

phase('Finden')
log(`Loop 1 (robust): 14 Finder in Wellen à 5…`)
// Wellen à 5 statt 14 auf einmal → kein Concurrency-Stau (der den ersten Lauf hängen ließ).
const WELLEN = [FINDERS.slice(0, 5), FINDERS.slice(5, 10), FINDERS.slice(10)]
let alle = []
for (let w = 0; w < WELLEN.length; w++) {
  log(`Welle ${w + 1}/${WELLEN.length} (${WELLEN[w].length} Finder)…`)
  const res = await parallel(WELLEN[w].map(f => () =>
    agent(`${f.prompt}\n\n${KONVENTIONEN}\n\n${REGELN}`, { label: `find:${f.key}`, phase: 'Finden', schema: FINDINGS })
      .then(r => (r?.findings || []).map(b => ({ ...b, dim: f.key })))
  ))
  alle = alle.concat(res.filter(Boolean).flat())
  log(`  Welle ${w + 1} fertig — bisher ${alle.length} Roh-Befunde`)
}

const norm = t => (t || '').toLowerCase().replace(/[^a-zä-ü0-9]+/g, ' ').trim().slice(0, 48)
const seen = new Set()
const dedup = []
for (const b of alle) {
  const k = `${b.file}|${norm(b.title)}`
  if (seen.has(k)) continue
  seen.add(k); dedup.push(b)
}
log(`${dedup.length} nach Dedup (${alle.length - dedup.length} Duplikate)`)

phase('Verifizieren')
const verified = await parallel(dedup.map(b => () =>
  parallel([1, 2].map(n => () => agent(
    `Du bist Skeptiker Nr. ${n}. WIDERLEGE diesen Bug-Befund, wenn er nicht stimmt. Lies den echten Code (${REPO}, auch uncommitted). Prüfe hart: Existiert der Code so (Datei+Zeile)? Tritt das Szenario real ein? Absicht/dokumentiert/anderswo abgefangen (z.B. öffentlicher Marktplatz ist bewusst tenant-übergreifend)? Echte Auswirkung (Korrektheit/Geld/Sicherheit/Datenverlust/Konvention)? refuted=true wenn falsch/kein echter Bug/ohne Auswirkung; bei Unsicherheit refuted=true.

BEFUND (${b.dim}):
Titel: ${b.title}
Datei: ${b.file}${b.line ? ':' + b.line : ''}
Schwere: ${b.severity}
Beschreibung: ${b.description}
Beweis: ${b.evidence}
Szenario: ${b.szenario}

${KONVENTIONEN}
Read-only! Höchstens ~10 Tool-Aufrufe, dann urteile.`,
    { label: `verify${n}:${(b.file || '').split('/').pop()}`, phase: 'Verifizieren', schema: VERDICT }
  )))
    .then(votes => {
      const v = votes.filter(Boolean)
      return { ...b, refutes: v.filter(x => x.refuted).length, gruende: v.map(x => x.reason),
        severity: v.find(x => x.severity_neu && x.severity_neu !== 'unchanged')?.severity_neu || b.severity }
    })
))

const ok = verified.filter(Boolean)
const rank = { critical: 0, high: 1, medium: 2, low: 3 }
const confirmed = ok.filter(b => b.refutes === 0).sort((a, z) => rank[a.severity] - rank[z.severity])
const plausibel = ok.filter(b => b.refutes === 1).sort((a, z) => rank[a.severity] - rank[z.severity])
log(`Loop 1 fertig: ${confirmed.length} bestätigt, ${plausibel.length} plausibel, ${ok.filter(b => b.refutes >= 2).length} verworfen`)

return {
  bestaetigt: confirmed.map(b => ({ dim: b.dim, severity: b.severity, title: b.title, file: b.file, line: b.line, szenario: b.szenario, beschreibung: b.description })),
  plausibel: plausibel.map(b => ({ dim: b.dim, severity: b.severity, title: b.title, file: b.file, line: b.line, szenario: b.szenario, gruende: b.gruende })),
  statistik: { roh: alle.length, dedup: dedup.length, bestaetigt: confirmed.length, plausibel: plausibel.length },
  seenTitles: dedup.map(b => b.title),
}