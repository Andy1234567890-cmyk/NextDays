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

## Datenmodell (UNVERHANDELBAR) — 1 property = 1 Typ mit n ≥ 1 Einheiten
myNextDays ist EINE Plattform für Ferienobjekte UND Hotels, dasselbe Modell für
beide. Jede `properties`-Zeile ist GENAU EIN Einheiten-TYP: ein Zimmertyp
(Hotel) ODER ein Ferienobjekt (FeWo). Darunter hängen seine **Einheiten**
(`property_units`, 0265) — im Normalfall genau eine, bei mehreren identischen
Einheiten entsprechend viele. Verkauft wird die Einheit, geführt und bepreist
wird der Typ.

Diese Form ist Branchenstandard, weil die Portale sie erzwingen: Booking.com
führt die Stückzahl am Zimmer-/Apartment-Typ („you sold all the rooms or units
of this type that you have loaded"), SiteMinder sendet sie als `BookingLimit`
je Zimmertyp („All rate plans under the same room type share the same
availability pool"), Hostaway nennt die Einheiten „sub-units" eines Multi-Unit-
Listings. Entscheidung vom 02.08.2026 nach Recherche; vorher galt hier
„1 property = 1 buchbare Einheit", was Multi-Inventory-Listings (fünf gleiche
Studios unter einem Typ) nicht abbilden konnte.

Was weiterhin FALSCH ist: ein Objekt als „Hotelgebäude mit Zimmerkategorien
darunter" zu deuten. Ein Hotel mit 8 Twin- und 4 Double-Zimmern hat ZWEI
Objekte (Twin, Double) mit 8 bzw. 4 Einheiten — nicht ein Objekt mit
`count_of_rooms=12` und keine erfundene Kategorie-Ebene im Objekt.

Welche Objekte bei den Portalen unter EINER Kennung stehen, entscheidet das
**Gebäude** (`buildings`/`properties.building_id`, 0264), nicht die Betriebsart.
Konto/Tenant = der Betrieb (`/konto`); darunter die Objekte (`/objekte`),
darunter ihre Einheiten. Vor JEDER Aussage/Änderung zu Zimmern/Verfügbarkeit/
Kapazität diese drei Ebenen zugrunde legen; im Zweifel den Nutzer fragen statt
eine weitere zu erfinden. Verfügbarkeit an die Portale ist deshalb eine ZAHL
(freie Einheiten), nicht 0/1.

## Zwei Marken (UNVERHANDELBAR) — myNextDays ≠ myBestDays
- **myNextDays** = das PMS, der Channel-Manager und die Marketing-Seite
  (`web`, `apps/api`, `marketing`, `admin`, `builder`, `storybook`,
  `mobile-nextdays`). Der Betrieb ist hier Kunde, zahlt Abo + Provision.
- **myBestDays** = der Marktplatz und alles, was Gast und Gastgeber dort sehen:
  `plattform` (Gäste-Marktplatz), `gastgeber` (Gastgeber-Dashboard),
  `mobile-bestdays` (Marktplatz-App) und die Marktplatz-Bausteine im PMS (Kanal
  „Plattform", `ota_name`, Kanal-Karte im Kanalmanager, Hilfe-Artikel
  „Plattform-Marktplatz").
Die Marken-Grenze gilt auch nativ: es gibt ZWEI Apps, nicht eine
(`mobile-bestdays` = myBestDays, `mobile-nextdays` = myNextDays, ADR-0019).
Nie wieder eine App bauen, die beide Marken trägt.
Regel vor jedem neuen Text/Label: Sieht das ein Gast oder ein Marktplatz-
Gastgeber bzw. beschreibt es den Buchungskanal Marktplatz → **myBestDays**.
Beschreibt es Verwaltung/Kanalmanager/Abrechnung des Betriebs → **myNextDays**.
Logo-Dateien: `mybestdays-logo.png` (+ `-light` für dunkle Flächen).

## Vertriebskanäle & Frontends (UNVERHANDELBAR) — drei Wege, drei Oberflächen
Jedes Objekt wird über MEHRERE Kanäle verkauft; Kanal-Sichtbarkeit ist PRO KANAL
schaltbar, NICHT ein globales „veröffentlicht"-Flag (Industrie-Standard, belegt:
Channex/SiteMinder/Cloudbeds/Shopify). Die drei Vertriebskanäle:
- **Channex → OTAs**: Booking.com, Airbnb, Expedia & Co. (Channel-Aggregator
  Channex, `apps/api/.../channel_manager`; Distribution = `channex_property_map`
  `sync_enabled` + verbundener Kanal). Im Kundentext nie „Channex" — „Portale".
- **Plattform**: unser EIGENER globaler Marktplatz **myBestDays** (`/plattform`),
  ein gleichrangiger Buchungskanal wie Booking/Airbnb, NICHT „Direkt".
  Sichtbarkeit = eigene Achse `properties.listed_on_marketplace` (0159),
  getrennt von OTA. Buchungen tragen `channel='portal'` +
  `ota_name='myBestDays'` (Altbestand per 0239 nachgezogen).
- **App**: die mobile myBestDays-App (`mobile-bestdays`, React Native) —
  gleichwertiges Frontend derselben FastAPI für den GAST. Die Verwaltung
  (Agentur · Owner · Mitarbeiter) ist die zweite App `mobile-nextdays`; siehe
  „Mobile"-Abschnitt unten.
Regel: auf einem Kanal sichtbar = Objekt-Status erlaubt Verkauf (`status='active'`)
UND Kanal-Sichtbarkeit dieses Kanals an UND Verfügbarkeit vorhanden. `publish()`
schaltet im Normalfall alle an (1 Klick = OTA + Marktplatz), aber jeder Kanal ist
einzeln steuerbar. availability/stop_sell wirken kanalübergreifend (Stop-Sell
sperrt überall), die reine Kanal-Sichtbarkeit ist pro Kanal.

## Wurzel 5b — Unsere Uhr ist nie der Zeitpunkt eines fremden Ereignisses
`created_at`/`updated_at`/Feed-Eingang beschreiben UNSERE Verarbeitung. Sie als
Zeitpunkt einer fremden Handlung auszugeben ist eine Falschaussage, die niemand
als Bug erkennt — sie sieht ja plausibel aus. Live passiert (06.08.2026): der
Posteingang zeigte 22 Airbnb-Buchungen als „heute 10:48", real gebucht am
23.03./01.06./26.07.; alle 22 trugen dieselbe Sekunde, weil der Feed sie in
einem Rutsch holte, und die Sortierung „letzte Aktivität" war wertlos.
- Zeitpunkt eines Fremdereignisses IMMER aus der Quelle (Airbnb `booked_at`,
  `reservations.booked_at`/`channex_booking.booked_at`, 0291/0292) über den
  EINEN Helfer `common.ota_buchungszeitpunkt` — neue Kanäle tragen ihren
  Feldnamen dort ein, nicht an der Anzeigestelle.
- Der Aggregator ist KEINE Quelle dafür: Channex' `inserted_at` ist sein
  eigener Eingang, `ota_booked_at` ist live leer.
- Fehlt der echte Wert: `None` und in der UI „Eingang bei uns" benennen — nie
  auf die eigene Uhr zurückfallen (Wurzel 4).
- Sortierungen „neueste zuerst" laufen über den Quell-Zeitstempel, nicht über
  `updated_at`.

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

## Mobile — ZWEI Apps (ADR-0019)
Es gibt zwei eigenständige React-Native-Projekte, eines je Marke:
- `mobile-bestdays` (myBestDays, `com.mybestdays.app`, `mybestdays://`) — der
  Marktplatz: Gast, eine Auth-Welt (`portal_guests`).
- `mobile-nextdays` (myNextDays, `com.mynextdays.app`, `mynextdays://`) — das
  PMS: Betrieb, eine Auth-Welt (Tenant), Erlebnis aus der Rolle.
Regeln je App: `mobile-bestdays/CLAUDE.md` bzw. `mobile-nextdays/CLAUDE.md` —
sie laden automatisch, sobald im jeweiligen Ordner gearbeitet wird.
Geteilter Code liegt als bewusste KOPIE vor (kein Paket, ADR-0019 Stufe 1):
Dateien mit `SCHWESTERDATEI`-Kopf müssen byte-identisch bleiben, der CI-Job
`mobile-konsistenz` prüft das. Der Wechsel zwischen beiden Welten ist ein
App-Wechsel (`lib/appwechsel.ts`), keine Navigation.

## Wissensgraph zuerst (vor jeder Suche/Änderung)
Es gibt einen lokalen Code-Wissensgraphen (`graphify-out/graph.json`, MCP-Server
`graphify` in `.mcp.json`, git-ignoriert, Auto-Rebuild per git-Hook):
46.760 Knoten, 112.095 Kanten, 1.893 Communities. Er wird **zuerst** gefragt,
nicht als Notnagel nach dem Grep.

Der Unterschied ist die KANTE: `grep` findet ein Wort, der Graph findet alle
Aufrufer, die ganze Mixin-Familie und die Docstrings als eigene Knoten.
`get_community 317` gibt die komplette `ReservationsBase` als Cluster —
`_release_nights`, `_release_channex`, `_push_einheiten_stand`,
`_write_ari_outbox`, `_days_still_booked_by_others` nebeneinander: genau die
Gegenzustands-Kette aus Wurzel 1. Wer sie per Grep sucht, findet einen Namen und
übersieht die vier Geschwister.
- `get_node <symbol>` → Datei + Zeile + Community, statt sie zu suchen.
- `get_neighbors <klasse>` → alle Aufrufer. PFLICHT, bevor eine Methode geändert
  wird, deren Aufruferzahl man nicht kennt (`cancel()` hat SECHS).
- `get_community <id>` → die Geschwister der berührten Stelle (Wurzel 1).
- `query_graph "<frage>"` → Einstieg in einen unbekannten Bereich; greift auch
  auf Prosa (Docstrings, Testbeschreibungen).
- `god_nodes` → was viel hängt, bricht viel.
Grenzen, die kein Befund sind: `shortest_path` ist GERICHTET (fehlender Pfad
heißt „kein direkter Aufruf", nicht „keine Verbindung" — `undirected=true`);
`get_pr_impact`/`triage_prs` brauchen offene PRs. Der Graph sagt, WO zu lesen
ist, nicht was dort steht — verifiziert wird weiterhin am Code.

## Qualitätsgate (vor „fertig")
- `pytest` grün; `ruff check` sauber; `pylint` 10.00/10 auf geänderten Modulen.
- **NIE den vollen `pytest` wiederholt laufen lassen.** Geprüft wird der
  BERÜHRTE Slice (`uv run pytest src/features/<slice> -q`) — der volle Lauf
  über 3300 Tests EINMAL vor dem Commit, sonst nie. Kein Testlauf im
  Hintergrund (`run_in_background`), weil er dort weiterläuft, während schon
  der nächste startet, und niemand ihn abräumt.
  Ausdrückliche Anweisung vom 16.08.2026: *„bist du dumm was nutzt du mein
  ganzen RAM"* — vorausgegangen waren vier Gesamtläufe hintereinander plus
  einer im Hintergrund, für eine Änderung an EINEM Slice, dessen 137 Tests in
  8 Sekunden durchlaufen. Der Rechner des Nutzers ist kein CI-Runner.
  Dasselbe gilt für jeden anderen teuren Lauf: `pylint` NUR auf die geänderten
  Dateien, nie über das ganze Paket. Läuft doch einmal etwas im Hintergrund,
  wird es im selben Zug beendet (`pkill -f pytest`), nicht liegen gelassen.
- Frontend: `tsc --noEmit` in apps/web UND builder ohne Fehler.
- Frontend: `bun run lint` (ESLint) in jeder berührten App **fehlerfrei** —
  Regeln zentral in `packages/eslint-config`, App-Ausnahmen in der jeweiligen
  `eslint.config.mjs`. Findet, was `tsc` nicht sieht: toter Code, Hooks hinter
  einem frühen Return, unvollständige Hook-Dependencies, verschluckte Fehler
  ohne `cause`. Warnungen (`any`, `<img>`) brechen noch nicht ab — neue keine
  dazu. Geteilte Pakete: `bun run lint:packages`.
- **Frontend: NIE `next build` auf dem Rechner des Nutzers.** Kein
  `bunx next build`, nicht mit `--distDir`, nicht in einem Worktree, nicht
  „nur einmal zur Prüfung". Den Build fährt AUSSCHLIESSLICH Coolify beim
  Deploy. Ausdrückliche Anweisung vom 12.08.2026: *„alles deploy ohne build
  auf meinen pc du müllst ihn komplett zu"* — samt der Auflage, diese Regel
  hier so zu verankern, dass nie wieder ein lokaler Build daraus abgeleitet
  wird.
  Warum die Erlaubnis gestrichen wurde, statt sie zu bedingen: jede Variante
  hat live Schaden angerichtet. Ohne `--distDir` löscht der Build das `.next`
  des laufenden Dev-Servers und jede Seite antwortet 500
  (`ENOENT … routes-manifest.json`, 09.08.2026 — die Oberfläche war
  reihenweise tot, ohne dass am Code etwas falsch war). MIT `--distDir` und
  relativem Pfad landeten 1,6 GB Build-Ausgabe mitten im Quellcode
  (`web/private/tmp/…`, git-ignoriert, in `git status` unsichtbar); `bun run
  lint` meldete daraufhin **57 813 Fehler** und `tsc` dutzende `TS2307` aus
  diesem Fremdcode — jeder echte Befund war darin unsichtbar. Zusätzlich
  schrieb der Build seine absoluten Pfade in die eingecheckte
  `web/tsconfig.json`, womit der Docker-Build scheiterte. Eine Regel, deren
  korrekte Anwendung dreimal misslang, gehört nicht präzisiert, sondern
  entfernt.
  **Was stattdessen geprüft wird:** `tsc --noEmit` + `bun run lint` in jeder
  berührten App. Beide finden nicht alles — Next.js-Direktiven-Regeln prüfen
  sie NICHT. Ein `"use server"`-Modul darf AUSSCHLIESSLICH async functions
  exportieren (ein `const`/Objekt darin bricht erst in „Collecting page data"
  mit `A "use server" file can only export async functions`); Werte und Typen
  gehören in eine Nachbardatei ohne die Direktive. Diese Klasse Fehler wird
  daher im Kopf geprüft und beim Deploy von Coolify gefangen; schlägt der
  Deploy-Build fehl, wird er behoben, nie per `ignoreBuildErrors` unterdrückt
  (Wurzel 4/5).
- Mail/Benachrichtigung berührt? `bash scripts/diagnose/mail-umgebung-pruefen.sh`
  — vergleicht die Umgebung JEDES mailversendenden Prozesses (api UND worker)
  gegen die Pflichtliste. `api` und `worker` fahren denselben Code, sind in
  Coolify aber zwei Anwendungen mit eigener Variablenliste; nichts verglich
  sie. Live am 25.08.2026: die API trug `APP_BASE_URL` und die acht
  `COMPANY_*`, der Worker keine einzige — jede Gast-Automail und jede
  Bewertungsanfrage ging ohne Anbieterangaben und ohne Link hinaus, Push aus
  dem Worker gar nicht. Gemeldet wurde es nicht vom System, sondern vom Auge
  („diese Mails haben keinen Link"). Ein Konfigurationswert, dessen Fehlen
  still bleibt, ist derselbe Fehler wie ein verschluckter Exception (Wurzel 5):
  neue Sinks loggen den Mangel LAUT, statt die Ausgabe stumm zu kürzen.
- Messung/Einwilligung berührt? `node scripts/diagnose/ga4-treffer-pruefen.mjs
  https://mynextdays.com` — jede Zeile muss grün sein. Und WIE gemessen wird,
  ist hier so wichtig wie WAS: der Beweis ist ein Hook IN DER SEITE auf
  `sendBeacon`/`fetch`/`XHR`, protokolliert nach `localStorage`. Nicht
  `page.on("request")` in Playwright und nicht der Netzwerkmonitor einer
  Chrome-Erweiterung — beide haben am 27.08.2026 nacheinander einen Fehler
  GEMELDET, den es nicht gab: die Erweiterung erfand für `/g/collect`
  reproduzierbar HTTP 503 (echt war 204, samt Google-Headern), und Playwright
  meldete über vier Messreihen, jede binnen 5 s verlassene Unterseite werde
  nicht gezählt. GA4 hält Ereignisse bis zu 5 Sekunden in einer Warteschlange
  und leert sie beim `pagehide` per `sendBeacon` — genau diesen Beacon sieht
  Playwright nicht mehr (microsoft/playwright#26660). Nur `pagehide` löst den
  Flush aus, nicht `visibilitychange`, nicht `beforeunload`, nicht ein
  Tabwechsel. Der GA4-Echtzeitbericht taugt nicht als schnelle Gegenprobe: er
  zeigte nachweislich gesendete Unterseiten auch nach 15 Minuten nicht.
  Wer eine solche Prüfung mit fester Wartezeit nach einem Klick baut, misst
  React-Latenz mit und bekommt ein flatterndes Gate — auf den eingereihten
  `dataLayer`-Eintrag warten, dann navigieren.
- Werbe-Pixel berührt (marketing/lib/pixel.ts, ein Conversion-Punkt)?
  `node scripts/diagnose/meta-pixel-verdrahtung-pruefen.mjs` (Quelltext, CI-fähig)
  UND die Laufzeitprobe `scripts/diagnose/meta-pixel-im-browser.js` im echten
  Browser — Claude Chrome oder DevTools, **NIE Playwright** (Anweisung vom
  27.08.2026). Beide zusammen, weil keine allein reicht: der Quelltext sagt
  nichts darüber, ob Meta den Treffer annimmt, und die Laufzeitprobe kann keine
  Conversion auslösen, ohne echte Voranmeldungen und Mails zu erzeugen.
  Drei stumme Fehler, die sie gefunden haben (27.08.2026): ein per JavaScript
  angelegtes `<noscript>`-Zählbild sendete ZUSÄTZLICH zum regulären Treffer,
  also ZWEI `ev=PageView` je Seitenaufruf — Meta zählte jede Seite doppelt und
  führte den Bild-Treffer als „Selbstdefinierte Event"; der Stub schob ein
  Array statt `arguments` (dieselbe Wurzel wie zweimal bei gtag, hier latent);
  und `fbq.push = fbq` aus Metas Vorlage fehlte. Der teuerste Fund lag
  allerdings NICHT im Code: Meta sperrte den Pixel wegen einer sensiblen
  Datensatzkategorie, sichtbar nur als
  `fbq.instance.locks._locks.prohibited_pixels_<id>` — Metas Diagnose schweigt
  dazu. Deshalb prüft die Laufzeitprobe dieses Lock mit.
- Sprachdatei berührt? `node scripts/i18n/deutsche-restwerte-pruefen.mjs` — meldet
  PRO SPRACHE jeden Wert, der in `web/messages/<sprache>.json` noch wortgleich
  auf Deutsch steht. Die bestehenden i18n-Gates prüfen nur VOLLSTÄNDIGKEIT: ein
  Schlüssel, der in der bulgarischen Datei den deutschen Text trägt, ist für sie
  vorhanden, strukturgleich und platzhaltertreu — er ist nur nicht übersetzt.
  `uebersetzungs-luecken-pruefen.mjs` fängt davon nur, was in ≥ 80 % der
  Sprachen gleichzeitig deutsch steht; genau daran lief der reale Anlass vorbei
  (25.08.2026): der ganze `inbox.*`-Namensraum stand in 15 von 23 Sprachen auf
  Deutsch — 65 %, also unter der Schwelle, also stumm, bis es jemandem auffiel
  („Anreise/Abreise/Nächte" im griechischen Posteingang). Gemessen waren es
  4 881 deutsche Restwerte über alle Sprachen. Was zu Recht gleich steht
  (Marken, Kürzel, Wörter, die in DIESER Sprache wirklich gleich lauten), steht
  mit Grund und Sprachliste in `deutsche-restwerte-allowlist.json` — nie
  pauschal „gilt überall", nie eingetragen, nur damit die Zahl sinkt.
- Kanal/Enum berührt? `node scripts/i18n/kanal-enums-pruefen.mjs` — hält
  DB-Enum → Pydantic → Frontend-Unions → Kanal-Meta → `calendar.channel.*`
  aller 24 Sprachen UND den serverseitigen Mail-Katalog `kanal.*`
  deckungsgleich (fünf Stellen). Der Mail-Katalog kam am 25.08.2026 dazu:
  `website` stand in allen vier anderen Stellen, nur nicht dort — der Backstop
  gab `None` zurück, und `"{gast} · {kanal}".format(kanal=None)` schrieb das
  Wort „None" in Glocke und Postfach. Ein neuer Backend-Kanalwert ohne diese
  Kette ist ein `MISSING_MESSAGE` plus stiller Farb-Fallback auf einen FREMDEN
  Kanal (so sah eine Expedia-Buchung aus wie myBestDays).
- Mobile berührt? `tsc --noEmit` + Jest grün in JEDER betroffenen App
  (`mobile-bestdays`, `mobile-nextdays`); geteilte Dateien in beiden gleich.
- DB-Änderung? Migration schreiben und via `supabase/apply-migrations.sh` live
  einspielen (nie automatisch), JEDE neue public-Tabelle bekommt RLS.
- Trigger angefasst (neu, geändert, `create or replace`)? Danach
  `bash scripts/diagnose/db-trigger-pruefen.sh` — es löst jeden Trigger der
  Live-DB per No-Op-`update` in einer zurückgerollten Transaktion aus und sucht
  statisch nach `coalesce(<enum-spalte>, '…')`. Ein Trigger, der beim Auswerten
  SEINER EIGENEN Bedingung wirft, killt JEDE Änderung an seiner Tabelle, auch
  die, die mit seinem Ereignis nichts zu tun hat — der INSERT-Pfad läuft dabei
  weiter, das System sieht also lebendig aus. Live am 23.08.2026 (0418→0424):
  `coalesce(old.status, '') <> 'done'` legte Aufgaben UND Buchungen lahm,
  gemeldet als „ich kann Aufgaben nicht abschließen in der App".
- Realtime: jede neue Liste/Detail-UI abonniert alle speisenden Tabellen. Ein Abo
  wirkt nur, wenn BEIDES stimmt: `select` für `authenticated` auf der Tabelle
  (RLS entscheidet dann, welche Zeilen) UND Mitgliedschaft in der Publikation
  `supabase_realtime`. Fehlt eines, ist das Abo eine stumme Attrappe — die UI
  sieht live aus und aktualisiert nie. Beides gegen die Live-DB prüfen, nicht
  annehmen (so waren 8 Abos in web und der Mobile-App tot, u. a. `properties`). Tabellen, die
  Wurzel 6 bewusst sperrt (Finanzen: payments, invoices, commission_ledger,
  owner_statements, tenant_billing_profile), dürfen NICHT per Grant geöffnet
  werden — dort ist das Abo der Fehler: auf eine erlaubte Quelle hören
  (z. B. `reservations`); gibt es keine, ersatzlos streichen und den Grund
  danebenschreiben.
  Prüfen NICHT von Hand: `bash scripts/realtime/abos-pruefen.sh` liest alle
  `table: "…"` aus allen sechs Frontends und prüft jede Tabelle live auf Grant
  + Publikation (Exit 1 bei Attrappe). In der Entwicklung zeigt zusätzlich das
  Overlay `RealtimeDebugPanel` (oben rechts) je Seite Status, Token und
  Event-Zähler pro Abo — in Produktion ist es aus, auf Staging per
  `NEXT_PUBLIC_REALTIME_DEBUG=1` zuschaltbar.
  Zwei Auth-Welten: Gast-Abos (portal_guest) brauchen das GAST-JWT, sonst passt
  keine Policy. Nativ ist das seit ADR-0019 pro App entschieden — jede App
  registriert genau EINE Tokenquelle (`realtimeTokenQuelleSetzen`), ein zweiter
  Aufruf wirft.
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
- NIE schreibend gegen ein fremdes Live-Konto (Airbnb/Booking/Stripe) testen ohne
  ausdrückliche Freigabe — siehe „Schreibtests am Live-Konto".

## Schreibtests am Live-Konto (UNVERHANDELBAR)
Das Airbnb-Konto des Beta-Betriebs ist PRODUKTION: echte Inserate, echte Gäste,
echte Buchungen. Ein Schreibaufruf dorthin ist keine Messung, sondern ein
Eingriff in den Verkauf.

Passiert am 06.08.2026: Um zu prüfen, ob `has_availability` die Sichtbarkeit
steuert, wurde „Feriehus Kornblomst" per `PUT v2/listings/{id}` auf `true`
gesetzt — das Inserat war damit live und buchbar. Danach wurde weitergearbeitet
und der Rücksprung vergessen. Erst beim Zurücksetzen kam heraus, dass Airbnb
dafür ein Pflichtfeld `deactivation_reason` verlangt: ohne diesen Fund wäre das
Objekt dauerhaft sichtbar geblieben, ohne Weg zurück.

Vor JEDEM schreibenden Fremdaufruf gegen ein Live-Konto:
1. **Freigabe holen.** Der Nutzer entscheidet, an welchem Objekt getestet wird —
   nicht am erstbesten aus der Liste.
2. **Rückweg ZUERST beweisen.** Erst belegen, wie der Ausgangszustand
   wiederhergestellt wird (welcher Endpunkt, welche Pflichtfelder), dann
   schreiben. Kein bewiesener Rückweg → kein Schreibtest.
3. **Ausgangszustand notieren** und im selben Durchlauf zurücksetzen — nicht in
   einem späteren Schritt, nicht „gleich noch". Ein Abbruch dazwischen (Timeout,
   Rückfrage, Denkpause) lässt das Live-Objekt sonst verändert stehen.
4. **Danach gegenprüfen**, dass der Ausgangszustand wirklich wieder steht.
Lesende Aufrufe (`GET`) sind davon frei. Ein 200 ist KEIN Beweis, dass etwas
ankam — zurücklesen (Airbnb quittiert verworfene Nutzlasten mit 200).
