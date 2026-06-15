# NOTES.md — Live-Session-Status NextDays

> Bei jeder neuen Session ZUERST diese Datei lesen. Nach jeder Session aktualisieren.

## Aktueller Fokus
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

## Offene Fragen (für Andy / Call mit Jeanine & Torsten)
- Channel-Manager-Architektur: Direkt-Anbindung (Booking/Airbnb/Vrbo Connectivity) vs. Aggregator (Feondi)? → ADR-0001
- MVP-Scope: Was muss Version 1 können, um live zu gehen?
- Beteiligung (10%) — vertraglich woran genau? (gehört in Gesellschaftervertrag, nicht Code)
- Theme-Farben: final aus Jeanines Logo (Platzhalter im @theme bis dahin)
- Stundenschätzung: pro Phase als Spanne, NICHT als harte Gesamtzahl

## Status Designs / Tokens
- Theme-Tokens = Platzhalter in apps/web/styles/globals.css (TODO mit Logo-Farben ersetzen)
