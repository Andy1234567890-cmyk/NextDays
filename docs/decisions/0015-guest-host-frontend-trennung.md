# ADR-0015: Gast- vs. Gastgeber-Frontend — getrennte Apps, Subdomains, Sessions

- Status: **angenommen**
- Datum: 2026-07-22

## Kontext

Die Plattform (`plattform/`, unser globaler Marktplatz) hat zwei strikt getrennte
Nutzerwelten:

- **Gast (Demand):** sucht + bucht Objekte. Auth = `portal_guests` (kein Tenant).
- **Gastgeber (Supply):** verwaltet Objekte, Kalender, Preise, Reservierungen,
  Bewertungen, sieht seine 8 %-Provisionen. Auth = Tenant-Nutzer
  (`account_type='marketplace'`).

Ein erster (verworfener) Bauversuch legte den Gastgeber-Bereich als **Pfad
`/host` in die Gast-App** und benutzte **dasselbe Cookie `nd_access`** für beide
Welten, unterschieden nur durch die Rolle im JWT. Das ist ein Architekturfehler:
es vermischt zwei Auth-Welten, die laut CLAUDE.md (Wurzel 7, „zwei strikt
getrennte Auth-Welten") getrennt bleiben müssen.

## Recherche (quellenbelegt)

**1. OTA-Industrie-Standard (3 von 4 Plattformen):** Gast und Host auf getrennten
Subdomains + eigener Backoffice-App.
- Booking.com: `www.booking.com` (Gast) vs. `partner.booking.com` (Extranet),
  getrennte Konten + eigene Login-Seite.
- Vrbo/Expedia: getrennte Portale (Owner Dashboard / Partner Central) unter
  gemeinsamer Identität.
- Lodgify: `app.lodgify.com` (Host-Dashboard) vs. White-Label-Booking-Site (Gast).
- **Airbnb** ist die Ausnahme (ein Account, Rollen-Toggle auf `airbnb.com/hosting`)
  — passt nicht zu unserer strikten Tenant-vs-`portal_guests`-Trennung.

**2. Next.js-Umsetzung (offiziell, Multi-Zones):** Zwei getrennte Next.js-Apps im
Monorepo, geteilter Code in `packages/*`. Route-Gruppen nur *innerhalb* einer App.
Quelle: https://nextjs.org/docs/pages/guides/multi-zones ·
https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository

**3. Cookie-/Session-Sicherheit (RFC 6265 §8.5/§8.6, MDN, OWASP, RFC 7519):**
- Ein geteiltes/`Domain`-scoped Cookie bietet keine Isolierung zwischen (Sub-)Hosts.
- Korrekt: pro Subdomain ein **host-only Cookie** (kein `Domain`-Attribut) mit
  `__Host-`-Präfix, `HttpOnly; Secure; SameSite=Lax`.
- Rolle im JWT reicht NICHT — ohne **`aud`-Claim** wird ein Gast-Token an
  Host-Endpunkten akzeptiert (Rollen-/Empfänger-Verwechslung). `aud` = für wen das
  Token gilt; `role`/`scope` = was es darf. Beide nötig.
  Quelle: https://datatracker.ietf.org/doc/html/rfc6265 ·
  https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html ·
  https://workos.com/blog/how-to-validate-the-jwt-aud-claim-and-why-it-matters

## Entscheidung

Gast- und Gastgeber-Frontend sind **getrennte, eigenständige Next.js-Projekte**
mit getrennten Domains und getrennten host-only Cookies:

| | Gast (Demand) | Gastgeber (Supply) |
|---|---|---|
| Projekt | `plattform/` (Top-Level, eigenes Projekt — BLEIBT) | eigenes Top-Level-Projekt (neu) |
| Domain | Root (`mynextdays.com`, SEO-indexiert) | Subdomain (`host.mynextdays.com`, `noindex`) |
| Cookie | `nd_access` (bestehend) | `__Host-nd_host` (host-only, kein Domain) |
| Auth-Welt | `portal_guests` (guest_auth-Slice) | Tenant-Nutzer (auth-Slice) |

**Wichtig (Nutzer-Vorgabe, verbindlich):** Frontends sind bei NextDays
**eigenständige Top-Level-Projekte**, NICHT unter `apps/` gebündelt und kein
gemeinsames Turborepo-Workspace. `plattform/` bleibt ein eigenständiges Projekt
auf Top-Level. Das Gastgeber-Dashboard wird ebenfalls ein eigenständiges
Top-Level-Projekt (analog `plattform/`). Die generische „alles in apps/"-Konvention
aus der Recherche wird hier bewusst NICHT angewendet — die Struktur-Entscheidung
liegt beim Nutzer. Bestehende Ordner (`apps/api`, `apps/web`, `mobile` …)
werden im Rahmen dieses Auftrags NICHT umstrukturiert.

### Backend-Anbindung: Server Components + Server Actions (KEIN Proxy-Route-Handler)

Der bestehende same-origin Proxy (`app/api/v1/[...path]/route.ts`, in `apps/web`
und `plattform/`) ist das ältere Muster. Der moderne, deutsch belegte Standard für
Next.js 15 (App Router):

- **Lesen** → async **Server Component**: Token per `cookies()` aus `next/headers`
  serverseitig lesen, als `Authorization: Bearer` an FastAPI **direkt** fetchen
  (server-zu-server, GET-Caching bleibt). Der Token verlässt den Server nie.
- **Schreiben** → **Server Action**: Cookie → Bearer → FastAPI, danach
  `revalidatePath`/`revalidateTag`. Typsicher, unter der Haube POST.
- **Route Handler** nur noch für: Login/Logout/Refresh (Cookie *setzen*), Webhooks
  (Stripe/Channex), Realtime-Trigger, Uploads — NICHT als allgemeiner API-Proxy.
- **Zentraler Data Access Layer** (`lib/api-server.ts`): kapselt Cookie-Lesen +
  Bearer-Injektion + FastAPI-Basis-URL an EINER Stelle. Autorisierung nah an den
  Daten (Server Component/DAL), NICHT allein in der Middleware (heise-CVE
  Middleware-Bypass).

Belege (deutsche Quellen): heise (BFF-Pattern, Nov. 2025), codecentric (Server
Actions in Next.js 14), informatik-aktuell (Server Components holen Daten direkt
vom remote HTTP-Endpunkt).

### Auth-Welt-Trennung serverseitig (GoTrue-Realität)

Supabase GoTrue stellt für Gast UND Tenant-Nutzer dasselbe `aud="authenticated"`
aus — ein custom `aud` pro Welt ist ohne GoTrue-Config-Eingriff nicht verfügbar.
Die Welten unterscheiden sich real durch `app_metadata.tenant_id` (Host hat einen,
Gast nicht). Die Trennung existiert bereits (`get_current_user` vs.
`get_current_guest`); der offene Härtungspunkt ist, den Gast-Guard ein
Tenant-Token ablehnen zu lassen — als EIGENER, sauber getesteter Auth-Auftrag
(nicht als Schnellschuss im Guard, weil `tenant_id=None` ein legitimer Zustand
ist, z. B. `/auth/me` frisch nach Registrierung).

## Migrationspfad (sicher, schrittweise — kein Big-Bang)

`plattform/` und die neue Host-App sind eigenständige Projekte mit je eigener
bun.lock (kein gemeinsames Workspace-Tooling — bewusste Entscheidung). Der Bau
erfolgt so, dass bestehende Deployments (Coolify, watch_paths) NICHT gefährdet
werden:

1. **Host-App** als neues eigenständiges Top-Level-Projekt anlegen (eigenes
   `__Host-nd_host`-Cookie, Data Access Layer statt Proxy). `plattform/` bleibt
   unverändert.
2. Gastgeber-Dashboard-Screens dort bauen (Server Components + Server Actions).
3. **Deployment:** eigene Coolify-App auf `host.`-Subdomain, eigene watch_paths.
   Gast-App-Deployment unverändert.
4. **Auth-Härtung** (Gast-Guard lehnt Tenant-Token ab) als eigener, getesteter
   Auftrag danach.

## Konsequenz

- Keine Rollen-Verwechslung mehr (host-only Cookies + `aud` erzwingen die Trennung
  auf Browser- UND Server-Ebene, nicht nur per App-Logik).
- Der falsch platzierte `/host`-Pfad in `plattform/` wurde entfernt.
- Bestehende Deployments bleiben während der Migration lauffähig (schrittweise,
  rückwärtskompatibel).
