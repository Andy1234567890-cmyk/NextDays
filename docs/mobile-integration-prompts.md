# All-in-One-App — Prompts für Claude Code (P1–P9)

> **ÜBERHOLT (31.07.2026).** Alle Pfadangaben `mobile/...` beziehen sich auf die
> frühere All-in-One-App. Sie ist seit `docs/decisions/0019-zwei-mobile-apps.md`
> in `mobile-bestdays` (Gast) und `mobile-nextdays` (Betrieb) aufgeteilt. Dieses
> Dokument bleibt als Aufzeichnung der Arbeitspakete stehen.

> Nutzung: Jeden Prompt EINZELN in einer frischen Claude-Code-Session im
> Repo-Root ausführen. Erst wenn die Abnahmekriterien erfüllt sind und Andy
> freigegeben hat, den nächsten Prompt starten. Nicht committen ohne Ansage.
> Vision & Entscheidungen: docs/mobile-integration-plan.md — EINE App, vier
> Erlebnisse (Gast · Agentur · Owner · Mitarbeiter), alles über FastAPI /api/v1.

---

## P1 — Auth-Fundament (Backend-Refresh + Mobile-Auth-Kern + Env-Config)

```text
Lies zuerst CLAUDE.md (inkl. Abschnitt „Mobile"), docs/mobile-integration-plan.md
und NOTES.md. Arbeite ausschließlich an diesem Paket, nichts committen.

AUFGABE A — Backend: POST /api/v1/auth/refresh
Im Slice apps/api/src/features/auth/ einen Refresh-Endpoint ergänzen:
- schemas.py: RefreshRequest { refresh_token: SecretStr } → Response ist die
  bestehende SessionResponse (access_token, refresh_token, token_type, expires_in).
- service.py: AuthService.refresh() nutzt den anon-Client
  (supabase.auth.refresh_session bzw. GoTrue token?grant_type=refresh_token).
  Ungültiges/abgelaufenes Refresh-Token → 401 (fail-closed, Wurzel 5), kein
  breites except Exception. Kein Logging des Token-Werts.
- router.py: POST /refresh, KEIN CurrentUser-Guard (der Access-Token ist ja
  abgelaufen), aber dem bestehenden Auth-Rate-Limit-Bucket zugeordnet.
- Tests im Slice-Muster (Unit: Schema, 401-Mapping; Integration-Marker wie in
  tests/conftest.py vorhanden).

AUFGABE B — Mobile: Env-Config
mobile/lib/config.ts umbauen: ein CONFIG-Objekt mit __DEV__-Switch.
- Dev: API http://localhost:8000 (iOS-Sim) / http://10.0.2.2:8000 (Android-Emu)
  — bestehende Platform-Logik behalten.
- Prod: API https://nextdays-api.65.21.144.136.sslip.io,
  SUPABASE_URL https://supabase-kong.65.21.144.136.sslip.io,
  SUPABASE_ANON_KEY als leeres Feld mit TODO-Kommentar (Wert kommt aus Coolify,
  Andy trägt ihn ein; Code muss bei leerem Key sauber degradieren, kein Crash).
- Exportiere API_URL weiter, damit bestehende Importe nicht brechen.
- KEINE URL darf außerhalb dieser Datei stehen (Wurzel 4 sinngemäß).

AUFGABE C — Mobile: Refresh + zentraler Auth-State
1. mobile/lib/auth.ts erweitern:
   - Beim Login access_token UND refresh_token in Keychain speichern
     (react-native-keychain, gleicher Service „nextdays.auth", zweiter Account
     „nd_refresh"), zusätzlich expires_at (Unix-Sekunden) merken.
   - refreshSession(): POST /api/v1/auth/refresh mit gespeichertem
     refresh_token; bei Erfolg beide Tokens atomar ersetzen; bei 401 alles
     löschen (Logout-Zustand). SINGLE-FLIGHT: parallele Aufrufe teilen sich
     EIN laufendes Promise (Wurzel 2 — Auth-Limit ist 10/60/IP).
2. mobile/lib/api.ts: bei Response 401 genau EINEN refreshSession()-
   Versuch, dann Request einmal wiederholen; schlägt auch das fehl → ApiError
   mit Status 401 werfen (kein Loop).
3. Neu: mobile/contexts/AuthContext.tsx — Provider mit
   { status: 'loading'|'signedOut'|'signedIn', me: MeResponse|null,
     login(), logout(), reload() }. me kommt aus GET /api/v1/auth/me
   (Felder: user_id, email, tenant_id, role, capabilities, permissions,
   accommodation_type — Contract siehe apps/api/src/features/auth/schemas.py).
   Provider in App.tsx einhängen. RoleSelect/HostLogin/HostProfile auf den
   Context umstellen (kein ad-hoc getToken() mehr in Screens).
4. Rollen-Gating-Helfer lib/permissions.ts: can(me, capability) — Logik
   spiegeln von apps/web/components/app-sidebar.tsx (admin sieht alles, sonst
   capability/permission im Grant-Set). Noch nicht überall anwenden, nur
   bereitstellen + in HostProfile Rolle/Capabilities anzeigen.
5. Erlebnis-Routing vorbereiten: nach Login/Kaltstart mit gültiger Session
   routet die App anhand me.role — admin|co_admin → HostTabs,
   owner → OwnerTabs (Platzhalter-Screen anlegen, Ausbau in P6),
   staff|cleaner → HostTabs mit Tasks-Fokus (Ausbau in P3). Routing-Logik
   zentral (eine Funktion), nicht in Screens verstreut.

ABNAHME / QUALITÄTSGATE
- Backend: pytest grün, ruff check sauber, pylint 10.00/10 auf geänderten Modulen.
- Mobile: tsc --noEmit in mobile fehlerfrei, Jest grün.
- Manuell nachvollziehbar (beschreiben, nicht selbst starten): Login → Token
  läuft ab → nächster API-Call refresht still → Session bleibt; owner-Login
  landet NICHT im Agentur-Dashboard.
- NOTES.md: Paket-Status P1 abhaken + 3 Zeilen Ergebnis.
```

