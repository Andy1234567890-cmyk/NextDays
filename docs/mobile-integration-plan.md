# Mobile-Integration — Plan: Die All-in-One-App (mobile)

> **ÜBERHOLT (31.07.2026).** Die Aussage „eine einzige App … kein App-Zoo" gilt
> nicht mehr: seit `docs/decisions/0019-zwei-mobile-apps.md` gibt es ZWEI Apps —
> `mobile-bestdays` (myBestDays, Gast) und `mobile-nextdays` (myNextDays,
> Betrieb). Dieses Dokument bleibt als Aufzeichnung der Arbeitspakete P1–P9
> stehen; Produktvision und Ordnerpfade darin sind historisch.

> Verbindlicher Plan. Eine einzige App für ALLE Nutzergruppen der Plattform —
> kein App-Zoo. Umsetzung in 9 sequenziellen Arbeitspaketen
> (`docs/mobile-integration-prompts.md`). Jedes Paket einzeln abnehmbar.

## 1. Produktvision: Eine App, vier Erlebnisse

Die App bedient alle Rollen des Systems. Welche Oberfläche ein Nutzer sieht,
entscheidet NICHT eine manuelle Auswahl, sondern sein Konto:

| Erlebnis | Wer | Datenquelle (existiert?) | Web-Pendant |
|---|---|---|---|
| **Gast/Kunde** (Booking/Airbnb-Stil) | portal_guests (tenant-übergreifend) | `/booking-engine` ✅ public · Gast-Konto ❌ **fehlt komplett** | `plattform/` |
| **Agentur** (PMS-Dashboard) | Tenant-User `admin`/`co_admin` | `/dashboard`, `/calendar`, `/reservations`, `/inbox`, … ✅ | `apps/web/app/(dashboard)` |
| **Owner** (Eigentümer-Portal) | Tenant-User `owner` | `/public-portal` ✅ (Objekte, Earnings, Statements, Sperren, Zähler) | Owner-Portal-Views |
| **Mitarbeiter** (Aufgaben-fokussiert) | Tenant-User `staff`/`cleaner` | `/tasks` ✅ (+ Inventar) | Dashboard, gefiltert |

**Zwei Auth-Welten — strikt getrennt:**
1. **Tenant-Auth** (`users`-Tabelle): JWT mit `app_metadata.tenant_id` + `role`.
   EIN Login-Screen; nach `GET /auth/me` routet die App automatisch:
   `admin|co_admin` → Agentur-Tabs · `owner` → Owner-Tabs ·
   `staff|cleaner` → Mitarbeiter-Tabs. Kein clientseitiges „Aufmachen".
2. **Gast-Auth** (`portal_guests`): tenant-übergreifend, `auth.uid()`-basiert,
   OHNE tenant_id-Claim. Eigener Backend-Slice (P7) mit eigener Dependency —
   ein Gast-Token darf NIE durch `get_current_user` in die Tenant-Welt
   (Wurzel 3). Browsen/Buchen geht auch anonym (booking_engine ist public);
   das Konto ergänzt „Meine Reisen", Wishlist, Profil.

