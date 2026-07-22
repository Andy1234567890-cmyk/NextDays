# Security-Audit: Auth-System (NextDays, apps/api)

**Art:** Statische Code-Analyse (defensiv, kein Live-Pentest, kein DB-Zugriff).
**Datum:** 2026-07-16
**Scope:** `apps/api` Auth-Kern, RLS/Tenant-Scoping, `apps/web`/`mobile` (nur service_role-Leak-Check), `supabase/migrations`.
**Markierung je Aussage:** [Sicher] = im Code verifiziert · [Wahrscheinlich] = starke Indizien · [Vermutung] = nicht abschließend verifizierbar.

---

## Schritt 1 — Schwachstellen-Checkliste (aus Web-Recherche)

Abgeleitet aus OWASP API Security Top 10 (2023), Supabase-Security (CVE-2025-48757-Muster) und JWT-/PyJWT-Best-Practices. Quellen siehe unten.

| ID | Schwachstellenklasse |
|----|----------------------|
| V1 | JWT `alg:none` bzw. ungeprüfte Signatur akzeptiert |
| V2 | Algorithm-Confusion (RS256/ES256 → HS256, Public Key als HMAC-Secret) |
| V3 | Fehlende `aud`-Prüfung (`audience="authenticated"`) |
| V4 | Fehlende `exp`-Prüfung (abgelaufene Tokens akzeptiert) |
| V5 | Rolle/Tenant aus manipulierbarem `user_metadata` statt `app_metadata` |
| V6 | BOLA/IDOR — per-ID-Zugriff ohne serverseitigen Tenant/Owner-Scope |
| V7 | Self-Signup mit selbstvergebener Rolle/Tenant; fehlende E-Mail-Bestätigung |
| V8 | `service_role`-Key im Frontend/Bundle/Repo (RLS-Totalbypass) |
| V9 | Kein Rate-Limit / Brute-Force-Schutz auf Auth-Endpunkten |
| V10 | Refresh-Token-Handling ohne single-flight (Race / 401-Loop) |
| V11 | Vertrauen in unsignierte Claims (Bucket-Poisoning / Bypass) |
| V12 | RLS nicht auf allen `public`-Tabellen aktiv (anon-Key lesbar) |
| V13 | Interne Cron/Webhook-Guards fail-open statt fail-closed |

---

## Schritt 2 — Befunde (Ampel)

