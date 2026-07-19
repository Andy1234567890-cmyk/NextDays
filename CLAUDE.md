# NextDays — verbindliche Entwicklungsregeln

Diese Regeln sind aus 156 real gefundenen Bugs (10 Bug-Jagd-Runden) und einem
mehrstufigen Security-/Red-Team-Audit destilliert. Es sind **9 wiederkehrende
Denkfehler**: Wurzel 1–5 aus der Bug-Jagd, Wurzel 6–9 aus dem Security-Audit.
Jede neue Änderung MUSS gegen diese 9 Wurzeln geprüft werden, BEVOR sie als fertig
gilt. Hintergrund/Belege: `docs/SECURITY-REDTEAM.md`, `docs/SECURITY-AUDIT-STARTUP.md`.

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

## Datenmodell (UNVERHANDELBAR) — 1 property = 1 buchbare Einheit
myNextDays ist EINE Plattform für Ferienobjekte UND Hotels, dasselbe Modell für
beide. Jede `properties`-Zeile ist GENAU EINE buchbare Einheit: ein einzelnes
**Zimmer** (Hotel) ODER ein **Ferienobjekt** (FeWo). NIE ein Objekt als
„Hotelgebäude mit Zimmerkategorien darunter" deuten. Ein Hotel mit 8 Twin- und
4 Double-Zimmern hat entsprechend viele Objekte — NICHT ein Objekt mit
`count_of_rooms=8`. Konto/Tenant = der Betrieb (`/konto`); darunter die Objekte
(= Zimmer/Ferienobjekte, `/objekte`). Vor JEDER Aussage/Änderung zu Zimmern/
Verfügbarkeit/Kapazität dieses Modell zugrunde legen; im Zweifel den Nutzer
fragen statt eine Container-/Kategorie-Ebene zu erfinden. Dieser Fehler ist
mehrfach passiert und hat falsche Kapazitäten/Buchungen erzeugt.

## Vertriebskanäle & Frontends (UNVERHANDELBAR) — drei Wege, drei Oberflächen
Jedes Objekt wird über MEHRERE Kanäle verkauft; Kanal-Sichtbarkeit ist PRO KANAL
schaltbar, NICHT ein globales „veröffentlicht"-Flag (Industrie-Standard, belegt:
Channex/SiteMinder/Cloudbeds/Shopify). Die drei Vertriebskanäle:
- **Channex → OTAs**: Booking.com, Airbnb, Expedia & Co. (Channel-Aggregator
  Channex, `apps/api/.../channel_manager`; Distribution = `channex_property_map`
  `sync_enabled` + verbundener Kanal). Im Kundentext nie „Channex" — „Portale".
- **Plattform**: unser EIGENER globaler Marktplatz (`/plattform`), ein
  gleichrangiger Buchungskanal wie Booking/Airbnb, NICHT „Direkt". Sichtbarkeit =
  eigene Achse `properties.listed_on_marketplace` (0159), getrennt von OTA.
- **App**: die mobile Plattform (`apps/mobile`, React Native) — gleichwertiges
  Frontend derselben FastAPI (Gast · Agentur · Owner · Mitarbeiter), siehe
  „Mobile"-Abschnitt unten.
Regel: auf einem Kanal sichtbar = Objekt-Status erlaubt Verkauf (`status='active'`)
UND Kanal-Sichtbarkeit dieses Kanals an UND Verfügbarkeit vorhanden. `publish()`
schaltet im Normalfall alle an (1 Klick = OTA + Marktplatz), aber jeder Kanal ist
einzeln steuerbar. availability/stop_sell wirken kanalübergreifend (Stop-Sell
sperrt überall), die reine Kanal-Sichtbarkeit ist pro Kanal.

## Wurzel 6 — RLS erzwingt nur den MANDANTEN, nicht Rolle/Spalte/Schreibrichtung
Ein Client mit gültigem JWT + öffentlichem anon-Key spricht PostgREST/Realtime
DIREKT an — der FastAPI-Layer wird dabei komplett umgangen. Service-Layer-Checks
(Rollen-Datensplit §4.3, Gast-Masking, Owner-read-only) sind daher WIRKUNGSLOS
gegen einen Angreifer, der `curl /rest/v1/<tabelle>` macht. Schutz MUSS auf DB-Ebene:
- `enable rls` + tenant-`for all`-Policy reicht NICHT für sensible Daten. Zusätzlich:
  (a) `revoke insert,update,delete[,select] on public.<tabelle> from anon, authenticated`
  für alles, was nur der Server (service_role) schreiben/lesen darf — Finanzen
  (payments, commissions, owner_statements), `users.role`/`permissions`, Secrets,
  Türcodes/Dossier; (b) restriktive Rollen-Policies `as restrictive for all` —
  NICHT nur `for select`, sonst ist der SCHREIB-Pfad tenant-weit offen.
- Spalten-`revoke select (spalte)` greift NICHT, solange das pauschale Tabellen-GRANT
  besteht → erst das Tabellen-GRANT entziehen, dann gezielt gewähren.
- Einmaliger Backstop: `revoke create on schema public from anon, authenticated`.
- Scope-Helper (`owner_can_see_property`, `staff_can_see_property`) fail-CLOSED:
  nur admin/co_admin explizit `true`, sonst Assignment prüfen — nie fail-open bei
  unbekannter/fehlender Rolle.
- SECURITY DEFINER-Funktionen IMMER `set search_path = ''` + schema-qualifiziert +
  `revoke execute ... from anon, authenticated`.