---

## P2 — Agentur-Erlebnis: Dashboard + Kalender echt anbinden

```text
Lies zuerst CLAUDE.md, docs/mobile-integration-plan.md, NOTES.md. Voraussetzung:
P1 ist abgenommen. Nichts committen.

KONTEXT
mobile/screens/HostDashboard.tsx und HostCalendar.tsx laufen auf
hartkodierten Demo-Daten (Unsplash-Fotos aus lib/photos.ts). Die Web-App holt
dieselben Daten über FastAPI — Contracts in apps/api/src/features/dashboard/
und apps/api/src/features/calendar/ (router.py + schemas.py) sowie den
Web-Wrappern apps/web/lib/*.ts.

AUFGABE
1. Neu: mobile/lib/dashboard.ts und mobile/lib/calendar.ts nach dem
   Muster von lib/properties.ts (typisierte Wrapper über lib/api.ts, deutsche
   Fehlertexte, call<T>-Result-Wrapper). Typen exakt am Pydantic-Contract
   ausrichten — KEINE erfundenen Felder, nullable bleibt nullable.
2. HostDashboard.tsx: echte KPIs/Anstehendes aus /api/v1/dashboard-Endpoints;
   Lade-/Fehler-/Leer-Zustände (Leerzustand ≠ Demo-Daten; Demo-Fallback nur
   gekennzeichnet wie in HostListings — Flag usingDemo).
3. HostCalendar.tsx: Belegung aus GET /api/v1/calendar/availability pro
   Objekt/Zeitraum. Objekt-Auswahl über lib/properties.ts. Statusfarben:
   open/booked/blocked. Monatsnavigation lädt nach.
4. Währung/Beträge: Formatierung NUR aus Daten (currency der Row/Property),
   fehlt sie → symbollos rendern, NIE „€" hardcoden (Wurzel 4). Maskierte
   Beträge (null) als „—".
5. ListingDetail.tsx: die übergebene id endlich benutzen —
   GET /api/v1/properties/{id} statt fester Demo-Daten.

ABNAHME / QUALITÄTSGATE
- tsc --noEmit in mobile fehlerfrei, Jest grün.
- Keine neue URL, kein neues „EUR"/„€" im Diff (grep belegen).
- NOTES.md: P2 abhaken + Ergebnis.
```

