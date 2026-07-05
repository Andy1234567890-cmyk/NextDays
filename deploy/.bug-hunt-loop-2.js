export const meta = {
  name: 'bug-hunt-loop-2',
  description: 'Loop 2: frische Blickwinkel + Datenfluss-Traces + Vollständigkeits-Kritiker, kennt Loop-1-Funde (kein Doppel)',
  phases: [
    { title: 'Trace', detail: 'End-to-End-Datenflüsse + Grenzfälle jagen' },
    { title: 'Kritik', detail: 'Vollständigkeits-Kritiker: was hat Loop 1 übersehen?' },
    { title: 'Verifizieren', detail: '2 Skeptiker je neuem Fund' },
  ],
}

const REPO = '/Users/andystaudinger/NextDays'
// args = { seenTitles: [...], loop1Confirmed: [...] } aus Loop 1
const seenTitles = (args && args.seenTitles) || []
const loop1Kurz = (args && args.loop1Confirmed) || []

const KONVENTIONEN = `PROJEKT-KONVENTIONEN (Verstoß = Befund!):
- Backend nutzt service-role-Key → RLS UMGANGEN: JEDE Query auf Tenant-Tabellen braucht explizites .eq("tenant_id", ...). Owner sieht nur SEINE Objekte (read-only). Ein Objekt = genau EIN Eigentümer.
- JEDE public-Tabelle MUSS RLS haben. Partielle Unique-Indizes + PostgREST-upsert(on_conflict) = 42P10-Falle (braucht RPC).
- KEINE Fallback-/Default-Ersatzwerte — bei fehlenden Daten klar fehlschlagen.
- NIE €/"EUR" hartkodieren; Währung aus Daten, formatCurrency.
- Channex-Restrictions (min_stay/rate/stop_sell/CTA/CTD) MÜSSEN pro Datum (date); date_from/date_to wird still ignoriert (200 ohne Effekt). availability NICHT betroffen.
- Stop-Sell sperrt den Tag auf ALLEN Kanälen.
- UI: Realtime-Pflicht (useRealtime/WebSocket, KEIN Polling); rem statt px; keine arbitrary Hex; Buttons rounded-full; Kundentexte NIE "Channex"; Marke "myNextDays"; User-Strings über next-intl.
- Frontend↔Backend nur über Proxy-Route + lib/<domäne>.ts.
- Next.js-standalone-Dockerfiles brauchen ENV HOSTNAME=0.0.0.0.`

const REGELN = `ARBEITSREGELN:
- Repo: ${REPO}. Lesen erlaubt (Read/Grep/Glob/Bash git diff|status|cat) + read-only ssh root@65.21.144.136 (docker ps/inspect/logs, psql SELECT).
- STRIKT VERBOTEN: jede Änderung (kein Edit/Write, kein docker rm/restart/deploy, kein UPDATE/INSERT/DELETE, kein commit/push).
- Uncommitteter Stand (git status) ist Prüfgegenstand.
- Jeder Befund: Datei+Zeile+Code-Zitat + konkretes Fehlerszenario (Eingabe/Zustand → falsches Verhalten). Keine Vermutungen.
- Max. 6 Befunde, schwerste zuerst.`

const SCHON_GESEHEN = `BEREITS VON LOOP 1 GEPRÜFT (NICHT erneut melden, es sei denn du hast einen echten NEUEN Aspekt/tiefere Ursache):
${seenTitles.slice(0, 60).map(t => '- ' + t).join('\n') || '(keine)'}`

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