| ID | Status | Beleg (Datei:Zeile) | Begründung |
|----|--------|---------------------|------------|
| V1 | 🟢 abgesichert | `src/core/security.py:58-66` | Explizite `algorithms`-Liste (`["HS256"]` bzw. `["ES256","RS256"]`). `none` wird nie akzeptiert. [Sicher] |
| V2 | 🟢 behoben | `src/core/security.py` (`_ALLOWED_ALGS`) | **Fix:** Allowlist `{HS256, ES256, RS256}` lehnt jeden nicht erwarteten `alg` (inkl. `none`) fail-closed VOR dem Verzweigen ab. Aktiver Confusion-Angriff war ohnehin ausgeschlossen (HS256-Secret ≠ JWKS-Public-Key). [Sicher] |
| V3 | 🟢 abgesichert | `security.py:60`, `security.py:69` | `audience="authenticated"` auf beiden Pfaden. [Sicher] |
| V4 | 🟢 abgesichert | `security.py` (PyJWT `decode`) | PyJWT prüft `exp` standardmäßig; kein `verify_exp=False`. [Sicher] |
| V5 | 🟢 abgesichert | `security.py:92-99`; `auth/account_service.py:782` | Rolle/Tenant NUR aus `app_metadata`. `user_metadata` wird ausschließlich für Anzeigename (`_auth_name`) gelesen, nie für Autorisierung. [Sicher] |
| V6 | 🟢 abgesichert | `features/properties/service.py:154-168` | Per-ID-Reads scopen explizit `.eq("tenant_id", …).eq("id", …)`. Zweite Achse (Owner-Objekt-Scope) in ARCHITECTURE §6.1. [Sicher] |
| V6b | 🟡 Restrisiko | `properties/owners/crm` (0 Treffer `load_scoped`) | Mehrere Slices scopen inline statt über `core.supabase.load_scoped`/`_require_own_*`. Fachlich korrekt, aber verlässt sich auf Disziplin (CLAUDE.md Wurzel 3 empfiehlt Single-Source-Helper). [Wahrscheinlich] |
| V7 | 🟢 abgesichert | `auth/service.py:481-489` | `admin.create_user` setzt Rolle+Tenant serverseitig in `app_metadata`; `email_confirm: True` erzwungen. Kein Client-Signup mit freier Rollenwahl. [Sicher] |
| V8 | 🟢 abgesichert | `rg service_role apps/web mobile` → 0 | Kein `service_role`-Key im Frontend/Mobile/Storybook. [Sicher] |
| V9 | 🟢 abgesichert | `core/ratelimit_middleware.py:68-69`; `config.py:40` | `/auth/login|register|refresh` → Bucket `auth`, `rate_limit_auth="10/60"`, per-IP. [Sicher] |
| V10 | 🟢 abgesichert | `mobile/lib/api.ts:3-33,78` | Bei 401 genau EIN stiller Refresh; Rekursionsschutz für `/auth/refresh`. [Sicher] |
| V11 | 🟡 Restrisiko | `core/ratelimit_middleware.py:78-96` | `_tenant_from_bearer` liest `app_metadata.tenant_id` OHNE Signaturprüfung — nur fürs Fairness-Keying. Angreifer könnte `tenant_id` fälschen, um in einen fremden/anderen Bucket zu fallen (Limit-Umgehung/-Poisoning). IP-Limit greift weiterhin → geringe Schwere. [Sicher] |
| V12 | 🟢 behoben | `supabase/migrations/0154_enforce_rls_explicit.sql` | **Fix:** RLS + tenant-scoped Policies für alle 13 Tabellen EXPLIZIT (tenant_id direkt / über `property_id` abgeleitet / Service-Role-only für `fx_rates`+`stripe_webhook_event`). Zusätzlich `rls_auto_enable()`-Funktion + Event-Trigger versioniert. **Noch nicht eingespielt** (manuelles Deploy-Gate). [Sicher, dass Migration korrekt; Wirksamkeit nach Einspielen] |
| V13 | 🟢 abgesichert | `security.py:113-140` | Cron-Guard: ohne Secret 503 (fail-closed), zeitkonstanter Vergleich `secrets_match`. [Sicher] |

---

## Bestätigte Lücken (nach Schweregrad)

### 🔴 V12 — RLS von 13 Tabellen hängt an externem Event-Trigger (nicht in Migrationen)

**Fakt [Sicher]:** 130 `CREATE TABLE` vs. 116 explizite `ALTER TABLE … ENABLE ROW LEVEL SECURITY`. 13 echte Tabellen ohne explizites RLS-Statement:
`ari_outbox`, `channex_tax_map`, `fx_rates`, `stop_sell`, `stripe_webhook_event`,
`property_access`, `property_emergency_authority`, `property_housebook`, `property_marketing`,
`property_platform_launches`, `property_process`, `property_service_agreements`, `property_tradespeople`.

**Fakt [Sicher]:** `0018_revoke_rls_auto_enable_execute.sql` dokumentiert eine Event-Trigger-Funktion `public.rls_auto_enable()` (`ensure_rls`), die nach jedem `CREATE TABLE` RLS automatisch aktiviert. Diese Funktion ist **nicht in den Repo-Migrationen definiert** — sie „stammt aus dem Supabase-Advisor-Setup" und wird in `0018` nur bedingt behandelt (`if to_regprocedure(...) is not null`).

**Interpretation [Wahrscheinlich]:** Auf der Produktions-DB, wo der Advisor den Trigger angelegt hat, haben die 13 Tabellen RLS aktiv → **kein anon-Key-Leak**. In jeder Umgebung ohne diesen Trigger (frische DB, Self-Hosting, CI, Disaster-Recovery aus reinen Migrationen) läuft der bedingte Block ins Leere → RLS bleibt AUS → die Tabellen sind über den anon-/authenticated-PostgREST-Endpunkt lesbar (CVE-2025-48757-Muster). Sensibel u. a. `property_access`, `property_emergency_authority`, `stripe_webhook_event`.