Der bestehende `RoleSelect`-Screen bleibt als Einstieg („Entdecken & Buchen"
vs. „Verwalten & Arbeiten"), wird aber zum reinen Kaltstart-Router: liegt eine
Session vor, geht es direkt ins passende Erlebnis.

## 2. Ist-Stand (verifiziert 13.07.2026)

- App: bare RN 0.86 (pnpm, kein Expo). Struktur ist bereits zweiseitig
  (`RoleSelect` → `GuestTabs`/`HostTabs`, `navigation/types.ts`).
- Echt angebunden: `/auth/login`, `/auth/me`, `/properties`. 13/16 Screens Dummy.
- Blocker: refresh_token wird verworfen (~1h-Session), kein zentraler
  Auth-State, URLs hardcoded, keine Deep-Links, iOS-Bundle-ID = RN-Default,
  kein supabase-js (Realtime).
- Backend-Lücke: **kein Gast-Konto-Slice** (Login/Register für portal_guests,
  Meine-Reisen, Wishlist) — Tabelle `portal_guests` existiert (Migration 0006),
  Logik fehlt.

## 3. Verbindliche Architektur-Entscheidungen

1. Mobile spricht ausschließlich FastAPI `/api/v1` (wie Web). Einzige Ausnahme:
   Supabase Realtime (dedizierter Client, `persistSession:false`,
   `await setAuth(token)` VOR `subscribe()`).
2. Tokens (access + refresh, beide Welten) nur in react-native-keychain.
   401 → genau EIN single-flight Refresh, dann Logout (Auth-Limit 10/60/IP).
3. Token-Refresh über `POST /api/v1/auth/refresh` (P1).
4. Erlebnis-Routing NUR aus Server-Daten: Tenant → `/auth/me`
   (role/capabilities/permissions/accommodation_type), Gast → eigener
   `/guest-portal/me`. Maskierte Felder (`total_amount: null`, Vorname-only)
   als „—" rendern, nie 0/Fantasiewert (Wurzel 4).
5. Umgebung: `__DEV__`-Switch in `lib/config.ts`. Prod =
   `https://nextdays-api.65.21.144.136.sslip.io` (Kong:
   `https://supabase-kong.65.21.144.136.sslip.io`) bis Domain-Cutover.
   Keine URL außerhalb dieser Datei.
6. Gast-Konto-Backend (P7) ist ein eigener Vertical Slice
   (`features/guest_portal/`) mit eigener Auth-Dependency
   (`get_current_portal_guest`) — niemals `AuthContext` der Tenant-Welt
   wiederverwenden. Neue Tabellen (z.B. wishlists) per Migration + RLS.
7. Kein Push (FCM/APNs) in diesem Plan — Realtime deckt Foreground ab.

## 4. Arbeitspakete (sequenziell)

| Paket | Inhalt | Abnahme |
|---|---|---|
| P1 | Auth-Fundament: `/auth/refresh`, Keychain-Refresh, AuthContext, Env-Config | Session überlebt Token-Ablauf |
| P2 | Agentur: Dashboard + Kalender echt (`/dashboard`, `/calendar`) | Echte Tenant-Daten |
| P3 | Reservierungen + Tasks inkl. **Mitarbeiter-Erlebnis** (staff/cleaner-Routing, Masking) | staff/cleaner sehen nur Aufgaben/Inventar |
| P4 | Inbox + Realtime (supabase-js, useRealtime wie Web) | Nachricht erscheint ohne Reload |
| P5 | Deep-Links `nextdays://`, iOS-Bundle-ID, Tenant-Registrierung | Kaltstart via Link → richtiger Screen |
| P6 | **Owner-Erlebnis**: OwnerTabs über `/public-portal` (Objekte, Kalender, Earnings, Statements, Sperr-Anfragen, Zähler) | owner-Login landet automatisch im Owner-Erlebnis |
| P7 | **Gast-Konto Backend**: `guest_portal`-Slice (Register/Login/Me, Meine Reisen, Wishlist + Migration/RLS, Buchung↔Konto-Verknüpfung) | pytest/RLS-Nachweis, Tenant-Welt unberührt |
| P8 | **Gast-Erlebnis App**: GuestTabs echt — Discover/Suche/Detail über `/booking-engine`, Checkout, Gast-Login, Trips, Wishlist (Kunden-Dashboard à la Booking/Airbnb) | Anonym browsen + eingeloggt buchen/verwalten |
| P9 | Security-Review Gesamtprojekt (Wurzel-basiert, inkl. beider Auth-Welten) | Befundliste + Fixes der Hochrisiko-Klassen |

Reihenfolge-Logik: P1 ist Fundament für alles. P2–P5 liefern die Verwalter-Seite
(täglicher Nutzen, Backend fertig). P6 ist billig (Backend fertig). P7/P8 sind
der größte Neubau (Backend + App) und kommen deshalb NACH dem stabilen
Fundament. P9 prüft am Ende das Ganze inkl. neuem Gast-Auth.

## 5. Qualitätsgate (gilt für JEDES Paket)

- Mobile: `tsc --noEmit` in `mobile` fehlerfrei; Jest grün.
- Backend-Änderungen: `pytest` grün, `ruff check` sauber, `pylint` 10.00/10
  auf geänderten Modulen. Neue Tabellen → Migration + RLS (nie automatisch
  einspielen).
- Jede Änderung gegen die 5 Wurzeln aus `CLAUDE.md` geprüft.
- Nichts committen/pushen/deployen ohne ausdrückliche Ansage.
- Nach jedem Paket: `NOTES.md` aktualisieren (Paket-Status P1–P9).

## 6. Bekannte Risiken

- **Zwei Auth-Welten in einer App**: Verwechslungsgefahr Token↔Welt. Regel:
  getrennte Keychain-Accounts (`nd_access`/`nd_refresh` vs. `nd_guest_access`/
  `nd_guest_refresh`), getrennte Clients/Contexts, Backend-Dependencies
  fail-closed (Wurzel 3/5).
- **Auth-Rate-Limit 10/60/IP**: keine Retry-Schleifen; single-flight Refresh.
- **iOS ATS**: Prod nur HTTPS (`NSAllowsArbitraryLoads=false` bleibt).
- **sslip.io = Übergangs-Domain**: Cutover ändert nur `lib/config.ts` +
  GoTrue `ADDITIONAL_REDIRECT_URLS` (Coolify, Andy).
- **Deep-Link-Scheme `nextdays://` in GoTrue** (P5): Sobald GoTrue-Flows per
  Link in die App zurückführen (Magic-Link/Passwort-Reset/OAuth-Callback), muss
  `nextdays://` in `ADDITIONAL_REDIRECT_URLS` (Coolify) eingetragen sein — sonst
  weist GoTrue die Redirect-URL ab. Reine In-App-Navigation (host/inbox/:id,
  host/reservierungen/:id, login, registrieren) braucht das NICHT; der Eintrag
  wird erst mit dem ersten GoTrue-Rücksprung nötig. **Andys Schritt** — Code
  kann die GoTrue-Env nicht setzen.
- **Eingechecktes Google-OAuth-Client-Secret** unter `deploy/mail/` — P9
  (rotieren + aus Git-Historie entfernen; Andys Freigabe nötig).
- **Gast-Buchung anonym vs. eingeloggt**: booking_engine bleibt public;
  P7 verknüpft Buchungen nachträglich/optional mit dem Gast-Konto — dabei
  Idempotenz beachten (Wurzel 2: Doppel-Submit im Checkout).