---

## P3 — Reservierungen + Tasks + Mitarbeiter-Erlebnis (Rollen-Masking)

```text
Lies zuerst CLAUDE.md, docs/mobile-integration-plan.md, NOTES.md. Voraussetzung:
P2 abgenommen. Nichts committen.

KONTEXT
Contracts: apps/api/src/features/reservations/ und apps/api/src/features/tasks/
(router.py + schemas.py); Web-Referenz apps/web/lib/reservations.ts und
apps/web/lib/tasks.ts. WICHTIG: Das Backend maskiert je nach Rolle — Nutzer
ohne VIEW_GUEST_FULL bekommen nur Vornamen und total_amount: null
(apps/api/src/features/auth/guest_masking.py, permissions.py). Das Frontend
darf diese Maskierung weder umgehen noch „auffüllen".

AUFGABE
1. Neu: mobile/lib/reservations.ts + mobile/lib/tasks.ts
   (Muster lib/properties.ts, total_amount als number|null typisieren).
2. Neuer Screen HostReservations.tsx: Liste (Filter: anstehend/aktuell/
   vergangen), Detail mit Status, Zeitraum, Kanal, Gast (ggf. nur Vorname),
   Betrag (null → „—"). In HostTabs.tsx einhängen — entscheide nach
   Tab-Struktur (max. 5 Tabs, sonst „Mehr"-Muster), begründe die Entscheidung.
3. Neuer Screen HostTasks.tsx: Meine Aufgaben + Team (capability-abhängig via
   lib/permissions.ts), Status-Wechsel (PATCH), Checklisten anzeigen.
4. MITARBEITER-ERLEBNIS (Kern dieses Pakets): Für staff/cleaner ist die App
   primär eine Aufgaben-App. Das Routing aus P1 gibt ihnen eine reduzierte
   Tab-Struktur (Aufgaben · Kalender read-only · Profil) — §4.3: kein
   Finanz-/Vertriebseinblick, keine Reservierungs-Beträge, keine vollen
   Gastnamen. UI blendet aus, das Backend maskiert — beides muss greifen.
5. Statuswechsel-Aktionen idempotent bedienen: Button während laufendem
   Request sperren (Wurzel 2 — Doppel-Tap).

ABNAHME / QUALITÄTSGATE
- tsc --noEmit fehlerfrei, Jest grün.
- Nachweis im Text: Welche Felder maskiert ankommen und wie sie gerendert
  werden (null ≠ 0); wie das staff/cleaner-Erlebnis aussieht.
- NOTES.md: P3 abhaken + Ergebnis.
```

---

## P4 — Inbox + Supabase Realtime

