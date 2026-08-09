# Red-Team-Audit — NextDays (10 Angreifer-Agenten, 12-Monats-Threat-Intel)

**Datum:** 2026-07-16
**Methode:** 10 parallele Red-Team-Agenten je Angriffsfläche; jeder sammelte zuerst die Schwachstellen der letzten 12 Monate (mit CVE-IDs) und mappte sie als Kill-Chain gegen den Code. Statisch (kein Live-Exploit gegen laufende Instanz), read-only.
**Vorläufer:** `SECURITY-AUDIT-AUTH.md`, `SECURITY-AUDIT-2.md`, `SECURITY-AUDIT-MEGA.md`. Mehrere frühere Befunde wurden zwischenzeitlich **gefixt** (siehe „Seit letztem Audit geschlossen") — dieser Report spiegelt den aktuellen Stand.
**Markierung:** [Sicher] = im Code verifiziert · [Wahrscheinlich] = starke Indizien, Live-Bestätigung offen · [Vermutung].

> ### ⚠ Stand 2026-08-08: die Haupt-Kill-Chain ist GESCHLOSSEN
>
> Dieser Report ist eine **Momentaufnahme vom 2026-07-16** und wird als solche
> stehen gelassen (er belegt, wie der Befund entstand). Der schwerste Punkt —
> **SB-1/SB-2/PG-1, der PostgREST-Rollen-Bypass** — ist mit den Migrationen
> **`0336`, `0337_direktpfad_sensible_tabellen_schliessen` und `0339`** behoben.
> Damit sind die folgenden Aussagen im Text **überholt**:
>
> - „keine DML-`revoke` auf `public.users`" (Zeile 31) → `0337` entzieht
>   `select,insert,update,delete` auf `public.users` von `anon, authenticated`.
> - „in der gesamten Migrationskette gibt es **kein** `revoke
>   insert/update/delete on public.users from authenticated`" (Detail SB-2/PG-1)
>   → gibt es jetzt, für `users` und rund 130 weitere Tabellen.
> - „`storybook_chat` anon read+write" (RT1/SB-3) → `anon` hat dort seit `0337`
>   gar keine Rechte mehr; die Lese-Policy verlangt eine angemeldete `auth.uid()`.
> - „Default-`authenticated`-Grant ist intakt" / „Kein `revoke create on schema
>   public`" (Verifikationstabelle) → beides widerrufen (`0336`/`0337`), inklusive
>   der Default-Privilegien auf Tabellen und Sequenzen.
> - Das Fazit „alle DB-seitigen Voraussetzungen der Kill-Chain sind erfüllt und
>   bestätigt" gilt nicht mehr.
>
> Der vorgeschlagene **Fix ist genau der umgesetzte** — Details, was bewusst offen
> bleibt (Leseschicht für `authenticated`, zwei anon-lesbare Taxonomie-Tabellen)
> und wie man es nachprüft (`scripts/security/direktpfad-pruefen.sh`), stehen in
> [ARCHITECTURE.md §6.2](ARCHITECTURE.md#62-db-direktpfad-geschlossen-wurzel-6-migrationen-03360339).
> Unverändert **offen** bleiben die Punkte, die diese Migrationen nicht berühren:
> GoTrue-Direktpfad (Captcha/`aal2`), PG-2/PG-3/PG-4 und die Business-Logic-Befunde.

---

## Executive Summary — die eine Kill-Chain, die alles bricht

**Die RLS erzwingt nur die Mandanten-Trennung. Die gesamte Rollen-Trennung (Finanz-Verbot für staff/cleaner, Owner-read-only, Gast-Masking, Rollenvergabe) existiert ausschließlich im FastAPI-Layer — und der ist umgehbar, sobald ein legitimer Low-Priv-Nutzer PostgREST/Realtime direkt mit dem öffentlichen anon-Key anspricht.** [Wahrscheinlich — Code belegt, Live-Test offen]

Angriffskette (niedrigste Rolle → volle Tenant-Übernahme, komplett an der API vorbei):
1. Angreifer wird als **cleaner** eingeladen (niedrigste Rolle) und loggt sich normal ein.
2. Er zieht den **öffentlichen** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` aus dem Web-Bundle (per Design im Client).
3. Er erzeugt sich sein echtes Supabase-JWT direkt bei GoTrue (`POST /auth/v1/token?grant_type=password`) — am App-Rate-Limit und an der 2FA vorbei.
4. `PATCH https://<proj>.supabase.co/rest/v1/users?id=eq.<eigene_uid>` Body `{"role":"admin"}` → die Policy `users_tenant` ist `for all` und prüft nur `tenant_id`, die `role`-Spalte ist ungeschützt → **UPDATE erlaubt** → er ist Admin (SB-2/PG-1).
   - Alternativ ohne Eskalation: `GET /rest/v1/payments|commissions|guests?select=*` → liest **alle** Finanzdaten und ungemaskte Gast-PII des Mandanten (SB-1).

Das ist DB-seitig, bypasst die komplette Autorisierungsarchitektur und ist der Grund, warum die vielen (guten) Service-Layer-Checks allein nicht genügen.

**Zweiter, sofort zu behebender Punkt:** In `.env.example:35-36` ist ein **echtes Login** (deine Gmail + Klartext-Passwort) committet — sofort rotieren.

---

## Kritische Befunde (🔴)

| # | ID | Titel | Beleg | Konfidenz |
|---|----|-------|-------|-----------|
| 1 | SB-2 / PG-1 | Self-Escalation zu `admin` + tenant-weiter Write via direktem PostgREST (Rollen-Split nur in API) | `0008_rls_policies.sql:16-20` `users_tenant for all`; keine DML-`revoke` auf `public.users` | [Wahrscheinlich] |
| 2 | SB-1 | Direkter PostgREST-Read von payments/commissions/guests (Finanz-Verbot §4.3 & Gast-Masking nur im API-Layer) | `0008:28-32,90-102`; Rollen-Scopes `0059/0136/0155` nur `for select`, listen Finanztabellen nicht | [Sicher] (Lesepfad) |
| 3 | INF-1 | Echtes Passwort (Owner-Gmail) im versionierten `.env.example` | `.env.example:35-36` | [Sicher] |
| 4 | AT-2 | E-Mail-Wechsel ohne Re-Auth & ohne Bestätigung an neue Adresse → permanenter Account-Takeover | `auth/account_service.py:146-162` | [Sicher] |
| 5 | AT-1 | App-2FA serverseitig NICHT erzwungen (kein `aal`-Claim-Check) → MFA-Bypass via direktem GoTrue-Login | `core/security.py:72-82`; 2FA nur in `auth/service.py:202-241` | [Sicher] |
| 6 | FE-1 | Unauth. SSRF + Read-Primitive via serverseitigem Chromium-PDF-Render (roher HTML-Input) | `apps/web/app/api/v1/generate-pdf-single/route.ts:19-50` | [Wahrscheinlich] |
| 7 | FE-2 / W-1/W-2 | Page-Builder Stored XSS im Gast-Browser (Regex-Sanitizer via `<svg/onload=>` / unquoted `javascript:` umgehbar) | `builder/lib/sanitize.ts:16-21`; `site_config/schemas.py:143,173` | [Sicher] |
| 8 | OTA-1 / OTA-2 | iCal: unbegrenzte Nächte-Expansion → DB-Write-Flut **und** Head-of-Line, das die ganze Worker-Loop blockiert | `external_calendar/ical.py:24-32`; `worker.py:748` | [Sicher] |
| 9 | Q-1 | Unauth Datums-Span-DoS auf public Booking-Engine (1 Request kippt Worker) | `booking_engine/service.py:443` | [Sicher] |

### Detail zu den Top-3

**SB-2/PG-1 — Privilege-Escalation via PostgREST.** Supabase grantet `authenticated` per Default volles DML auf `public`-Tabellen; in der gesamten Migrationskette gibt es **kein** `revoke insert/update/delete on public.users from authenticated` (nur RPCs und `user_mfa`-Spalten sind revoked). Die Objekt-/Rollen-Scopes (`0059/0136/0155`) sind ausnahmslos `as restrictive for select` — sie greifen bei INSERT/UPDATE/DELETE nicht. Folge: owner (laut §4.2 read-only) kann tenant-weit schreiben; staff/cleaner kann `door_code`/Dossier fremder Objekte überschreiben; jeder kann die eigene `users.role` auf `admin` setzen. **Live-Bestätigung (du hast die DB laufen):**
```bash
# mit gültigem Low-Priv-JWT + anon key gegen die Supabase-REST-URL:
curl -X PATCH "$SUPABASE_URL/rest/v1/users?id=eq.$MY_UID" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $LOWPRIV_JWT" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"role":"admin"}'
# 200 + geänderte Zeile = verwundbar; 401/403/leer = geschützt.
```
**Fix:** `revoke insert,update,delete on public.{users,payments,commissions,guests,…} from authenticated, anon;` (Schreiben/Finanzlesen nur via service_role/FastAPI) und/oder restriktive `for all`-Rollen-Policies. Backstop: `revoke create on schema public from anon, authenticated;`.

**AT-2 — E-Mail-Takeover.** `update_email` ruft `admin.update_user_by_id(..., email_confirm=True)` — setzt jede neue E-Mail **auto-bestätigt, ohne aktuelles Passwort und ohne Opt-in-Mail an die neue Adresse**. Mit bloßem Passwort (oder gestohlener Session) ändert der Angreifer die Login-Mail, sperrt das Opfer aus (es gibt keinen Forgot-Password-Flow zurück). Fix: aktuelles Passwort/TOTP verlangen, `email_confirm` NICHT setzen, Supabase-Doppel-Opt-in nutzen.

**INF-1 — Committed Credential.** `.env.example:35-36` enthält eine echte Gmail + Klartext-Passwort. Sofort: Passwort rotieren, Zeilen entfernen, Git-History bereinigen (BFG/`git filter-repo`).

---

## Hohe/mittlere Befunde (🟡) nach Lane

**Auth/Takeover (RT4)** — AT-3 Credential-Stuffing am App-Limit vorbei (direkter GoTrue-Login, nur Supabase-Attack-Protection greift) · AT-5 Demotion-Lag: entzogene Rolle bleibt bis Token-Ablauf (≤1 h) gültig, weil Guards `ctx.role` aus dem JWT statt DB lesen (`dependencies.py:82-93`) · AT-6 TOTP-Enroll ohne Re-Auth → Angreifer setzt eigenes TOTP als Lockout/Persistenz.

**Payment (RT5)** — PAY-1 Doppel-Refund per Race (kein `idempotency_key`, `payments/service.py:654-705`) · PAY-5 Provisions-Doppel-Invoice (`subscriptions/service.py:572-632`) · PAY-2 Kaution-Capture flippt Reservierung fälschlich auf `paid` (`webhook.py:96-102`) · PAY-3 Dashboard-Refund wird im lokalen Guard nicht gezählt (gespaltener Zustand).

**Postgres/RLS (RT2)** — PG-2 Objekt-Scope-Helper `owner_can_see_property`/`staff_can_see_property` fail-**open** bei unbekannter/fehlender Rolle (`0058:68`, `0136:38-40`) · PG-3 `next_document_number` SECURITY DEFINER mit `search_path=public` statt `''` (nur durch service_role-Grant abgemildert) · PG-4 `reviews` public-read über alle Tenants + Author-Insert ohne Property-Bindung.

**Supabase-Fläche (RT1)** — SB-3 `storybook_chat` anon read+write über PostgREST (`0020:22-34`) · SB-4 public Bucket `property-images`, Schutz nur durch unratbare Namen.

**Business-Logic (RT10)** — BL-1 staff/cleaner umgeht Objekt-Zuweisung: `get_detail`/`complete_task`/Foto-Upload prüfen nur Tenant, nicht `assignee_id` (`tasks/service.py:238,638,700`) — inkonsistent zum korrekten `request_substitution:357` · BL-2 jeder Auth-Nutzer enumeriert alle Kollegen inkl. E-Mail/Rolle/Permissions (`auth/router.py:234` ohne Rollen-Guard).

**OTA/Integration (RT6)** — OTA-3 Cloudflare-Custom-Hostname ohne Ownership-Vorabprüfung → Domain-Squatting + geteilte Zone-Quota-Erschöpfung (`site_config/service.py:148-205`) · OTA-4 ungeprüfte `ota_url` aus OTA-Payload in `reservations.external_url` (`bookings_sync.py:609`) → Stored-XSS zweiter Ordnung · OTA-6 Redirect×Timeout-Zeitamplifikation je Feed.

**Frontend (RT8)** — FE-3 apps/web Policies-Vorschau rendert Owner-HTML ungefiltert (kein Sanitizer in apps/web, `objekte/policies-form.tsx:539`) → rollenübergreifender Stored XSS · FE-4 builder vertraut `x-forwarded-host`.

**Upload (aus MEGA, weiter offen)** — U-1 SVG in public Bucket `company-logos` → Stored XSS · U-2 kein Magic-Byte-Check (Client-`content_type` vertraut).

**Infra (RT7)** — INF-2 Dev-Compose Redis ohne Passwort + Port offen (RediShell CVE-2025-49844) · INF-3 Redis auf floatendem Tag `redis:7-alpine` · INF-4 CI-Actions auf mutable Tags, kein `permissions:`-Block · INF-5 Redis im geteilten coolify-Netz, Passwort als CLI-Arg (`docker inspect`-sichtbar) · INF-6 Supabase-Studio nur Basic-Auth, Default-User `admin` · INF-9 Coolify-Version prüfen (11 kritische CVEs 01/2026, u. a. RCE als root).

**Mobile (RT9)** — MOB-1 Release mit eingechecktem Debug-Keystore signiert (`android/app/build.gradle:103`) · MOB-3 kein TLS-Cert-Pinning (MITM, IP-basierte Prod-URL) · MOB-4 Keychain-Items ohne `THIS_DEVICE_ONLY`/Access-Control (Backup-exfiltrierbar).

---

## Seit letztem Audit geschlossen (verifiziert)
- **SSRF iCal (F-1/F-2/F-3):** jetzt IP-Pinning + Redirect-Revalidierung + Streaming-Cap + CGNAT/IPv4-mapped (`external_calendar/service.py`). Der frühere Rebinding-Befund ist behoben. [Sicher]
- **R-4 totp_secret/recovery_codes:** column-`revoke` in `0155_...:85-86`. [Sicher]
- **R-1/R-2 Lesepfad** (door_code, Dossier): staff/owner-`for select`-Scopes in `0155`. **Aber Schreibpfad bleibt offen → PG-1.** [Sicher]
- **Dependencies:** `pip-audit` live = 0 Findings; alle Pins ≥ Fix-Version (pillow 12.3.0, pydantic-settings 2.14.2, pyjwt 2.13.0, starlette 1.3.1, urllib3 2.7.0, h11 0.16.0). [Sicher]
- **Next.js:** apps/web & builder auf 15.5.19 — über allen 2025/26-CVEs (inkl. CVE-2025-29927 Middleware-Bypass); apps/web hat gar keine auth-entscheidende Middleware. [Sicher]
- **Stripe-Webhook:** fail-closed (leeres Secret 503, HMAC+Timestamp), idempotent → CVE-2026-41432 / CVE-2026-21894 nicht anwendbar. [Sicher]
- **JWT-Guard, Invite/Rollenvergabe, Owner-Statements, Inbox, Guests-Sub-Ressourcen, Reservierungs-Doppel-Guard:** geprüft, sauber. [Sicher]

---

## Sofort-Maßnahmen (Priorität)
1. **INF-1** — committed Passwort rotieren + aus Repo/History entfernen. (Minuten)
2. **SB-1/SB-2/PG-1** — `revoke` DML/SELECT auf sensiblen Tabellen an `authenticated`/`anon` + `revoke create on schema public`; danach Live-`curl`-Test (oben). Das ist der schwerste Befund. (Migration + Verifikation)
3. **AT-2 / AT-1 / AT-6** — E-Mail-Wechsel & TOTP-Enroll re-authentifizieren; App-2FA serverseitig (aal2) erzwingen.
4. **FE-1** — `generate-pdf-single` authentifizieren + Sub-Resource-Loading/interne IPs blocken.
5. **W-1/W-2/FE-2/FE-3** — echten HTML-Sanitizer (DOMPurify/nh3) statt Regex, in builder UND apps/web.
6. **OTA-1/OTA-2/Q-1** — Datums-Span-Cap (z. B. 730 Tage) in iCal, booking-engine, DateRange; iCal-Sync aus der Worker-Run-Loop lösen.

## 12-Monats-Threat-Intel (Auswahl, mit CVE-IDs)
- Supabase Auth OIDC issuer-confusion **CVE-2026-31813** (< 2.185.0) · GoTrue Email-Link-Poisoning **GHSA-3529-5m8x-rpv3** · CVE-2025-48757 (anon-RLS-Leak).
- Postgres RLS incomplete tracking **CVE-2024-10976** · PostgREST db-pre-request Priv-Esc **CVE-2022-35912** · SECURITY-DEFINER search_path-Hijack.
- pyjwt alg-confusion **CVE-2026-48526** / jku-SSRF **CVE-2026-32597** (beide < 2.13.0, gefixt) · starlette **CVE-2026-54283** (gefixt) · python-multipart **CVE-2026-53539** (gefixt) · pillow decompression **CVE-2026-55379 ff.** (gefixt) · urllib3 **CVE-2026-44431/44432** (gefixt) · h11 smuggling **CVE-2025-43859** (gefixt).
- Stripe empty-secret bypass **CVE-2026-41432** / missing-sig **CVE-2026-21894** (nicht anwendbar, fail-closed).
- SSRF DNS-Rebinding **CVE-2026-27826** (Muster, iCal jetzt gepinnt) · Cloudflare SSL-for-SaaS v1 Disclosure (08/2025).
- Next.js Middleware-Bypass **CVE-2025-29927**, RSC-RCE **CVE-2025-55182/66478** (nicht betroffen, 15.5.19).
- Redis „RediShell" **CVE-2025-49844** (RCE) · Coolify 11 CVEs **CVE-2025-66209…213/64420/64421** (01/2026) · GitHub-Actions tj-actions supply-chain (03/2025).
- React Native Metro **CVE-2025-11953** (nicht betroffen, cli 20.1.0).

*(Vollständige Quell-URLs je Lane liegen in den Agenten-Rohbefunden; zentrale Referenzen: OWASP API Top 10 2023/2025 A01, Supabase Security Retro 2025, Stripe Webhook Security Guide, ProjectDiscovery CVE-2025-29927, Wiz RediShell, TheHackerNews Coolify.)*

---

## Grenzen (ehrlich)
- Alles statisch. Die schärfsten Befunde (SB-1/SB-2/PG-1) hängen daran, dass PostgREST/Realtime für Clients erreichbar ist (bei eurem Setup über Kong sehr wahrscheinlich) und dass der Default-`authenticated`-Grant intakt ist (in Migrationen nicht widerrufen → wahrscheinlich). **Bitte mit dem `curl` oben live bestätigen** — du hast Backend/DB laufen; meine Sandbox erreicht deinen localhost nicht.
- Coolify-Version, Studio-Exposition und Reverse-Proxy-Header-Verhalten (FE-1/FE-4) sind Deployment-Fakten außerhalb des Repos.

---

## Live-Verifikation Staging (2026-07-16)

**Ziel:** `supabase-kong.65.21.144.136.sslip.io` (Supabase/Kong) · `nextdays-api.65.21.144.136.sslip.io` (FastAPI) — der **Staging-Server** (65.21.144.136). Read-only. Das Cloud-Projekt `kfzcllntmizpdxcojpmd` (Root-`.env`) wurde bewusst NICHT angefasst.
**Skript:** `scripts/security/redteam-verify.sh`. Der volle Lauf konnte **nicht** ausgeführt werden, weil kein Low-Priv-Testkonto (staff/cleaner) mit Passwort in irgendeiner env/Doku hinterlegt ist und laut Auftrag keins angelegt werden durfte. Die kontolos prüfbaren Punkte wurden dennoch statisch + halb-live verifiziert.

| Befund | Ergebnis | Beleg (HTTP/Datei) |
|---|---|---|
| **INF-1** committed Credential | **BESTÄTIGT** | `.env.example` enthält echte Gmail + Klartext-Passwort für den Storybook-Vercel-Login. → rotieren + History bereinigen. |
| **A8** `/docs` `/openapi.json` `/redoc` offen | **BESTÄTIGT** | Alle drei liefern auf der Staging-API **HTTP 200** (öffentlich, unauth). |
| **SB-1/SB-2/PG-1** DML-Grant intakt | **BESTÄTIGT (Grant-Seite)** | Kein `revoke insert/update/delete on public.<tabelle>` und kein `revoke create on schema public` in `supabase/migrations/**` — alle Revokes betreffen nur RPC-Funktionen. Default-`authenticated`-DML auf `users/payments/commissions/guests` ist intakt. |
| **SB-2** Policy-Seite | **BESTÄTIGT (Policy)** | `users_tenant` (`0008_rls_policies.sql:17-20`) ist `for all` und prüft nur `tenant_id` (using+with check); die `role`-Spalte ist in keiner Policy geschützt → `PATCH {"role":"admin"}` im eigenen Tenant würde die Policy passieren. |
| **PostgREST/GoTrue über Kong erreichbar** | **BESTÄTIGT** | `/rest/v1/` ohne apikey → **HTTP 401** „No API key found" (nicht refused); `/auth/v1/health` → 401. Client-Pfad zur DB ist offen — Voraussetzung für die Kill-Chain erfüllt. |
| **anon-only (ohne JWT)** | **geschützt** | `users`/`payments`/`guests` nur mit anon-Key (ohne JWT) → HTTP 200, **`[]`** (RLS greift, `current_tenant_id()` leer). |
| **SB-1 Read mit Low-Priv-JWT** (payments/commissions/guests) | **OFFEN — nicht getestet** | kein Low-Priv-Testkonto vorhanden. Der entscheidende Schritt (JWT setzt `current_tenant_id()`, dann `select=*` gegen Finanz-/Gasttabellen) konnte NICHT gefahren werden. |
| **SB-2 destruktiv** (Rollen-PATCH mit Auto-Revert) | **NICHT ausgeführt** | Bewusst nicht gefahren (DESTRUCTIVE=1, braucht Wegwerf-Konto + separate Freigabe). |
| **FE-1** unauth SSRF PDF-Render | **NICHT getestet** | kein `WEB_BASE` (öffentliche apps/web-Staging-URL) und kein `SSRF_CALLBACK` bereitgestellt. |

**Fazit:** Alle DB-/Deployment-seitigen Voraussetzungen der Haupt-Kill-Chain (SB-1/SB-2/PG-1) sind auf Staging **erfüllt und bestätigt** — offener DML-Grant, `for all`-Policy nur auf `tenant_id`, PostgREST via Kong erreichbar, anon-Key öffentlich. Es fehlt nur der letzte Live-Beweis mit einem Low-Priv-JWT, weil kein Testkonto vorlag. INF-1 und A8 sind vollständig bestätigt.