// Loop 2 = END-TO-END-Datenfluss-Traces statt datei-lokaler Scans. Andere Achse als Loop 1.
const TRACES = [
  { key: 'trace-buchung-ari', prompt: `TRACE einen kompletten Datenfluss: Gast/Mitarbeiter erstellt eine Reservierung → welche Tabellen werden geschrieben → welche ARI-Pushes (availability/rate/restrictions/stop_sell) werden an Channex ausgelöst → landen sie in der ari_outbox → verarbeitet der Worker sie korrekt → kommen sie bei den OTAs an? Folge dem Code über reservations/service.py, calendar/service.py, channel_manager/. Finde: Schritte die AUSFALLEN wenn ein Zwischenschritt fehlschlägt (Reservierung gespeichert, aber ARI-Push verloren → OTA-Überbuchung!), fehlende Idempotenz, Reihenfolge-Abhängigkeiten, Zeitfenster in denen der Zustand inkonsistent ist.` },
  { key: 'trace-stopsell', prompt: `TRACE Stop-Sell end-to-end: Mitarbeiter setzt Stop-Sell für einen Tag → REGEL: der Tag MUSS auf ALLEN Kanälen gesperrt werden (eigene Plattform + alle OTAs + Rezeption), kein Gast darf durchkommen. Folge dem Code vom UI-Auslöser über Backend bis zum Channex-Push. Finde: Kanäle die NICHT gesperrt werden, Races (Buchung genau während Stop-Sell gesetzt wird), das date_from/date_to-vs-date-Problem bei restrictions (still ignoriert!), Stop-Sell das nur lokal aber nicht bei Channex ankommt.` },
  { key: 'trace-geld', prompt: `TRACE den Geld-Fluss: Reservierung → Preis (pricing/resolver) → Rechnung (buchhaltung/reservation_invoice) → Storno (buchhaltung/storno). Rechne konkrete Beträge durch: Wo wird gerundet? Cents vs. Dezimal? MwSt.-Basis? Was passiert bei Storno nach Teilzahlung, Storno eines Storno, Rechnung + Storno + Neuausstellung? Rechnungsnummern-Vergabe bei parallelen Requests (Lücke/Duplikat)? Währung durchgehend aus den Daten oder irgendwo €/EUR hartkodiert? Nutze den UNCOMMITTETEN Stand (git diff buchhaltung/ pricing/).` },
  { key: 'trace-realtime', prompt: `TRACE die Realtime-Kette: Backend ändert eine Zeile (reservation/property/calendar) → Supabase-Realtime-WebSocket → Frontend-useRealtime → UI-Update. REGEL: JEDE Liste/Detail-UI MUSS useRealtime haben, KEIN Polling/Reload. Prüfe apps/web/components/kalender/, objekte/, finance/ und die use-realtime-Hooks: Welche UI aktualisiert NICHT automatisch nach einer fremden Änderung? Wo wird nach einer eigenen Mutation der lokale State stale? Werden RLS-gefilterte Realtime-Events korrekt empfangen (bekommt der Owner nur seine)?` },
  { key: 'trace-auth-scope', prompt: `TRACE eine Anfrage durch die Auth-/Scope-Schichten: HTTP-Request → middleware.ts → Proxy-Route (app/api) → FastAPI-Router → security.py (JWT) → Service (tenant_id/owner-Scope) → DB. Wähle 3-4 heikle Endpunkte (Objekt-Detail, Reservierungsliste, Rechnung-PDF, Owner-Sicht) und prüfe LÜCKENLOS: Kann ein authentifizierter Nutzer von Tenant A Daten von Tenant B sehen/ändern, indem er eine fremde ID in Pfad/Payload setzt? Kann ein Owner Objekte sehen die ihm nicht gehören? Leakt eine Rolle Gastdaten ohne Masking?` },
  { key: 'trace-worker-resilienz', prompt: `TRACE Worker-Resilienz unter Last/Fehler: 2 Worker-Instanzen laufen parallel (Skalierungsziel). Gehe claim_jobs → _run_job → _finish/_retry/_defer → Reaper (requeue nach 300s) durch. Finde ECHTE Race/Korrektheits-Bugs: Kann ein Job DOPPELT ausgeführt werden (Reaper requeued einen noch laufenden langen Job)? Verliert _defer das Retry-Budget falsch? Was bei Worker-Crash mitten im Channex-Push (Push raus, aber Job nicht als done markiert → Doppel-Push)? Heartbeat-Datei bei mehreren Instanzen im selben Container? Budget-Gate-Race?` },
]

phase('Trace')
log(`Loop 2: 6 End-to-End-Traces (kennt ${seenTitles.length} Loop-1-Titel)…`)
const found = await parallel(TRACES.map(f => () =>
  agent(`${f.prompt}\n\n${KONVENTIONEN}\n\n${SCHON_GESEHEN}\n\n${REGELN}`,
    { label: `trace:${f.key}`, phase: 'Trace', schema: FINDINGS })
    .then(r => (r?.findings || []).map(b => ({ ...b, dim: f.key })))
))