```text
Lies zuerst CLAUDE.md, docs/mobile-integration-plan.md, NOTES.md. Voraussetzung:
P3 abgenommen. Nichts committen.

KONTEXT
Web-Muster: apps/web/lib/use-realtime.ts — dedizierter supabase-js-Client
(Modul-Singleton, persistSession:false), pro Channel `await
supabase.realtime.setAuth(token)` VOR `.subscribe()`, postgres_changes auf
schema public (RLS filtert auf Tenant). Inbox-Contract:
apps/api/src/features/inbox/ + apps/web/lib/inbox.ts.

AUFGABE
1. @supabase/supabase-js in mobile installieren (pnpm). Prüfe, ob bare RN
   zusätzlich react-native-url-polyfill braucht — nur ergänzen, was die Lib
   laut Doku wirklich verlangt.
2. Neu: mobile/lib/realtime.ts + Hook useRealtime — Signatur wie das Web
   ({ table, filter, onChange|onEvent, enabled, debounceMs }), Token aus
   lib/auth.ts (Keychain). SUPABASE_URL/ANON_KEY aus lib/config.ts; Key leer
   → Hook ist no-op (kein Crash, EIN console.warn). Bei Token-Refresh (P1)
   setAuth mit neuem Token erneuern — über Callback am Auth-Modul, kein Polling.
3. HostInbox.tsx echt anbinden: Thread-Liste + Detail über /api/v1/inbox,
   Antwort senden (POST), optimistisches UI mit Rollback bei Fehler.
4. Realtime: Liste und offener Thread abonnieren ALLE speisenden Tabellen
   (aus dem Web-Code übernehmen — Suche nach useRealtime( in apps/web).
   Subscription-Cleanup bei unmount.
5. Dashboard/Kalender aus P2 nachrüsten (reservations/availability),
   debounced Vollreload 400ms wie Web.

ABNAHME / QUALITÄTSGATE
- tsc --noEmit fehlerfrei, Jest grün.
- Beschreibung des manuellen Tests: Nachricht im Web-Dashboard senden →
  erscheint in der App ohne Reload.
- NOTES.md: P4 abhaken + Ergebnis.
```

---

## P5 — Deep-Links, Bundle-ID, Tenant-Registrierung

```text
Lies zuerst CLAUDE.md, docs/mobile-integration-plan.md, NOTES.md. Voraussetzung:
P4 abgenommen. Nichts committen.

AUFGABE
1. URL-Scheme nextdays:// auf beiden Plattformen:
   - iOS: CFBundleURLTypes/CFBundleURLSchemes in
     mobile/ios/NextDaysApp/Info.plist.
   - Android: intent-filter mit <data android:scheme="nextdays"/> in
     mobile/android/app/src/main/AndroidManifest.xml (launchMode prüfen,
     singleTask empfohlen).
2. React Navigation linking-Config im NavigationContainer (App.tsx):
   mindestens nextdays://login, nextdays://host/reservierungen/:id,
   nextdays://host/inbox/:threadId. Kaltstart UND Warmstart abdecken.
3. iOS-Bundle-ID: org.reactjs.native.example.* in
   mobile/ios/NextDaysApp.xcodeproj/project.pbxproj auf com.nextdays.app
   ändern (Debug UND Release). Android applicationId (com.nextdaysapp) NICHT
   ändern ohne Hinweis, dass das die Play-Store-Identität wäre.
4. Tenant-Registrierung: HostSignup-Screen gegen POST /api/v1/auth/register
   (Contract: RegisterRequest — email, password, full_name, tenant_name,
   country, currency, business_type). country/currency als Pflicht-Auswahl
   OHNE Default-Vorbelegung (Wurzel 4 — kein stilles „EUR").
5. In docs/mobile-integration-plan.md unter „Bekannte Risiken" dokumentieren:
   nextdays:// muss in GoTrue ADDITIONAL_REDIRECT_URLS (Coolify) — Andys
   Schritt, Code kann das nicht.

ABNAHME / QUALITÄTSGATE
- tsc --noEmit fehlerfrei, Jest grün.
- Beschreibung: xcrun simctl openurl / adb shell am start -W -a
  android.intent.action.VIEW -d "nextdays://host/inbox/123" → richtiger Screen.
- NOTES.md: P5 abhaken + Ergebnis.
```

---

## P6 — Owner-Erlebnis (Eigentümer-Portal in der App)

