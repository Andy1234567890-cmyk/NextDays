# Lastenheft und Roadmap-Blöcke 1–5 — Mai 2026 (archiviert)

Lastenheft-Eintreffen (13.05.2026), Scope-Erweiterung und die Roadmap-Blöcke 1–5
(Scope-Sync, Datenmodell, Rollen, Kalender-Kern, Aufgaben) inkl. MCP-/DB-Anbindung.
Aus NOTES.md ausgelagert am 01.08.2026.

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