- Prüffrage vor „fertig": *Was kann ein eingeloggter cleaner mit dem anon-Key per
  `curl` gegen `/rest/v1/<neue_tabelle>` lesen UND schreiben?* Das ist der reale
  Schutz. (`scripts/security/redteam-verify.sh`)

## Wurzel 7 — Auth-Kontrolle muss dort sitzen, wo der Angreifer wirklich einloggt
Der direkte GoTrue-Login (`/auth/v1/token`, anon-Key) umgeht ALLE App-`/auth/*`-Flows.
- MFA serverseitig erzwingen (Supabase-native, `aal2`-Claim prüfen) — nie nur im
  eigenen `/auth/login`. Eine „App-2FA", die man durch Direkt-Login umgeht, schützt nichts.
- Sicherheitskritische Selbst-Änderungen (E-Mail, Passwort, TOTP-Enroll/-Disable)
  verlangen Re-Auth (aktuelles Passwort/TOTP). E-Mail-Wechsel NIE `email_confirm=True`
  auto-bestätigen → Doppel-Opt-in an die NEUE Adresse.
- Rechtevergebende/-prüfende Guards lesen die Rolle aus der DB (Quelle der Wahrheit),
  nicht nur aus `ctx.role` im JWT (sonst gilt eine entzogene Rolle bis Token-Ablauf).
- App-Ratelimit (10/60/IP) schützt nur die FastAPI-Route. Brute-Force/Stuffing am
  GoTrue braucht Supabase Attack Protection (Captcha + Leaked-Password) — als
  Betriebs-/Config-Anforderung behandeln, nicht als „im Code erledigt".

## Wurzel 8 — Client-Input, der serverseitig gerendert/geholt/expandiert wird, ist ein Angriff
- HTML NIE per Regex „säubern" → serverseitig mit Allowlist-Parser (`nh3`/DOMPurify)
  beim SPEICHERN. `href`/`src`/URL-Felder: Schema-Whitelist (nur http(s)/mailto/tel/
  relativ), sonst 422. Gilt auch für Daten aus OTA-/Webhook-Payloads (zweiter Ordnung).
- Ausgehende Fetches auf nutzergelieferte URLs (iCal, Callbacks): IP auflösen, prüfen,
  auf die GEPRÜFTE IP pinnen (Host-Header+SNI), nie per Hostname neu auflösen
  (DNS-Rebinding); interne/CGNAT `100.64/10`/IPv4-mapped blocken; streamen mit Byte-Cap.
- Kein serverseitiges Rendern von rohem Client-HTML ohne Auth (z. B. PDF-Render) +
  Sub-Resource/interne-IP-Sperre.
- Jeder unbegrenzte Bereich (Datums-Span, Nächte-Loop, Liste) bekommt eine harte
  Obergrenze → 422. Teure/AI-/Report-Endpunkte bekommen einen EIGENEN strengen
  Rate-Limit-Bucket, nicht den default.
- Uploads: Magic-Byte-Prüfung (nicht nur Client-`content_type`), SVG sanitisieren,
  sensible Buckets privat + signierte URLs, Bucket-Config in versionierter Migration.

## Wurzel 9 — Item-Level-Autorisierung muss denselben Scope prüfen wie die Liste
Wenn der List-Endpunkt nach assignee/owner filtert, MÜSSEN `detail`/`update`/
`complete`/`{id}`-Endpunkte denselben Scope re-prüfen (assignee_id/owner_id), nicht
nur den Tenant — sonst IDOR-in-role (fremde Aufgaben lesen/abschließen). State-changing
oder daten-ausgebende Routen mit nur `get_current_user` (Authentifizierung) statt
`require_permission` (Autorisierung) sind ein Fehler. Kein `email`/`permissions` an
Rollen ausliefern, die es nicht brauchen (Recon für Priv-Esc).

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
- **Security-Gate (Wurzel 6–9):** neue/geänderte sensible Tabelle → `revoke` +
  restriktive Rollen-Policy gesetzt und gedanklich per anon-Key-`curl` gegengeprüft
  (lesen UND schreiben). Neuer serverseitiger Fetch/Render/HTML-Sink → sanitisiert/
  IP-gepinnt/gecappt. Neuer `{id}`-Endpunkt → gleicher Scope wie der List-Pfad.
- `uv pip-audit` (apps/api) und `npm/pnpm audit` (Frontend/Mobile) ohne offene CVE.
- CI/Workflows berührt? third-party Actions per Commit-SHA gepinnt, `permissions:`
  minimal (`contents: read`). Basis-Images per Digest gepinnt.

## Nicht tun
- Keine Bug-Jagd-Loops „bis 0 Bugs" — das behandelt Symptome, nicht Wurzeln, und
  bläht Kosten/Volumen auf. Wiederkehrende Klassen an der Wurzel schließen.
- Nichts committen/pushen/deployen ohne ausdrückliche Ansage.
- Keine Tool-/KI-Attribution in Repo/Commits/PRs/Doku.
- NIE echte Credentials/Secrets/Tokens in Repo-Dateien — auch nicht in
  `.env.example`, Doku oder Kommentaren. Nur Platzhalter (`<DEIN_WERT>`). Rutscht doch
  eins rein: rotieren + aus der Git-History entfernen (`git filter-repo`/BFG).
- Sensible Tabellen NIE allein mit `enable rls` + tenant-Policy „absichern" — ohne
  `revoke`/restriktive Rollen-Policy ist der DB-Direktpfad offen (Wurzel 6).
