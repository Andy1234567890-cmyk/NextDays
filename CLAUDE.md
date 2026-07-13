# NextDays — verbindliche Entwicklungsregeln

Diese Regeln sind aus 156 real gefundenen Bugs (10 Bug-Jagd-Runden) destilliert.
Es waren nicht 156 Ursachen, sondern **5 wiederkehrende Denkfehler**. Jede neue
Änderung MUSS gegen diese 5 Wurzeln geprüft werden, BEVOR sie als fertig gilt.

## Wurzel 1 — Jede Aktion hat einen Gegenzustand, der mitgepflegt werden muss
Wer Nächte/Sperren/Restriktionen/availability NEU setzt, MUSS die durch die
Änderung freigewordenen ALTEN pflegen (Alt/Neu-Diff). Kalendernächte einer
Reservierung werden AUSSCHLIESSLICH über `ReservationsService._release_nights`
zurückgegeben (nicht neu inline kopieren). Externer Sync (Channex/OTA): bei jeder
Modifikation den alten Zeitraum VOR dem Update sichern und die Differenz freigeben
(`bookings_sync._free_ota_nights`).

## Wurzel 2 — Real kommt alles doppelt (Retry, Doppelklick, Webhook-Redelivery)
Jede retrybare/öffentliche/webhook-/geldbewegende Operation MUSS idempotent sein,
BEVOR der Seiteneffekt passiert: vorhandenen Zustand wiederverwenden
(`PaymentsService._reuse_pending_intent`), status/claim-Guard, oder UNIQUE-Backstop
in der DB. Nie „einmal aufgerufen" annehmen.

## Wurzel 3 — Der Anfrage nicht vertrauen, Scope serverseitig erzwingen
Service-Role umgeht RLS → JEDER per-ID-Zugriff MUSS explizit auf tenant/owner
scopen. Load und Scope NICHT trennen (sonst vergisst man den Scope): eine Zeile per
ID laden über `core.supabase.load_scoped(db, table, id, tenant_id, not_found=...)`
oder eine benannte `_require_own_*`/`_own_*`-Methode. Nie ein rohes inline
`!= tenant_id` nach einem ungescopten Load. §4.2 owner nur eigene Objekte, §4.3
staff/cleaner kein Finanz-/Vertriebseinblick.

## Wurzel 4 — Keine Hardcodes, keine erfundenen Fallback-Werte
NIE `€`/`"EUR"` hardcoden (27 EU-Länder). Währung IMMER aus den Daten
(tenant/property/row). Fehlt sie, ist das ein Datenfehler → klar fehlschlagen (422),
NIE ein plausibler Ersatzwert (`|| 'EUR'`, `|| 19`, Fantasie-Defaults). Frontend:
`formatCurrency`/`currencySymbol` aus `lib/currency` (rendern symbollos bei leer,
kein Crash) — keine dritte Kopie mit eigenem EUR-Fallback.

## Wurzel 5 — Fehler präzise behandeln, nie verschlucken, fail-closed
Kein breites `except Exception`, das ein Kontroll-Signal (ChannexBudgetExhausted,
Konflikt 23505, Retry) verschluckt und still „done" markiert — spezifisch fangen
und re-raisen. Angreiferkontrollierter Input darf keinen 500 werfen (Secret-
Vergleich über `core.security.secrets_match`, byteweise). Secret/Signatur fehlt →
fail-CLOSED (401/403), nie fail-open. Best-effort-`except` (Logging/Audit) ist ok,
solange es den Hauptpfad nicht kippt (`# noqa: BLE001` markieren).

---

## Mobile (apps/mobile) — gleiche Plattform, gleiche Regeln
Die React-Native-App ist ein gleichwertiges Frontend derselben FastAPI
(`/api/v1`) — die All-in-One-App: vier Erlebnisse (Gast · Agentur · Owner ·
Mitarbeiter), Routing aus dem Konto, zwei strikt getrennte Auth-Welten
(Tenant vs. portal_guests). Plan: `docs/mobile-integration-plan.md` ·
Arbeitspakete P1–P9: `docs/mobile-integration-prompts.md` (strikt sequenziell,
Status in NOTES.md). Zusätzlich verbindlich:
- Daten NUR über `apps/mobile/lib/api.ts` (Bearer aus Keychain). Kein direkter
  Supabase-Zugriff — Ausnahme Realtime: dedizierter supabase-js-Client,
  `persistSession:false`, `await setAuth(token)` VOR `subscribe()` (Muster:
  `apps/web/lib/use-realtime.ts`).
- Tokens (access + refresh) NUR in react-native-keychain, nie AsyncStorage,
  nie loggen. 401 → genau EIN Refresh-Versuch (single-flight), dann Logout —
  Auth-Rate-Limit ist 10/60/IP (Wurzel 2).
- URLs/Umgebung NUR in `apps/mobile/lib/config.ts` (`__DEV__`-Switch). Keine
  URL-/Währungs-Hardcodes in Screens (Wurzel 4). Maskierte Felder
  (`total_amount: null`, Vorname-only) als „—" rendern, nie 0/Fantasiewert.
- Rollen-/Capability-Gating aus `GET /auth/me` (wie
  `apps/web/components/app-sidebar.tsx`), nie clientseitig „aufmachen".

## Qualitätsgate (vor „fertig")
- `pytest` grün; `ruff check` sauber; `pylint` 10.00/10 auf geänderten Modulen.
- Frontend: `tsc --noEmit` in apps/web UND builder ohne Fehler.
- Mobile berührt? `tsc --noEmit` in apps/mobile ohne Fehler, Jest grün.
- DB-Änderung? Migration schreiben und via `supabase/apply-migrations.sh` live
  einspielen (nie automatisch), JEDE neue public-Tabelle bekommt RLS.
- Realtime: jede neue Liste/Detail-UI abonniert alle speisenden Tabellen.

## Nicht tun
- Keine Bug-Jagd-Loops „bis 0 Bugs" — das behandelt Symptome, nicht Wurzeln, und
  bläht Kosten/Volumen auf. Wiederkehrende Klassen an der Wurzel schließen.
- Nichts committen/pushen/deployen ohne ausdrückliche Ansage.
- Keine Tool-/KI-Attribution in Repo/Commits/PRs/Doku.
