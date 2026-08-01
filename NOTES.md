# NOTES.md — Live-Session-Status NextDays

> Bei jeder neuen Session ZUERST diese Datei lesen. Nach jeder Session aktualisieren.

## Aktueller Fokus (13.07.2026): Mobile-Integration apps/mobile
**Plan:** `docs/mobile-integration-plan.md` · **Prompts/Arbeitspakete:**
`docs/mobile-integration-prompts.md` (P1–P9, strikt sequenziell).

Ist-Stand Mobile: bare RN 0.86 (pnpm, kein Expo). Echt angebunden nur
`/auth/login`, `/auth/me`, `/properties`; 13/16 Screens Dummy. Blocker:
refresh_token wird verworfen (Session stirbt nach ~1h), kein zentraler
Auth-State, `lib/config.ts` hardcoded localhost, keine Deep-Links,
iOS-Bundle-ID = RN-Default, kein supabase-js (Realtime).

**Vision: All-in-One-App** — EINE App, vier Erlebnisse, Routing aus dem Konto:
Gast/Kunde (Booking/Airbnb-Stil, `plattform`-Pendant) · Agentur (admin/co_admin,
Web-Dashboard-Pendant) · Owner (`/public-portal`, Backend fertig) · Mitarbeiter
(staff/cleaner, Tasks-fokussiert). Zwei strikt getrennte Auth-Welten:
Tenant-Auth (tenant_id+role im JWT) vs. Gast-Auth (portal_guests, auth.uid()).
Gast-Konto-Backend (`guest_portal`-Slice) existiert noch NICHT → Neubau in P7.

Entschieden: Mobile spricht NUR FastAPI `/api/v1` (wie Web); Realtime als
einzige Supabase-Direktverbindung; neuer Endpoint `POST /auth/refresh`;
Prod = sslip.io-URLs bis Domain-Cutover; kein Push in dieser Phase. Regeln
in `CLAUDE.md` (Abschnitt Mobile) verankert.

Paket-Status: P1 ☑ (inkl. P1.1) · P2 ☑ (inkl. P2.1) · P3 ☑ (inkl. P3.1) · P4 ☑
(inkl. P4.1) · P5 ☑ (inkl. P5.1) · P6 (Owner) ☑ · P7 (Gast-Backend) ☑ ·
P8 (Gast-App) ☑ · P9 (Security-Review) ☐
Nach jedem Paket diese Zeile aktualisieren.

**UI/UX-Umbau auf Marktplatz-Struktur (30.07.2026) — ganze App, alle vier
Erlebnisse.** Referenz war die Airbnb-App (Screenshots des Nutzers): Struktur 1:1,
Farben/Typo/Logo bleiben myNextDays.
- Tokens (`theme/tokens.ts`): Fläche WEISS statt beige, Abgrenzung über feine
  Linien statt Schatten, flache Radien (card/img/btn 12, Sheet 28), neue Typo-Skala
  (display 30 / h1 26 / h2 22 / title 15 / body 15). Sternfarbe = ink.
- Neu `components/ui/patterns.tsx`: SearchPill, CategoryTabs, SectionHeader,
  Carousel, ListRow, Sheet, EmptyState — dort sitzt die Seitenstruktur, `kit.tsx`
  bleibt Bausteine. `Card` ist flach mit Rand, `Btn` vollrunde Pille.
- Neu `components/SearchSheet.tsx` (Akkordeon Wo/Wann/Wer, fährt von OBEN ein),
  `components/DateRangePicker.tsx` (Kalender statt getippter Daten — die häufigste
  422-Quelle), `components/ui/PlaceIllustration.tsx` (eigene farbige
  Reiseziel-Illustrationen, Motiv aus dem Ortsnamen abgeleitet).
- „In der Nähe" nutzt den ECHTEN Standort: `lib/standort.ts` (grober Standort,
  `@react-native-community/geolocation`, Berechtigungstexte iOS+Android gesetzt,
  natives Modul faul geladen) + neuer Umkreis-Filter im booking_engine
  (`lat`/`lng`/`radius_km`, Haversine, Sortierung nach Entfernung, 500-km-Deckel,
  422 bei Halbangaben, Objekte ohne Koordinaten fallen raus statt geraten zu werden).
  **Erfordert einen App-Neubau** (`npx react-native run-ios`), Pods sind installiert.
- Neuer Screen `GuestAccount` (Stammdaten), Profil ist jetzt reine Menüliste.
  `listingRows` liefert ortsbezogene Reihentitel + Suchbegriff für den Pfeil-Button.
- Kategorie-Reiter sind datengetrieben (Ferienobjekte/Zimmer aus echten Objekten) —
  „Erlebnisse"/„Services" gibt es im Backend nicht und werden NICHT vorgetäuscht.
  Ebenso kein Google-/Apple-Login-Knopf ohne Backend-Weg.
- Gate: `tsc --noEmit`, ESLint und Jest (12/12) grün; API `ruff`, `pylint` 10.00/10
  auf den geänderten Modulen, `pytest` booking_engine 25/25.

