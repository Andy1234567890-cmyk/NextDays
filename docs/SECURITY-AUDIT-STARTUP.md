# Startup-Mega-Audit — „Sind wir gegen die 5 häufigsten Angriffe geschützt?"

**Datum:** 2026-07-16 · **Kontext:** Bewertung gegen die 5 vom Gründer genannten Angriffsklassen, aus Startup-Sicht (begrenztes Budget → Fokus auf kostenlose/config-basierte, hochwirksame Maßnahmen).
**Grundlage:** Audit 1/2, Mega-Audit, Red-Team (10 Domänen) + Verifikation des aktuellen Code-Stands am 2026-07-16.
> ### ⚠ Stand 2026-08-08: die kritische DB-Grant-Lücke ist GESCHLOSSEN
>
> Dieser Bericht ist eine **Momentaufnahme vom 2026-07-16**. Der als „schwerster
> offener Punkt der ganzen Auditreihe" bezeichnete Befund **SB-1/SB-2/PG-1**
> (PostgREST-Rollen-Bypass) ist mit den Migrationen `0336`,
> `0337_direktpfad_sensible_tabellen_schliessen` und `0339` behoben — genau so,
> wie unter „Sofort-Paket" vorgeschlagen. Überholt sind damit: die Statuszeile
> „noch OFFEN", die Aussage „es gibt **kein** `revoke insert/update/delete` auf
> `{users,payments,commissions,guests}`", die Ampel „🟠 gemischt — PostgREST-
> Rollen-Bypass offen (kritisch)" in Klasse 3 sowie die Zusammenfassung „(a) eine
> kritische DB-Grant-Lücke". Was bewusst offen bleibt und wie man es nachprüft:
> [ARCHITECTURE.md §6.2](ARCHITECTURE.md#62-db-direktpfad-geschlossen-wurzel-6-migrationen-03360339)
> und `scripts/security/direktpfad-pruefen.sh`.
>
> **Weiterhin offen** (von diesen Migrationen nicht berührt): GoTrue-Direktpfad
> (Captcha/Leaked-Password/`aal2`), DDoS/WAF-Schicht, Supply-Chain/CI-Pinning.

**Ehrliche Vorbemerkung:** Von den 5 Klassen kann eine Plattform 3 technisch adressieren (Stuffing/Brute-Force, Software-Schwachstellen, DDoS). Phishing/Social-Engineering und Malware/Supply-Chain sind überwiegend Prozess-/Menschen-Themen — Code kann dort nur den **Schaden begrenzen**.

---

## Ampel-Übersicht

| # | Angriffsklasse | Schutzstatus | Kernlücke |
|---|----------------|--------------|-----------|
| 1 | Phishing & Social Engineering | 🟡 teilweise | MFA nicht serverseitig erzwungen; E-Mail-Wechsel ohne Re-Auth |
| 2 | Credential Stuffing & Brute Force | 🟡 teilweise | App-Ratelimit vorhanden, aber direkt-GoTrue umgehbar; kein Captcha/Leaked-PW; MFA optional |
| 3 | Software-Schwachstellen-Ausnutzung | 🟢 gehärtet (seit 08.08.) | PostgREST-Rollen-Bypass mit `0336`/`0337`/`0339` geschlossen; Rest wie unten |
| 4 | DDoS | 🔴 Lücke | Nur App-Ratelimit; keine bestätigte Netzwerk-/WAF-Schicht (Cloudflare) |
| 5 | Malware & infizierte Updates (Supply-Chain) | 🟡 teilweise | CI-Actions ungepinnt; committed Credential; Mobile-Debug-Keystore |

**Gesamtbild:** Der App-Code ist nach den letzten Runden überdurchschnittlich sauber. Die Rest-Risiken lagen (a) in **einer** kritischen DB-Grant-Lücke — seit 2026-08-08 geschlossen, s. Banner —, (b) im **Auth-Flow** (MFA/Takeover) und (c) an den **Rändern** (Netzwerk-DDoS, Supply-Chain) — dort, wo Startups typischerweise nichts stehen haben. Alle Sofort-Maßnahmen unten sind kostenlos oder Config.

---

## 1. Phishing & Social Engineering — 🟡

**Was uns schützt:** Bearer-Token-Auth, kein Cookie-CSRF; Rollen-/Rechtevergabe serverseitig geklemmt (kein Self-Escalation über die API); Gast-Masking; JWT-Härtung (alg-Allowlist, aud).

**Lücken (aus Red-Team):**
- **AT-1 [Sicher, offen]** — App-2FA wird serverseitig **nicht** erzwungen (kein `aal`-Claim-Check in `core/security.py`). Wer per gephishtem Passwort direkt bei GoTrue einloggt, wird nie nach TOTP gefragt → „2FA an" schützt das Konto faktisch nicht.
- **AT-2 [Sicher, offen]** — E-Mail-Wechsel (`auth/account_service.py:146-162`) ohne aktuelles Passwort/TOTP und ohne Bestätigung an die neue Adresse → nach Phishing-Passwort permanenter Account-Takeover.
- Kein Onboarding-/Awareness-Prozess dokumentiert (Team fällt auf gefälschte Login-Mails herein).

**Startup-Maßnahmen (kostenlos):**
1. MFA serverseitig erzwingen (Supabase-native MFA → GoTrue verlangt `aal2`), statt Custom-pyotp nur in der App.
2. E-Mail-Wechsel & TOTP-Enroll re-authentifizieren (Passwort/TOTP), Doppel-Opt-in an die neue Adresse.
3. Team: Passwort-Manager-Pflicht + Hardware/TOTP-2FA für alle Admin-Konten; interne Regel „wir fragen NIE per Mail nach Passwörtern".

## 2. Credential Stuffing & Brute Force — 🟡

**Was uns schützt:** App-Ratelimit **10/60/IP** auf `/auth/login|register|refresh` (`ratelimit_middleware.py`), Redis-backed; Passwort-Hashing via Supabase/GoTrue.

**Lücken:**
- **AT-3 [Wahrscheinlich, offen]** — Das App-Ratelimit greift nur auf der FastAPI-Route. Der **direkte GoTrue-Login** (`/auth/v1/token`, mit dem öffentlichen anon-Key) läuft daran vorbei — dort gilt nur Supabases eigenes, lockeres Limit.
- **Kein Captcha / kein Leaked-Password-Check** (verifiziert: keine Turnstile/hCaptcha/HIBP-Integration).
- MFA optional (siehe AT-1) → ein Treffer aus einem Leak genügt.

**Startup-Maßnahmen (kostenlos/Config):**
1. Supabase **Attack Protection** aktivieren (Dashboard): Captcha (Cloudflare Turnstile, gratis) am GoTrue-Login + Leaked-Password-Protection (HIBP) — schließt AT-3 an der richtigen Stelle.
2. MFA für Admin/Agentur-Rollen verpflichtend.
3. Rate-Limit-Alarm: Log-Alert bei >N fehlgeschlagenen Logins/Zeit.

## 3. Software-Schwachstellen-Ausnutzung — 🟠 (eine kritische Lücke offen)

**Was uns schützt (viel gehärtet):** Dependencies `pip-audit`-sauber (alle Pins ≥ Fix-Version); Next.js 15.5.19 (über allen 2025/26-CVEs, inkl. Middleware-Bypass CVE-2025-29927); Stripe-Webhook fail-closed + idempotent; SSRF-iCal mit IP-Pinning; Injection sauber (parametrisiert); XSS im Page-Builder serverseitig via `nh3` sanitisiert; Payment-Races idempotent; RLS explizit verankert (Migration 0154).

**Kritische Lücke — seit 2026-08-08 GESCHLOSSEN (`0336`/`0337`/`0339`), der Befund von damals:**
- **SB-1/SB-2/PG-1 [Wahrscheinlich, offen — verifiziert: kein DML-`revoke`]** — Die RLS erzwingt nur **Mandanten**-Trennung. `authenticated` hat per Supabase-Default volles DML auf `public`-Tabellen; es gibt **kein** `revoke insert/update/delete on public.{users,payments,commissions,guests}`. Ein Low-Priv-Nutzer (cleaner) kann mit seinem echten JWT + anon-Key **direkt PostgREST** ansprechen und (a) alle Finanzdaten/Gast-PII lesen, (b) via `PATCH users role=admin` sich selbst zum Admin machen. Die gesamte Rollen-Trennung lebt nur im FastAPI-Layer und wird DB-seitig umgangen. **Das war der schwerste offene Punkt der ganzen Auditreihe — behoben mit `0336`/`0337`/`0339`.**
  - *Der R-4-Fix (0155) hat genau diese Erkenntnis für `user_mfa` schon dokumentiert („column-REVOKE greift nicht, solange das pauschale Tabellen-GRANT besteht") — sie muss nur auf die sensiblen Tabellen verallgemeinert werden.*

**Weitere offene 🟡 (Red-Team):** FE-1 (unauth PDF-Render → SSRF, `apps/web/.../generate-pdf-single`), BL-1 (staff umgeht Task-Assignee-Scope), BL-2 (User-Enumeration), PG-2 (Objekt-Scope-Helper fail-open), U-2 (kein Magic-Byte-Check).

**Startup-Maßnahmen:**
1. ~~**Sofort:** Härtungs-Migration `revoke insert,update,delete on public.{users,payments,commissions,guests,…} from authenticated,anon;` + `revoke create on schema public from anon,authenticated;` + restriktive Rollen-Policies.~~ **Erledigt** mit `0336`/`0337`/`0339`.
2. FE-1 authentifizieren + interne IPs/Sub-Resources im PDF-Render blocken.
3. `pip-audit` + `npm audit` in CI als Gate (kostenlos, verhindert Rückfall).

## 4. DDoS — 🔴 (Netzwerk-Schicht fehlt)

**Was uns schützt:** App-seitiges Redis-Ratelimit (fair pro IP/Bucket); Span-Cap gegen Query-Amplifikation (Q-1 gefixt).

**Lücken:**
- **Keine bestätigte Netzwerk-/Edge-Schutzschicht** (Cloudflare/WAF) vor Traefik/Coolify verifizierbar. App-Ratelimit stoppt L7-Fluten erst **nachdem** sie den Server erreichen — echte volumetrische DDoS (L3/L4) oder verteilte L7-Fluten laufen darüber.
- **OTA-2 [Sicher]** — ein einzelner langsamer iCal-Feed blockiert die Worker-Loop (Head-of-Line) → „DoS von innen".

**Startup-Maßnahmen (kostenlos/günstig):**
1. **Cloudflare Free/Pro** vor die Domains: L3/L4-DDoS-Schutz gratis, WAF-Basisregeln, Bot-Fight, Rate-Limiting-Rules — der mit Abstand größte Hebel für kleines Geld. (Ihr nutzt Cloudflare bereits für Custom-Hostnames — nur konsequent davorschalten.)
2. Traefik-Rate-Limit-Middleware als zweite Schicht.
3. OTA-2: iCal-Sync aus der Worker-Run-Loop in den Job-Pool lösen (Zeitbudget je Tick).

## 5. Malware & infizierte Updates (Supply-Chain) — 🟡

**Was uns schützt:** `uv.lock`/`pnpm-lock` pinnen Versionen; Prod-Container non-root; keine Docker-Socket-Mounts; CI-Trigger `pull_request` (kein pwn-request).

**Lücken (Red-Team/Infra):**
- **INF-1 [Sicher, offen — verifiziert]** — echtes Login (Gründer-Gmail + Klartext-Passwort) in `.env.example:35-36` committet. Sofort rotieren + aus History löschen.
- **INF-4** — CI-Actions auf mutable Tags (`@v4`/`@v5`), kein `permissions:`-Block → tj-actions-artiger Supply-Chain-Angriff könnte `COOLIFY_TOKEN` exfiltrieren.
- **INF-3/INF-2** — Redis auf floatendem Tag `redis:7-alpine` (RediShell CVE-2025-49844); Dev-Compose-Redis ohne Passwort.
- **MOB-1** — Mobile-Release mit eingechecktem Debug-Keystore signiert (kein Integritätsanker für Updates).
- **INF-9** — Coolify-Version prüfen (11 kritische CVEs 01/2026, u. a. RCE als root).

**Startup-Maßnahmen (kostenlos):**
1. Credential rotieren + `.env.example` säubern + `git filter-repo`. (Minuten)
2. CI: Actions per Commit-SHA pinnen, `permissions: contents: read` setzen, `secret-scanning`/`dependabot` (GitHub gratis) aktivieren.
3. Redis-Image auf gepatchten Digest pinnen; Coolify auf aktuelle Version.
4. Eigener Release-Keystore (Secrets in CI), nicht im Repo.

---

## Sofort-Paket (heute, alles kostenlos — größter Schutz pro Aufwand)
1. **INF-1** — committed Passwort rotieren + entfernen. *(Minuten)*
2. ~~**SB-1/SB-2/PG-1** — `revoke`-Härtungs-Migration (PostgREST-Rollen-Bypass schließen).~~ **Erledigt** (`0336`/`0337`/`0339`).
3. **Supabase Attack Protection** — Captcha + Leaked-Password + MFA-Enforcement im Dashboard. *(Config)*
4. **Cloudflare** vor die Domains — DDoS/WAF/Bot. *(Config)*
5. **CI härten** — Actions SHA-pinnen, `permissions`, Dependabot/Secret-Scanning an. *(Config)*

## Was solide ist (nicht nur Behauptung — verifiziert)
Dependencies, Next.js-Version, Stripe-Webhook, SSRF-iCal, Injection, Page-Builder-XSS (serverseitig `nh3`), Payment-Idempotenz, RLS-Aktivierung, Rollenvergabe-Klemmung, Mobile-Token-Storage (Keychain), Realtime-`setAuth`. Die letzten Audit-Runden haben real gewirkt.

## Grenzen (ehrlich)
- Statische Analyse. SB-1/SB-2 sind live in Minuten bestätigbar (`scripts/security/redteam-verify.sh`).
- DDoS-Resilienz und WAF sind Deployment-/Edge-Themen außerhalb des Repos — Bewertung anhand fehlender Config, nicht anhand eines Lasttests.
- Phishing/Malware-Schutz hängt am Team-Prozess (2FA-Pflicht, Passwort-Manager, Update-Disziplin), nicht nur am Code.