```text
Lies zuerst CLAUDE.md, docs/mobile-integration-plan.md, NOTES.md. Voraussetzung:
P5 abgenommen. Nichts committen.

KONTEXT
Das Backend ist FERTIG: apps/api/src/features/public_portal/ (router.py +
schemas.py) — GET /api/v1/public-portal/properties, /calendar, /earnings,
/statements, /block-requests (+POST), /meter-readings (+POST). Auth = normale
Tenant-Auth mit Rolle owner; RLS/RESTRICTIVE-Policies (Migration 0059) und
Daten-Split greifen serverseitig. Web-Referenz: Owner-Portal-Views in apps/web.

AUFGABE
1. Neu: mobile/lib/ownerPortal.ts (Wrapper über lib/api.ts, Typen exakt
   am Pydantic-Contract).
2. Neu: navigation OwnerTabs (ersetzt den P1-Platzhalter):
   Meine Objekte · Kalender · Auszahlungen (Earnings + Statements) · Profil.
3. Screens: OwnerProperties, OwnerCalendar (read-only Belegung eigener
   Objekte), OwnerEarnings (Earnings-Übersicht + Statement-Liste; Währung aus
   Daten, Wurzel 4), OwnerRequests (Sperr-Anfrage stellen mit Zeitraum +
   Status-Liste; Zählerstand erfassen). POST-Aktionen idempotent bedienen
   (Button-Sperre, Wurzel 2).
4. Routing aus P1 greift: owner-Login → OwnerTabs. Ein owner darf nirgends
   Agentur-Screens erreichen (Navigation hermetisch, nicht nur versteckt).
5. Realtime (P4-Hook) auf die speisenden Tabellen der Owner-Views, sofern
   RLS-Policies Events für owner zulassen — prüfen, nicht raten; wenn nein,
   Pull-to-Refresh als Fallback.

ABNAHME / QUALITÄTSGATE
- tsc --noEmit fehlerfrei, Jest grün.
- Beschreibung: owner-Testlogin → landet in OwnerTabs, sieht NUR zugeordnete
  Objekte (owner_property_assignments), Agentur-Routen unerreichbar.
- NOTES.md: P6 abhaken + Ergebnis.
```

---

## P7 — Gast-Konto: Backend-Slice guest_portal (NEUBAU)

```text
Lies zuerst CLAUDE.md, docs/mobile-integration-plan.md, NOTES.md. Voraussetzung:
P6 abgenommen. Nichts committen. Das ist ein NEUBAU — nimm dir Zeit für das
Design, es wird die zweite Auth-Welt der Plattform.

KONTEXT
portal_guests existiert als Tabelle (supabase/migrations/0006_marketplace.sql,
RLS auth.uid()-basiert), aber es gibt KEINEN Backend-Slice dafür. Die
booking_engine (apps/api/src/features/booking_engine/) ist public (Listings,
Availability, POST /reservations, Addons). Ziel: Gäste bekommen ein Konto
(wie bei Booking/Airbnb) — Register/Login/Me, Meine Reisen, Wishlist —
STRIKT getrennt von der Tenant-Welt.

AUFGABE
1. Neuer Vertical Slice apps/api/src/features/guest_portal/ (router.py,
   service.py, schemas.py, dependencies.py, tests/) — Prefix /guest-portal.
2. Auth-Design (WICHTIG, Wurzel 3):
   - Gäste sind Supabase-Auth-User OHNE tenant_id/role in app_metadata;
     stattdessen z.B. app_metadata.portal_guest = true. Register legt atomar
     Auth-User + portal_guests-Row an (Rollback-Muster wie
     features/auth/service.py).
   - Eigene Dependency get_current_portal_guest: verifiziert das JWT
     (Muster core/security.py), verlangt den portal_guest-Claim und LEHNT
     Tokens MIT tenant_id ab (403). Umgekehrt muss get_current_user
     Gast-Tokens weiterhin ablehnen (kein tenant_id-Claim → 401/403) —
     mit Tests belegen, fail-closed (Wurzel 5).
   - Endpoints: POST /register, POST /login, POST /refresh, GET /me.
     Gleiche SessionResponse-Form wie features/auth. Auth-Rate-Limit-Bucket
     zuordnen.
3. Meine Reisen: GET /guest-portal/trips — Reservierungen des eingeloggten
   Gasts. Dafür Verknüpfung Buchung↔Gast-Konto:
   - Migration: reservations um portal_guest_id (nullable, FK) erweitern ODER
     Verknüpfungstabelle — entscheide nach Schema-Lage und begründe.
   - booking_engine.create_booking: akzeptiert OPTIONAL ein Gast-Token
     (wenn vorhanden → Buchung dem Konto zuordnen); bleibt ohne Token voll
     funktionsfähig (anonym buchen wie bisher). Idempotenz des
     Buchungs-Endpoints darf sich NICHT verschlechtern (Wurzel 2).
   - RLS: Gast sieht NUR eigene Reisen (auth.uid()); Vermieter-Sicht bleibt
     unverändert tenant-scoped.
4. Wishlist: neue Migration wishlists (portal_guest_id, property_id, unique
   beides, RLS auth.uid()) + Endpoints GET/POST/DELETE /guest-portal/wishlist.
5. Migration schreiben, NICHT einspielen (apply macht Andy via
   supabase/apply-migrations.sh). JEDE neue Tabelle bekommt RLS.

ABNAHME / QUALITÄTSGATE
- pytest grün (inkl. der Welten-Trennungs-Tests aus 2.), ruff sauber,
  pylint 10.00/10 auf allen neuen/geänderten Modulen.
- Nachweis im Text: Gast-Token gegen /api/v1/reservations → abgelehnt;
  Tenant-Token gegen /guest-portal/trips → abgelehnt.
- NOTES.md: P7 abhaken + Ergebnis (inkl. Migrations-Nummern für Andy).
```