**Datenanbindung abgeschlossen (30.07.2026) — kein Screen mehr auf Attrappen:**
- Demo-/Ersatzdaten ENTFERNT: `lib/photos.ts` (Unsplash-Bilder) und
  `components/Placeholder.tsx` gelöscht, die Demo-Objektliste in HostListings und
  der Null-Datensatz in HostDashboard durch echte Fehlerzustände mit
  „Erneut versuchen" ersetzt. Acht weitere Screens setzten bei einem Ladefehler
  eine LEERE Liste (von echtem Leerstand nicht zu unterscheiden, Wurzel 4) — jetzt
  `null` + sichtbarer Fehler; OwnerRequests verschluckte Fehler ganz und hat nun
  einen Fehlerrahmen.
- HostListings zeigt statt erfundener Bewertung/Belegung („–", „0 %") die drei
  echten Vertriebskanal-Chips aus `PropertyResponse.channels` — wie die
  Objektliste im Web. `properties.currency` (zentral, 0161) statt
  `type_attributes.currency` in `lib/properties.ts`.
- REALTIME-BEFUND (live gegen die Server-DB): von 52 abonnierten Tabellen lieferten
  8 nie ein Event. Postgres-Changes braucht BEIDES — `select` für `authenticated`
  UND Publikations-Mitgliedschaft. Migration 0234 behebt `properties` (Grant fehlte,
  obwohl 0207 ihn ausdrücklich behalten wollte → Objekt-Realtime war in web UND
  mobile tot) und publiziert `property_seasons`/`property_season_assignments`.
  Die fünf Finanztabellen (payments, invoices, invoice_line_items,
  commission_ledger, owner_statements) bleiben BEWUSST ohne Grant (Wurzel 6/0187) —
  dort ist das Abo der Fehler. In mobile behoben (OwnerEarnings hört nur noch auf
  `reservations`); OFFEN in web: konto-abo-section, finance/invoices-client,
  gaeste/guest-detail, use-reservation-detail, eigentuemer/my-statements +
  owner-realtime, reservierungen/booking-timeline.
- Gast-Realtime: `useRealtime` kennt jetzt `tokenSource: "tenant" | "guest"` — mit
  dem Tenant-Token passt für portal_guests keine Policy. Migration 0235 gibt
  `wishlists`/`wishlist_items` das SELECT-Grant (Policy `*_self` = auth.uid()) und
  publiziert sie; Schreiben bleibt serverseitig. GuestWishlist + WishlistDetail
  abonnieren live, das manuelle `load()` nach eigenen Aktionen ist entfallen.
  LIVE BEWIESEN (Transaktion mit rollback): zwei Merklisten angelegt, als Gast 1
  ist genau die eigene sichtbar; `properties` liefert dem Gast 0 Zeilen, `payments`
  verweigert den Zugriff.
- Bewusst OHNE Realtime (im Code begründet): GuestTrips/TripDetail/Checkin —
  `reservations` hat nur tenant-/owner-/staff-Policies. Eine portal_guest-Policy
  würde dem Gast die Rohzeile über den DB-Direktpfad öffnen, während die API
  maskiert (Wurzel 6). Dort aktualisiert Pull-to-Refresh/Focus.
- HostTasks + TaskDetail neu mit `tasks`-Abo. Qualitätsgate: tsc grün, eslint ohne
  Fehler, Jest 3 Suites/12 grün.