phase('Kritik')
log('Vollständigkeits-Kritiker sucht Lücken…')
const kritik = await agent(
  `Du bist der Vollständigkeits-Kritiker. Loop 1 (14 Datei-lokale Finder) und Loop 2 (6 End-to-End-Traces) haben das Projekt ${REPO} geprüft. Deine Aufgabe: Was wurde NICHT abgedeckt?
Denke an: Bereiche die kein Finder berührt hat (z.B. inbox/scheduler, pricing/recompute, channel_manager/webhooks, apps/web/lib-Clients, i18n-Vollständigkeit, Migrations-Idempotenz, deploy/backup-Restore, deploy/monitoring); Fehlerklassen die niemand gesucht hat (Ressourcen-Leaks, unbehandelte Promise-Rejections, fehlende DB-Transaktionen wo mehrere Schreibvorgänge atomar sein müssten, N+1-Queries bei 1000 Usern, fehlende Pagination-Limits).
Bereits gesehene Loop-1-Titel:
${seenTitles.slice(0, 50).map(t => '- ' + t).join('\n') || '(keine)'}
Finde bis zu 6 KONKRETE, bisher ungeprüfte Bugs mit Datei+Zeile+Szenario. Read-only.\n\n${KONVENTIONEN}\n\n${REGELN}`,
  { label: 'kritik:luecken', phase: 'Kritik', schema: FINDINGS }
).then(r => (r?.findings || []).map(b => ({ ...b, dim: 'luecken-kritik' })))

const alle = [...found.filter(Boolean).flat(), ...kritik]
// Dedup gegen Loop-1-Titel + intern.
const norm = t => (t || '').toLowerCase().replace(/[^a-zä-ü0-9]+/g, ' ').trim().slice(0, 48)
const seen1 = new Set(seenTitles.map(norm))
const seen = new Set()
const dedup = []
for (const b of alle) {
  const k = norm(b.title)
  if (seen.has(k)) continue
  seen.add(k)
  dedup.push({ ...b, warSchonInLoop1: seen1.has(k) })
}
log(`${alle.length} Roh, ${dedup.length} nach internem Dedup (${dedup.filter(b => b.warSchonInLoop1).length} überschneiden mit Loop 1)`)

phase('Verifizieren')
const verified = await parallel(dedup.map(b => () =>
  parallel([1, 2].map(n => () => agent(
    `Du bist Skeptiker Nr. ${n}. WIDERLEGE diesen Bug, wenn er nicht echt ist. Lies den echten Code (${REPO}, auch uncommitted). Prüfe: existiert der Code so? Tritt das Szenario real ein? Absicht/anderswo abgefangen? Echte Auswirkung (Korrektheit/Geld/Sicherheit/Datenverlust/Konventionsverstoß)? refuted=true wenn falsch/kein echter Bug/ohne Auswirkung; bei Unsicherheit refuted=true.

BEFUND (${b.dim}):
Titel: ${b.title}
Datei: ${b.file}${b.line ? ':' + b.line : ''}
Schwere: ${b.severity}
Beschreibung: ${b.description}
Beweis: ${b.evidence}
Szenario: ${b.szenario}

${KONVENTIONEN}
Read-only!`,
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
log(`Loop 2 fertig: ${confirmed.length} bestätigt, ${plausibel.length} plausibel, ${ok.filter(b => b.refutes >= 2).length} verworfen`)

return {
  bestaetigt: confirmed.map(b => ({ dim: b.dim, severity: b.severity, title: b.title, file: b.file, line: b.line, szenario: b.szenario, beschreibung: b.description, neuGegenueberLoop1: !b.warSchonInLoop1 })),
  plausibel: plausibel.map(b => ({ dim: b.dim, severity: b.severity, title: b.title, file: b.file, line: b.line, szenario: b.szenario, gruende: b.gruende })),
  statistik: { roh: alle.length, dedup: dedup.length, bestaetigt: confirmed.length, plausibel: plausibel.length },
}