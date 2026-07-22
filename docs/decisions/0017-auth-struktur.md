# ADR-0017: Auth-Struktur — kein eigenes Deployment, geteilte Frontend-Mechanik

- Status: **ANGENOMMEN** (2026-07-22)
- Grundlage: 3 Recherche-Agenten (deutsche + internationale Quellen, parallel,
  Ergebnisse konsolidiert und deckungsgleich).

## Frage

Soll „Auth" ein eigener Top-Level-Baustein sein (eigener Service / eigenes
Deployment / eigenes Projekt) — oder ein Modul im Monolithen?

## Entscheidung

**Backend-Auth bleibt KEIN eigenes Deployment. Die aktuelle Struktur ist der
belegte moderne Standard und wird beibehalten.** Für die Frontend-Seite wird die
geteilte Mechanik in ein Package `@nextdays/auth` extrahiert (nicht die Flows).

## Begründung (belegt)

Es gibt ZWEI „Auth"-Dinge, die an zwei verschiedene Orte gehören — beide bei uns
bereits korrekt platziert:

1. **Identity-Provider (IdP) = GoTrue** — ist BEREITS der eigenständige
   Auth-Dienst (separater Container hinter Kong, macht Login/Token/Refresh/MFA).
   Der „Auth als eigener Baustein"-Vorteil ist damit geschenkt, ohne
   Eigenbau/-betrieb. (Supabase Auth Architecture; INNOQ/Keycloak-IdP-Modell.)

2. **App-Auth-Logik (Rollen, Capability-Mapping, Tenant-Anlage, Invite) = Slice
   im Monolithen** — anwendungsfachliche Logik, die Datenmodell + RLS-Kontext mit
   allen Slices teilt. Ein eigener Service dafür wäre:
   - bei EINEM Team Overkill (INNOQ „Module, not Microservices"; informatik-
     aktuell „modulare Monolithe statt Microservices"; Fowler „MonolithFirst";
     Richardson: Split erst bei >1 Team),
   - ein Distributed-Monolith-Anti-Pattern (synchroner Aufruf bei jedem Request),
   - laut INNOQ ein bekanntes Fehlermuster („Auth-Entity-Service") + Single-Point-
     of-Failure („fällt Auth aus, kann sich niemand mehr einloggen").

3. **Auth ist ein Querschnittsbelang** (ITWissen/iSAQB), korrekt umgesetzt als
   FastAPI-`Depends` (`get_current_user`/`require_permission`) + Postgres-RLS +
   BFF-Cookies pro Frontend — nicht als fachlicher Vertical Slice mit eigenem
   Lebenszyklus.

4. **Sicherheit:** Der isolationswürdige Teil (Signatur/MFA/Passwörter) liegt
   bereits getrennt in GoTrue. RLS ist der stärkere Blast-Radius-Schutz — deckt
   auch den PostgREST-Direktpfad (Wurzel 6), den ein Auth-Service gar nicht sähe.

## Ist-Struktur (bestätigt korrekt, keine Backend-Änderung)

- **GoTrue** = separater IdP.
- **`auth`- + `guest_auth`-Slice** (FastAPI) = App-Logik (Rollen/Tenant/Invite),
  Enforcement via `Depends` + RLS. Zwei strikt getrennte Auth-Welten
  (Tenant vs. `portal_guests`).
- **Pro Frontend eine dünne BFF-lib** (Server Actions Login/Logout, Token in
  host-only Cookies).

## Frontend-Konsequenz: `packages/@nextdays/auth` (Mechanik teilen)

web/, plattform/, gastgeber/ haben je eine Kopie von `lib/auth.ts` +
`session-token.ts` → echte 3-fach-Duplikation (Wurzel 4). Extrahiert wird NUR die
nachweislich identische Mechanik; die Flows und die Auth-Welten-Trennung bleiben
bewusst getrennt (Sicherheitsgrenze).

**INS Package** (getrennte Entry-Points `/server`, `/client`, `/types`):
- `ApiError` + `fetchBackend`/`api`-Wrapper (Bearer, `/api/v1`, Fehler-Mapping).
- JWT-`email`-Claim-Decoder (aktuell 3× wortgleich).
- Cookie-Mechanik `persistSession`/`clearSession`/`readToken` — Cookie-Name +
  Refresh-Name als PFLICHT-Parameter, `__Host-`-/`httpOnly`/`sameSite`/`path`-
  Regeln fest erzwungen, NIE ein `Domain`-Attribut, KEIN Default-Cookie-Name
  (Wurzel 4: fehlt der Name → hart fehlschlagen).
- Gemeinsame Typen (SessionResponse, LoginResponse, MeResponse, CallOpts).

**BLEIBT pro App** (bewusste Duplikation / explizite Config):
- Cookie-**Name** + JWT-**Audience** (`nd_access` vs. `__Host-nd_host`) — Kern der
  Isolation, nie im Shared-Body geraten/defaulten.
- web's **Supabase-OAuth-Welt** (Google-Login, nur web).
- Die konkreten **login/register/logout-Flows** + Redirect-Ziele + UI-Forms.

**Sicherheits-Fallstrick (der Grund für den scharfen Schnitt):** Ein geteilter
Helper mit Default-Cookie-Namen könnte versehentlich die falsche Session setzen
(dokumentierter realer „vertauschte-Session"-Vorfall). Deshalb: der Shared-Helper
kennt weder „Tenant" noch „Gast" — die App injiziert Cookie-Name/Audience immer
explizit. Server-only-Code nie über einen gemischten Export ins Client-Bundle.

Rule of Three ist erfüllt (3 reale Kopien) → die Abstraktion ist nicht verfrüht.