**Fix-Skizze (nicht umgesetzt):**
```sql
-- neue Migration 0128_enforce_rls_explicit.sql
alter table public.property_access             enable row level security;
alter table public.property_emergency_authority enable row level security;
-- … für alle 13 Tabellen …
alter table public.stripe_webhook_event        enable row level security;
-- Zusätzlich deny-all bzw. tenant-scoped Policy je Tabelle, NICHT nur enable.
-- Und: rls_auto_enable()-Trigger als versionierte Migration ins Repo aufnehmen,
-- statt auf externes Advisor-Setup zu vertrauen.
```
RLS explizit in der Migrationskette verankern — nicht auf einen Trigger außerhalb des Repos verlassen.

### 🟡 V2 — Algorithmus-Branch per Token-Header wählbar
Kein aktiver Exploit, weil HS256 ein eigenes Shared Secret nutzt (nicht den Public Key). Härtung: Erwarteten Algorithmus serverseitig fixieren (z. B. nur ES256/RS256 zulassen, HS256-Fallback nur wenn projektweit nötig) statt anhand des eingehenden Headers zu verzweigen.

### 🟡 V6b — Inline-Scoping statt Single-Source-Helper
`properties`, `owners`, `crm` scopen korrekt, aber inline. Migration auf `load_scoped`/`_require_own_*` reduziert das Risiko, den Scope bei künftigen Reads zu vergessen.

### 🟡 V11 — Unsignierte tenant_id im Rate-Limit-Keying
Geringe Schwere (IP-Limit bleibt). Härtung: für das Keying einen verifizierten Wert nutzen oder ausschließlich auf IP + verifiziertem Post-Auth-Kontext keyen.

---

## Nicht anwendbar / nicht verifizierbar
- Echte Laufzeit-Exploits (Live-JWT-Forgery, PostgREST-Zugriff mit anon-Key) — nicht verifizierbar ohne laufende Umgebung; alle Aussagen sind statisch.
- Ob der `rls_auto_enable()`-Trigger in der aktuellen Prod-DB existiert — **nicht verifizierbar** aus dem Repo (liegt außerhalb der Migrationen). Muss direkt in der DB geprüft werden: `select * from pg_event_trigger;`.

---

## Status der Behebung (2026-07-16)

**Behoben:**
- **V12 (🔴→🟢)** — `supabase/migrations/0154_enforce_rls_explicit.sql` geschrieben. ⚠️ **Muss noch manuell eingespielt werden** (`supabase/apply-migrations.sh`) — Deploy-Gate ist bewusst manuell. Danach in Prod verifizieren: `select * from pg_event_trigger;` und stichprobenartig `select relrowsecurity from pg_class where relname = 'property_access';`.
- **V2 (🟡→🟢)** — `src/core/security.py`: Algorithmus-Allowlist ergänzt (kompiliert, ruff-clean).

**Bewusst offen gelassen (Begründung):**
- **V6b (🟡)** — Migration inline-Scoping → `load_scoped`/`_require_own_*` ist ein verhaltenserhaltender Refactor über mehrere Slices. Gehört mit vollem Qualitätsgate (pytest, pylint 10/10) in Claude Code mit `uv`-Env, nicht blind hier. Kein akutes Risiko: das Inline-Scoping ist korrekt.
- **V11 (🟡)** — Unsigniertes `tenant_id` nur fürs Rate-Limit-Keying, IP-Limit greift immer → geringe Schwere. Eine „echte" Verifikation im Middleware-Pfad kostet Latenz auf JEDEM Request; Kosten/Nutzen spricht gegen einen Schnellfix. Empfehlung: separat entscheiden.

**Nicht erledigt / erfordert deine Aktion:**
- Migration `0154` einspielen (manuell).
- In Prod prüfen, ob PostgREST für Clients erreichbar ist und ob der Advisor-Trigger existierte (retrospektive Expositions-Frage).

## Quellen
- OWASP API Security Top 10 (2023) — API1 BOLA: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- OWASP API Security Top 10 (2023) — API2 Broken Authentication: https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/
- Supabase Docs — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase RLS / CVE-2025-48757-Muster (anon-Key lesbare Tabellen, user_metadata-Falle): https://vibeappscanner.com/supabase-security-guide
- Precursor Security — Supabase RLS Bypasses & Testing: https://www.precursorsecurity.com/blog/row-level-recklessness-testing-supabase-security
- Supabase Docs — JWTs: https://supabase.com/docs/guides/auth/jwts
- Supabase JWT lokal mit Python/FastAPI verifizieren (aud/alg): https://dev.to/zwx00/validating-a-supabase-jwt-locally-with-python-and-fastapi-59jf