---

## P8 — Gast-Erlebnis: Kunden-App à la Booking/Airbnb

```text
Lies zuerst CLAUDE.md, docs/mobile-integration-plan.md, NOTES.md. Voraussetzung:
P7 abgenommen UND Migrationen von Andy eingespielt. Nichts committen.

KONTEXT
GuestTabs (Home, Discover, Wishlist, Trips, GuestProfile) + ListingDetail,
Checkout, Checkin sind komplette Dummies (Unsplash aus lib/photos.ts).
Backend: /api/v1/booking-engine (public: listings, listing_detail,
availability, POST reservations, addons) + /api/v1/guest-portal (P7).
Design-Referenz für Suche/Filter/Listing-Darstellung: plattform/ (Next.js
Kunden-Portal) — Look & Wording angleichen, Layout bleibt nativ.

AUFGABE
1. Neu: mobile/lib/bookingEngine.ts + mobile/lib/guestPortal.ts
   (Wrapper, Typen exakt an den Pydantic-Contracts).
2. Gast-Auth-Welt clientseitig: eigener GuestAuthContext + Keychain-Accounts
   nd_guest_access/nd_guest_refresh (Service „nextdays.auth" wiederverwenden,
   andere Accounts). Single-flight-Refresh gegen /guest-portal/refresh.
   NIEMALS denselben Token-Speicher wie die Tenant-Welt benutzen. Beide
   Sessions dürfen parallel existieren (Vermieter, der privat bucht).
3. Anonym nutzbar: GuestHome/GuestDiscover → echte Listings + Suche/Filter
   über /booking-engine/listings; ListingDetail → echtes Objekt + Verfügbarkeit
   + Preis (Währung aus Daten, Wurzel 4); Fotos aus dem Backend, lib/photos.ts
   nur noch als gekennzeichneter Fallback.
4. Checkout.tsx: echter Buchungsflow über POST /booking-engine/reservations
   (+ Addons). Eingeloggt → Buchung läuft auf das Gast-Konto (P7). Submit
   idempotent bedienen: Button sperren, bei Timeout NICHT blind neu senden
   (Wurzel 2). Preisanzeige ausschließlich aus der Backend-Antwort — nie
   clientseitig rechnen.
5. Kunden-Dashboard: GuestProfile → Login/Registrierung (Gast-Welt) + Konto;
   GuestTrips → /guest-portal/trips (anstehend/vergangen, Status);
   GuestWishlist → /guest-portal/wishlist (Herz-Toggle auch aus Discover/
   Detail; ausgeloggt → Login-Aufforderung statt stillem Verwerfen).
6. Checkin.tsx bleibt Dummy mit sichtbarem „Bald verfügbar"-Hinweis (hängt am
   OCR-/Meldeschein-Modul, eigenes Paket später).

ABNAHME / QUALITÄTSGATE
- tsc --noEmit fehlerfrei, Jest grün.
- Beschreibung der Flows: anonym browsen → buchen; registrieren → Trips
  sichtbar; Wishlist überlebt App-Neustart; Tenant- und Gast-Session parallel.
- NOTES.md: P8 abhaken + Ergebnis.
```