**P6 erledigt (13.07.2026) — Owner-Erlebnis über /public-portal:**
- Neu `lib/ownerPortal.ts` (Wrapper über lib/api.ts): getOwnerProperties,
  getOwnerCalendar, getOwnerEarnings, getOwnerStatements, getBlockRequests +
  createBlockRequest, getMeterReadings + createMeterReading. Typen 1:1 am
  Pydantic-Contract (public_portal/schemas.py); payout/price bleiben nullable
  (Maske → „—", nie 0, Wurzel 4).
- OwnerTabs neu (ersetzt P1-Platzhalter): Objekte · Kalender · Auszahlungen ·
  Anfragen. HERMETISCH — ein Owner erreicht keine Agentur-Screens (HostTabs wird
  hier nirgends verlinkt; experienceFor routet owner ausschließlich in OwnerTabs,
  jetzt initial OwnerProperties). Alter screens/OwnerHome.tsx gelöscht.
- Screens: OwnerProperties (nur zugeordnete Objekte), OwnerCalendar (read-only
  Belegungsraster, lokales iso() wie P2.1, Preis symbollos nur wenn Maske ihn
  liefert), OwnerEarnings (Jahres-Earnings + finalisierte Statements; Beträge/
  Währung aus Daten, payout=null → „—"), OwnerRequests (Sperr-Anfrage stellen +
  Status-Liste + Zählerstand erfassen + Konto/Logout gebündelt). POST-Aktionen
  mit busy-Guard gegen Doppel-Submit (Wurzel 2); Datumseingabe JJJJ-MM-TT streng
  validiert (Format + echter Kalendertag), kein Date-Picker-Package → kein neuer
  Native-Build.
- RoleSelect: hartkodiertes navigate("OwnerTabs",{screen:"OwnerHome"}) durch die
  zentrale experienceFor-Ableitung ersetzt (überlebt Tab-Umbenennungen).
- Realtime (P4-Hook) auf allen Owner-Views — vorher gegen die LIVE-DB verifiziert
  (nicht geraten): alle speisenden Tabellen sind in publication supabase_realtime
  UND owner-gescoped (RLS 0059, RESTRICTIVE): properties, owner_properties,
  availability, reservations, block_requests, meter_readings, owner_statements.
  Events kommen serverseitig owner-gefiltert. Abos: Objekte → owner_properties +
  properties; Kalender → availability + reservations; Auszahlungen →
  reservations + owner_statements; Anfragen → block_requests + meter_readings.
- Verifiziert: tsc OK · ESLint 0 Errors (die eine no-void-Warnung in App.tsx ist
  Bestand aus P5.1) · Jest 3 Suites/12 grün (App-Smoke rendert OwnerTabs-Import
  mit).
- Manueller Test (beschrieben): owner-Login → landet automatisch in OwnerTabs
  (experienceFor), sieht in „Meine Objekte" NUR die owner_property_assignments-
  Objekte, Agentur-Routen (HostTabs) sind im Owner-Navigator nicht vorhanden.
  Sperr-Anfrage/Zähler erscheinen nach POST ohne Reload (Realtime, sofern
  anon-Key in lib/config gesetzt — sonst Pull-to-Refresh). Setzt einen owner-
  Testlogin + echten anon-Key voraus.

**P5 erledigt (13.07.2026) — Deep-Links, iOS-Bundle-ID, Tenant-Registrierung:**
- URL-Scheme (seit ADR-0019 je App eigen: `mybestdays://` bzw. `mynextdays://`;
  historisch stand hier `nextdays://`) auf beiden Plattformen:
  · iOS: CFBundleURLTypes/CFBundleURLSchemes in Info.plist (Name com.nextdays.app).
  · Android: zweiter intent-filter (VIEW + DEFAULT + BROWSABLE, data scheme
    nextdays) in AndroidManifest; launchMode war bereits singleTask (Warmstart
    ok), android:exported=true unverändert.
- React-Navigation linking-Config im NavigationContainer (App.tsx): prefixes
  ["nextdays://"], Screens login → HostLogin, registrieren → HostSignup,
  host/reservierungen/:id → ReservationDetail, host/inbox/:threadId →
  HostTabs>HostInbox. Deckt Kalt- (getInitialURL) UND Warmstart (url-Event) ab;
  fallback=<Splash/>. HostInbox liest route.params.threadId und öffnet den Thread
  EINMAL, sobald die Liste geladen ist (autoOpened-Guard, nicht bei jedem
  Realtime-Reload erneut) — echtes InboxThread-Objekt, Header bleibt vollständig.
- iOS-Bundle-ID: org.reactjs.native.example.* → com.nextdays.app in
  project.pbxproj für BEIDE Configs (Debug 305 + Release 334). Android
  applicationId (com.nextdaysapp) BEWUSST unverändert — das wäre die
  Play-Store-Identität; Änderung nur auf ausdrücklichen Hinweis.
- Tenant-Registrierung: `register()` in lib/auth (POST /auth/register, Contract
  RegisterRequest) + AuthContext.register (fetchMe wie login, halb-angemeldet →
  Logout). Neuer Screen HostSignup: Name/Firma/E-Mail/Passwort(≥8) + Land +
  Abrechnungswährung + Art als PFLICHT-Chip-Auswahl OHNE Vorbelegung (Wurzel 4,
  null bis aktiv gewählt); Submit gesperrt bis vollständig. Land und Währung
  UNABHÄNGIG (Währung wird NICHT aus dem Land geraten). Verlinkt aus HostLogin
  („Noch kein Konto? Unternehmen anlegen"). Kein manuelles navigate nach Erfolg —
  Root-Navigation (signedIn) übernimmt.
- Plan: „nextdays:// in GoTrue ADDITIONAL_REDIRECT_URLS" unter Bekannte Risiken
  dokumentiert (Andys Coolify-Schritt; erst nötig, wenn GoTrue per Link
  zurückspringt — reine In-App-Links brauchen es nicht).
- Verifiziert: tsc OK · ESLint 0 Errors (1 Bestands-no-void-Warnung in App.tsx,
  nicht aus P5) · Jest 3 Suites/12 grün.
- Manueller Test (beschrieben): iOS
  `xcrun simctl openurl booted "mynextdays://inbox/123"` bzw. Android
  `adb shell am start -W -a android.intent.action.VIEW -d "mynextdays://inbox/123"`
  → App öffnet Inbox-Tab mit Thread 123 (falls in der Liste); eingeloggt landet
  man direkt dort, ausgeloggt zuerst im Login und danach am Ziel.

**P5.1 Review-Fixes (13.07.2026, Senior-Review):**
- Auth-Guard für Deep-Links war NICHT vorhanden (die P5-Beschreibung
  „ausgeloggt zuerst im Login" stimmte nicht — alle Screens waren bedingungslos
  registriert; nextdays://host/inbox/123 öffnete HostTabs auch ohne Session).
  Fix: bedingte Screen-Registrierung (React-Navigation-Auth-Flow) — HostTabs/
  OwnerTabs/ReservationDetail/TaskDetail existieren nur mit Session,
  HostLogin/HostSignup nur ohne; Deep-Links auf nicht registrierte Routen
  werden ignoriert.
- Login-Landung deterministisch gemacht: navigationRef.reset() ins
  Rollen-Erlebnis, NUR beim Übergang signedOut→signedIn (Kaltstart-Deep-Links
  bleiben unangetastet) — statt auf Prune-Verhalten zu vertrauen.
- Dabei selbst einen Rules-of-Hooks-Fehler gebaut (Hooks nach early return) —
  vom App-Smoke-Test SOFORT gefangen, behoben. Die Jest-Investition aus P1.1
  zahlt sich aus.
- Geprüft und gut: Scheme in Info.plist + Manifest (VIEW/BROWSABLE, singleTask
  war gesetzt), Bundle-ID 2× (Debug+Release), RegisterRequest-Contract passt,
  Land/Währung/Art nullable ohne Default (Wurzel 4). Erneut verifiziert:
  tsc OK, Jest 12/12. → Nächster Schritt: P6.

**P4 erledigt (13.07.2026) — Inbox + Realtime (supabase-js):**
- Deps: @supabase/supabase-js@2.108.2 + react-native-url-polyfill (bare RN
  braucht den URL-Polyfill; beide reines JS → KEIN pod install). Polyfill in
  index.js importiert.
- Neu `lib/realtime.ts` + useRealtime — Signatur wie Web ({table,filter,onChange|
  onEvent,enabled,debounceMs=400}). Dedizierter Singleton-Client
  (persistSession:false); Token aus lib/auth (Keychain), setAuth VOR subscribe;
  RLS filtert auf Tenant. Leerer anon-Key (config) → Hook ist no-op + EIN
  console.warn (kein Crash). Token-Refresh (P1): neuer onTokenChange-Callback in
  lib/auth ruft rtClient.realtime.setAuth(neuesToken) — kein Polling. Cleanup
  (removeChannel) bei unmount.
- HostInbox.tsx echt: Thread-Liste (listInboxThreads) + Chat (getInboxMessages)
  + Antwort senden (sendInboxMessage) OPTIMISTISCH mit Rollback bei Fehler
  (temp-id, Entwurf wird wiederhergestellt); Doppel-Tap-Sperre (sending). Neu
  `lib/inbox.ts` (Contract aus apps/web/lib/inbox.ts).
- Realtime-Abos = ALLE speisenden Tabellen wie im Web-Code übernommen:
  Liste → channex_booking + whatsapp_conversation; offener Thread →
  sandbox_message + inbox_thread_note (filter thread_id=eq.<id>).
- P2-Screens nachgerüstet (debounced 400ms Vollreload): HostDashboard →
  reservations; HostCalendar → reservations + availability + price_overrides +
  stop_sell (wie calendar-board.tsx).
- Verifiziert: tsc OK · ESLint 0 · Jest 3 Suites/12 grün (App.test rendert <App/>
  inkl. supabase-js-Import → lädt sauber, no-op ohne Key).
- Manueller Test (beschrieben, nicht gefahren): im Web-Dashboard eine Nachricht
  an einen Thread senden → INSERT auf sandbox_message → Realtime-Event am
  Mobile-Thread-Abo (RLS lässt nur eigenen Tenant durch) → onChange (400ms
  debounced) lädt getInboxMessages neu → Nachricht erscheint OHNE Reload. Setzt
  voraus: (a) echter anon-Key in lib/config (aktuell leer → Realtime no-op,
  TODO Andy), (b) eingeloggter Tenant.

**P4.1 Senior-Review (13.07.2026) — abgenommen ohne Fixes:**
- Verifiziert: setAuth läuft VOR subscribe (mit cancelled-Guard), Singleton mit
  persistSession:false, leerer Key → no-op + EIN warn, Channel-Cleanup bei
  unmount, onTokenChange-Listener feuert aus storeSession (Login/Refresh/
  Logout). Realtime-Tabellen 1:1 mit apps/web/components/inbox/inbox-list.tsx
  (channex_booking, whatsapp_conversation, sandbox_message, inbox_thread_note).
  Inbox-Endpoints gegen Router bestätigt (GET /inbox, GET+POST
  /{id}/messages). Optimistisches Senden mit temp-id, Rollback stellt Entwurf
  wieder her, sending-Sperre (Wurzel 2). Gates selbst gefahren: tsc OK,
  Jest 12/12.
- Notiert [niedrig]: bei Logout wird setAuth nicht auf null zurückgesetzt —
  offene Channels behalten die alten Claims bis zum Schließen (Token läuft
  ohnehin ab; beim nächsten Mount greift der getToken()-Pfad).
  → Nächster Schritt: P5.

**P3 erledigt (13.07.2026) — Reservierungen + Aufgaben inkl. Mitarbeiter-Erlebnis:**
- Neu `lib/reservations.ts` (listReservations/getReservationDetail) und
  `lib/tasks.ts` (listMyTasks/getTaskDetail/completeTask/listTeamTasks/
  setTaskStatus). Typen exakt am Contract; total_amount/paid_amount/due_amount
  als number|null.
- Neu HostReservations.tsx (Liste, Filter anstehend/aktuell/vergangen via
  YYYY-MM-DD-Vergleich, kein UTC-Versatz) + ReservationDetail.tsx (Status,
  Zeitraum, Kanal, Gäste, Beträge). MASKIERUNG: total/paid/due null → „—" (nie 0);
  guest_name kommt ggf. nur als Vorname (Backend), die App füllt NICHTS auf;
  ota_name null → Kanal-Enum als Fallback (kein Fake).
- Neu HostTasks.tsx (Meine + Team) + TaskDetail.tsx (Checkliste, Abschluss).
  „Team"-Tab + Status-Wechsel (PATCH) NUR bei can(me,'manage_tasks'); cleaner
  sieht keinen Status-Wechsler (Endpoint erfordert MANAGE_TASKS) und schließt
  eigene Aufgaben im Detail über /complete ab. Statuswechsel + Abschluss gegen
  Doppel-Tap gesperrt (busyId/saving, Wurzel 2).
- MITARBEITER-ERLEBNIS (Tab-Struktur-Entscheidung): HostTabs.tsx jetzt
  rollenabhängig. admin/co_admin: Übersicht·Kalender·Buchungen·Aufgaben·Mehr
  (5 Tabs, Regel max 5; Inbox/Inserate/Profil hinter „Mehr" via HostMore.tsx,
  im Navigator mit tabBarButton:()=>null). staff/cleaner: Aufgaben·Kalender·Profil
  (3 Tabs) — keine Übersicht/Buchungen/Inbox/Inserate → kein Finanz-/Vertriebs-
  einblick (§4.3). Begründung „zwei Tab-Sätze statt gemeinsamem Mehr": staff/
  cleaner bekommen die Finanz-/Vertriebs-Tabs GAR NICHT, nicht nur versteckt —
  UI blendet aus UND Backend maskiert (doppelter Schutz).
- Verifiziert: tsc --noEmit OK · ESLint 0 Fehler (1 Bestand-Warnung no-void in
  App.tsx, P1) · Jest 3 Suites/12 grün. Manueller Masking-Nachweis: als cleaner
  kein Reservierungs-Tab sichtbar; falls doch ein Betrag ankäme wäre er null→„—".

**P3.1 Review-Fix (13.07.2026, Senior-Review):**
- Kalender-Tab aus dem staff/cleaner-Erlebnis ENTFERNT: `_STAFF` hat kein
  VIEW_CALENDAR (permissions.py §4.3) → /calendar/availability hätte permanent
  403 geliefert (toter Tab). Ursache war eine falsche Vorgabe im P3-Prompt
  („Kalender read-only"), nicht Claude Codes Umsetzung. StaffTabParamList
  angepasst. Mitarbeiter sehen Belegungszeiten über ihre Aufgaben.
- Geprüft und für gut befunden: Tab-Weiche über can(me,"manage_tasks") korrekt
  (staff/cleaner haben nur VIEW_OWN_TASKS); /complete nutzt Own-Task-Dependency,
  PATCH /status verlangt MANAGE_TASKS (Contract bestätigt); Doppel-Tap-Sperren
  vorhanden (saving-Guard TaskDetail, busyId-Guard HostTasks); Masking-Rendering
  null→„—" in Liste+Detail; /tasks/team + /tasks/detail existieren im Router.
- Notiert [niedrig], nicht gefixt: HostTasks-Statuswechsel zeigt bei Fehler
  keine Meldung (res.ok-only); Reservierungs-Filter sind clientseitig (Backend
  listet nur property_id) — bei großen Tenants später Pagination/Serverfilter.
- Erneut verifiziert: tsc OK, Jest 12/12. → Nächster Schritt: P4.

**P2 erledigt (13.07.2026) — Agentur: Dashboard + Kalender echt angebunden:**
- Neu `lib/dashboard.ts` (GET /reservations/dashboard — NICHT /dashboard/*, das
  ist nur Onboarding/Voice; KPI-Quelle ist reservations, wie apps/web/lib/
  reservations.ts) und `lib/calendar.ts` (GET /calendar/availability). Typen exakt
  am Pydantic-Contract, nullable bleibt nullable (revenue_30d, price). Neu
  `lib/currency.ts` (Hermes-sicher, kein Intl-currency-Style; kein €-Fallback).
- HostDashboard.tsx: echte KPIs (Buchungen/Umsatz 30d + change_pct) + heutige
  An-/Abreisen + Anstehendes; Lade-/Fehler-/Leerzustand getrennt; Demo NUR als
  gekennzeichneter Fallback (usingDemo, wie HostListings). revenue_30d=null →
  keine Umsatz-Kachel (kein erfundener Wert, §4.2).
- HostCalendar.tsx: Monats-Grid der Belegung pro Objekt aus /calendar/availability;
  Objektauswahl (Chips) über lib/properties; Statusfarben open/booked/blocked +
  Legende; Monatsnavigation lädt nach (end exklusiv). Tagespreis symbollos aus den
  Daten (Währung aus type_attributes).
- ListingDetail.tsx: übergebene id wird endlich benutzt → GET /properties/{id};
  nur echte Felder (Titel/Ort/max_guests/Beschreibung/Fotos/basePrice), keine
  erfundenen Bäder/Bewertungen; Preis symbollos, „Preis auf Anfrage" wenn null.
- Verifiziert: tsc --noEmit OK · ESLint 0 · Jest 3 Suites / 12 grün · grep-Belege:
  keine neue http(s)-URL und kein €/„EUR" im Code der P2-Dateien (nur Kommentare +
  ISO-Symbol-Map in currency.ts).

**P2.1 Review-Fix (13.07.2026, Senior-Review):**
- HostCalendar `iso()` nutzte `toISOString()` (UTC-Konvertierung): in CET/CEST
  zeigte jede Zelle die Belegung des VORTAGS und der Lade-Zeitraum war um einen
  Tag verschoben → auf lokales YYYY-MM-DD umgestellt (getFullYear/Month/Date).
  Beim Kalender (Double-Booking-Entscheidungen) war das Schwere „hoch".
- Notiert [niedrig], nicht gefixt: HostDashboard `todayLabel`/`dayShort` parsen
  "YYYY-MM-DD" via `new Date()` (UTC) — in Zeitzonen westlich von UTC ein Tag
  Versatz im Label; für EU-Nutzer korrekt.
- Contracts gegen Backend verifiziert (DashboardResponse, DayAvailability 1:1;
  Endpoint-Wahl /reservations/dashboard korrekt — der dashboard-Slice ist nur
  Onboarding/Voice). €-Treffer im Grep sind ausschließlich Bestand der
  Gast-Dummy-Screens (P8-Scope). Erneut verifiziert: tsc OK, Jest 12/12.
  → Nächster Schritt: P3.

**P1.1 Review-Fixes (13.07.2026, nach Senior-Review):**
- Wurzel 4: erfundener DEV-anon-Key aus `lib/config.ts` entfernt → leer +
  TODO(Andy): echten anon-Key aus Coolify eintragen (Hash-Abgleich hatte
  belegt, dass der Wert keinem echten Key entsprach).
- Wurzel 5: `experienceFor()` fail-closed — unbekannte/fehlende Rolle gibt
  jetzt null → App.tsx/RoleSelect machen Logout + Login statt Default ins
  Agentur-Dashboard.
- `isAuthPath` um `/auth/register` ergänzt (401 dort = fachlich, kein Refresh).
- DEV-Supabase-URL als konsistent bestätigt (apps/api/.env zeigt auf denselben
  sslip.io-Kong — lokales Backend läuft gegen Prod-Supabase).
- Jest repariert: Ursache war NICHT fehlendes Preset, sondern pnpm-Pfadstruktur
  (`node_modules/.pnpm/...`) im `transformIgnorePatterns` — jest.config.js +
  jest.setup.js (Keychain-In-Memory-Mock, gesture-handler, safe-area).
  11 neue Unit-Tests: auth (Login-Persistenz, single-flight, refresh-401 →
  Tokens weg, Netzfehler → Tokens bleiben) + api (401→1 Retry mit neuem Token,
  Refresh-Fail → kein Retry, Auth-Pfade ohne Zyklus, 503-Mapping).
- Verifiziert: tsc --noEmit OK · Jest 3 Suites / 12 Tests grün · kein
  eyJ-String mehr in apps/mobile. → Nächster Schritt: P2.

**P1 erledigt (13.07.2026) — Auth-Fundament:**
- Backend: `POST /api/v1/auth/refresh` (RefreshRequest→SessionResponse), GoTrue
  `refresh_session` über anon-Client, ungültiges Token → fail-closed 401
  (spezifisch `GoTrueAuthError` gefangen, Token nie geloggt), dem Auth-Rate-Limit-
  Bucket zugeordnet. pytest 32 passed, ruff clean, pylint 10.00/10.
- Mobile: `lib/config.ts` mit `__DEV__`-Switch (Prod-anon-Key leer + TODO für Andy,
  degradiert sauber); `lib/auth.ts` speichert access+refresh+expires_at in getrennten
  Keychain-Accounts, `refreshSession()` single-flight; `lib/api.ts` 401→genau 1×
  Refresh+Retry; `contexts/AuthContext.tsx` (status/me/login/logout/reload);
  `lib/permissions.ts` `can()` (Web-Sidebar-Logik); `lib/experience.ts` zentrales
  Rollen-Routing (admin/co_admin→HostTabs, owner→OwnerTabs, staff/cleaner→HostTabs).
  RoleSelect/HostLogin/HostProfile auf Context umgestellt; OwnerTabs-Platzhalter (P6).
  tsc grün, ESLint 0 Fehler (1 Style-Warnung Bestand: Content-Type-Header).
- ~~⚠ Jest projektweit nicht lauffähig~~ → in P1.1 behoben (Ursache war die
  pnpm-Pfadstruktur im transformIgnorePatterns, nicht ein fehlendes Preset);
  Details im P1.1-Block oben.
- Manueller Flow (beschrieben, nicht gestartet): Login → me lädt → Erlebnis-Route;
  Access-Token läuft ab → nächster Call bekommt 401 → single-flight refreshSession →
  Request-Retry → Session bleibt; refresh-401 → Tokens gelöscht, signedOut.
  owner-Login → OwnerTabs (nicht Agentur-Dashboard).

⚠ Offen für Andy: (1) eingechecktes Google-OAuth-`client_secret_*.json` unter
`deploy/mail/` — rotieren + aus Git-Historie entfernen (Teil von P9);
(2) echten Supabase-anon-Key aus Coolify in `lib/config.secrets.ts` der App
eintragen (DEV + PROD), sonst bleibt Realtime ab P4 stumm.

---

## Vorheriger Fokus
**Lastenheft eingetroffen (Stand 13.05.2026) — Scope deutlich erweitert.**
- `docs/LASTENHEFT.md`: konsolidierte fachliche Quelle der Wahrheit.
- `docs/REQUIREMENTS-GAP.md`: Abgleich mit Ist-Stand (✅/🟡/🔴/⚠️) + abgeleitete
  Datenmodell-Erweiterungen + priorisierte Roadmap (10 Blöcke).
- **Wichtige Scope-Änderungen:** Revolut = primäres Zahlungs-Gateway (Stripe sekundär,
  Entscheidung getroffen); 3 native Sprachen DE/DK/EN; glatte Beträge (keine Cents);
  neue Module (Dashboard-Personalisierung, Aufgaben/Checklisten, CRM/Partner,
  8-stufiges Onboarding); neue Rollen admin + co_admin; Eigentümer-/Mitarbeiter-Portale.
- **Marketing-Website** als entkoppelter Top-Level-Ordner `marketing/` verankert
  (ADR-0002), eigenes Deployment, keine PMS/Auth-Kopplung.

**Roadmap-Blöcke 1–2 erledigt:**
- **Scope-Sync:** PROJECT.md (Module 13–16, Rollen admin/co_admin, Tech Revolut,
  Sprachen DE/DK/EN, glatte Beträge, Ökosystem), ADRs 0003–0007.
- **Datenmodell:** Migrationen 0009–0015 — **38 Tabellen, alle RLS**, gegen echte
  Postgres (lokal, PG14) verifiziert. Enum-Erweiterungen, property_type,
  gateway_ref, neue Tabellen für alle Lastenheft-Bereiche.
- **Slices:** tasks/crm/dashboard/content angelegt (Health), payments-Gateway-
  Adapter (Revolut/Stripe, ADR-0003). Tests: 22 passed, 1 skipped. ruff clean.

**Roadmap-Block 3 erledigt (Rollen & Berechtigungen):**
- UserRole-Enum +admin/+co_admin; `permissions.py` mit Capability-Matrix (Lastenheft
  §4): admin=alles, co_admin=operativ, owner=Daten-Split (Vorname/Netto), staff/cleaner
  =nur operativ. `require_permission`-Dependency. `/me` liefert capabilities.
- Tests: 30 passed, 1 skipped. ruff clean.

**README** um kundenverständliche Lastenheft-Diagramme erweitert (Mermaid, validiert):
System-Überblick, Modul-Mindmap (voller Funktionsumfang), Rollen-/Daten-Split-Matrix.

**MCP + echte DB:** Supabase-MCP via PAT; alle Migrationen (0001–0019) auf dem
echten Projekt kfzcllntmizpdxcojpmd angewandt & verifiziert (41 Tabellen, alle RLS,
0 Security-Advisors). auth E2E gegen echte DB getestet (admin lädt owner/staff/cleaner).
JWT-Verifikation auf ES256/JWKS umgestellt (modernes Supabase).

**Roadmap-Block 5 erledigt (Aufgaben & Checklisten §2.5 + §4.3):**
- Migration 0019: task_substitutions (Vertretung) + staff_property_assignments
  (Stamm-Mitarbeiter). tasks-Slice mit Logik: create/list/status, auto-Generierung
  bei Buchung (Anreise-Check + Endreinigung), Checklisten + Foto-Nachweise,
  Vertretung anfragen/annehmen, Inventar (auch unterkunftslos). Capability-geschützt.
- Tests: 52 passed, 1 skipped. ruff clean.

**Roadmap-Block 4 erledigt (Kalender-Kern, Herzstück §2.2):**
- calendar-Slice mit echter Logik: get_availability, check_availability
  (Double-Booking-Erkennung), block (lehnt gebuchte Tage ab → 409), set_price_override
  (setzen/zurücknehmen). Supabase-Client injiziert (mockbar).
- Endpoints: GET /availability, /check; POST /block, /price-override — geschützt über
  Capability view_calendar / manage_calendar.
- Neue Migration 0016 (price_overrides) — gegen echte Postgres validiert (16/16,
  39 Tabellen, alle RLS).
- Tests: 39 passed, 1 skipped. ruff clean.

Offen für Andy (in REQUIREMENTS-GAP.md): i18n-Lib-Wahl (next-intl angenommen,
ADR-0004), Rundungs-Policy (half-up, ADR-0005), DK-Felder nullable (umgesetzt).
Migrationen noch nicht gegen den echten Supabase-Stack gefahren (Docker war aus) —
aber gegen lokales Postgres validiert. Nächste Blöcke: Rollen/Berechtigungen,
Kalender-Kern, dann Slice-Logik gemäß Roadmap.

---

## Vorheriger Stand: Block 3 — Datenmodell + auth-Slice stehen.

**3a — Supabase-Migrationen** (`supabase/migrations/0001…0008`):
- Alle Kern-Tabellen (§4) + Marktplatz-Tabellen (Phase 2) inkl. Enums, Checks, Indizes.
- Tenant-Auflösung: `public.current_tenant_id()` liest tenant_id aus JWT `app_metadata`
  (Entscheidung: JWT-Claim, kein users-Join in Policies).
- RLS auf ALLEN Tabellen; direkt-tenant-gebundene via tenant_id, abgeleitete
  (rate_plans/availability/messages/payments) via Parent-Join. Marktplatz minimal.
- `availability` unique(property_id,date) = Double-Booking-Schutz.
- Reihenfolge: 0007_helpers VOR 0008_rls_policies (Policies nutzen die Helper-Funktion).
- **Noch NICHT angewandt** — Docker lief nicht. Verifikation steht aus: `supabase start`
  dann `supabase db reset` (macht Andy). SQL nur statisch geschrieben, nicht gegen DB getestet.

**3b — auth-Slice voll** (`features/auth/`):
- `schemas.py`: UserRole (StrEnum), Register/Login-Requests (SecretStr-Passwort),
  SessionResponse, MeResponse. `email-validator` als Dependency.
- `service.py`: register() legt atomar Tenant→Auth-User(app_metadata)→users-Row an,
  mit sauberem Rollback bei Fehlern (kein except:pass). login() via anon-Client
  sign_in_with_password. me() aus AuthContext. AuthError→HTTP-Mapping im Router.
- `dependencies.py`: get_auth_service (anon+service Client), require_role()-Guard.
- `router.py`: POST /register (201), POST /login, GET /me (CurrentUser), GET /health.
  Health bewusst OHNE Supabase-Client (kein Key nötig → läuft auch unkonfiguriert).
- `tests/conftest.py`: integration-Marker skippt, wenn Supabase unerreichbar.
- **Verifiziert:** pytest → 18 passed, 1 skipped (integration); ruff → clean.
  Unit-Tests decken Schema-Validierung, require_role, register-Rollback ab.
  Integration-Test (register→login→me) läuft erst mit laufendem Stack.

Test-Setup-Hinweis: Host hat py3.11 + kein uv. Tests liefen in Wegwerf-venv /tmp/nd-venv.
Projekt zielt auf py3.12 — für echtes Dev-Env uv + py3.12 nutzen.

Als Nächstes (Block 4): Stack hochfahren + Migrationen anwenden/verifizieren, dann
nächster Slice (properties) nach auth-Muster, oder Web-Setup (shadcn/Iconify/themes).

## Branch
`main` (noch leer) — erste Arbeit auf `chore/scaffold`.

## Backlog (priorisiert)
1. [ ] **Stack hochfahren + Migrationen anwenden** (`supabase start` → `db reset`),
       Integration-Test grün bekommen, RLS gegen echte DB verifizieren. (Andy)
2. [x] Kern-Migrationen (§4) mit RLS + tenant_id geschrieben (Block 3a, ungetestet gegen DB).
3. [x] `auth`-Slice voll (Registrierung/Login/Tenant/Rollen) als Muster (Block 3b).
4. [ ] Nächster Slice nach auth-Muster (Vorschlag: properties).
5. [ ] shadcn/ui (v4-Variante) + Iconify + next-themes (Light/Dark) im Web einrichten.
6. [ ] Übrige Slices nach auth-Muster.
7. [ ] Pre-Commit-Hooks (ruff + pytest grün) + CI.
8. [x] **Server-/DB-Hosting entschieden + Deploy-Dateien angelegt** — self-hosted
       Supabase + FastAPI + Redis auf EINEM Hetzner-Server (CX43, Helsinki) via
       Coolify. Repo-Artefakte unter `deploy/` (SB-Stack-Compose, Prod-Dockerfile,
       App-Prod-Compose, `.env.example`). Siehe **ADR-0010**. (Go-Live-Schritte
       im Browser/Server: Andy.)

## Offene Fragen (für Andy / Call mit Jeanine & Torsten)
- Channel-Manager-Architektur: Direkt-Anbindung (Booking/Airbnb/Vrbo Connectivity) vs. Aggregator (Feondi)? → ADR-0001
- MVP-Scope: Was muss Version 1 können, um live zu gehen?
- Beteiligung (10%) — vertraglich woran genau? (gehört in Gesellschaftervertrag, nicht Code)
- Theme-Farben: final aus Jeanines Logo (Platzhalter im @theme bis dahin)
- Stundenschätzung: pro Phase als Spanne, NICHT als harte Gesamtzahl
- **Payment-Provider final klären** (ADR-0010, offener Punkt): MVP läuft OHNE
  Payments; Stripe Connect ist geplant, Revolut-Key war Altlast → vorerst raus.
  Vor der Payment-Implementierung entscheiden: ein Provider vs. Adapter-Beibehalt
  (ADR-0003 nennt Revolut primär — Widerspruch zur neueren Stripe-Connect-Planung).

## Status Designs / Tokens
- Theme-Tokens = Platzhalter in apps/web/styles/globals.css (TODO mit Logo-Farben ersetzen)