---

## P9 — Security-Review Gesamtprojekt (Wurzel-basiert)

```text
Lies zuerst CLAUDE.md vollständig. Das ist KEIN Bug-Jagd-Loop „bis 0 Bugs"
(CLAUDE.md verbietet das) — EIN systematischer Durchlauf, Befunde den 5
Wurzeln zugeordnet, Klassen schließen statt Einzelsymptome.

SCOPE: apps/api, apps/web, mobile, builder, plattform,
supabase/migrations, deploy. Marketing-Site nur oberflächlich.

PRÜFRASTER (gezielt suchen, nicht alles lesen):
- Wurzel 2 (Idempotenz): Webhook-Handler (Stripe, Channex, WhatsApp),
  geldbewegende Endpoints, öffentliche POSTs (booking_engine!,
  guest_portal/register) — Redelivery/Doppelklick sicher?
- Wurzel 3 (Scope): per-ID-Zugriffe in Services mit service_role — ungescopte
  Loads (grep .eq("id" ohne tenant-Filter/load_scoped/_require_own_*).
  Owner-RESTRICTIVE-Policies (0059) gegen neue Tabellen abgleichen. Neue
  public-Tabellen ohne RLS (0084-Muster)? NEU: Welten-Trennung Tenant↔Gast —
  kann ein Gast-Token irgendeinen Tenant-Endpoint erreichen oder umgekehrt?
  Alle Dependencies durchgehen.
- Wurzel 5 (fail-closed): Webhook-Signaturprüfungen (secrets_match, byteweise),
  breite except Exception um Kontroll-Signale, angreiferkontrollierter Input
  der 500 wirft, Endpoints die bei fehlendem Secret durchlaufen.
- Mobile: Tokens in Logs/AsyncStorage? Klartext-HTTP im Prod-Pfad?
  Maskierungs-Umgehung im UI? Getrennte Keychain-Accounts beider Welten?
- Secrets im Repo: bekannt ist deploy/mail/client_secret_*.json (Google-OAuth).
  Nach weiteren suchen (private keys, echte .env-Werte, Keys in Configs/Docs).
  NICHTS davon im Report zitieren — nur Pfad + Typ.
- Auth-Ketten: /auth/refresh und /guest-portal/refresh — Rate-Limit-Zuordnung,
  kein Token-Leak in Fehlermeldungen, Refresh-Rotation korrekt.

DELIVERABLE
1. docs/security-review-2026-07.md: Befund-Tabelle (Pfad · Wurzel · Schwere
   hoch/mittel/niedrig · Empfehlung). Für das Google-Client-Secret: Rotation +
   git filter-repo-Schritte NUR dokumentieren, nicht ausführen.
2. Fixes: NUR Befunde mit Schwere hoch UND lokal klar begrenztem Fix direkt
   beheben (mit Tests). Rest bleibt Empfehlung — keine Umbauten auf eigene Faust.
3. Qualitätsgate für alles Angefasste: pytest/ruff/pylint 10.00/10,
   tsc --noEmit (web, builder, mobile falls berührt).
4. NOTES.md: P9 abhaken, Kurzfazit (Anzahl Befunde je Schwere).
```
