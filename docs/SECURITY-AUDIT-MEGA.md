# Mega-Security-Audit — NextDays (10 parallele Domänen-Auditoren)

**Datum:** 2026-07-16
**Methode:** 10 parallele, disjunkte Domänen-Audits (statische Code-Analyse + Web-Recherche zum aktuellen Bedrohungsstand). Read-only, keine Live-Exploits.
**Scope:** `apps/api` (FastAPI), `apps/web`, `builder` (Page-Builder), `mobile`, `supabase/migrations`.
**Abgrenzung:** Baut auf Audit 1 (`SECURITY-AUDIT-AUTH.md`) und Audit 2 (`SECURITY-AUDIT-2.md`) auf. Bereits behobene Punkte (RLS-Migration 0154, JWT-Alg-Allowlist, `/docs`-Prod-Deaktivierung, Dependency-CVEs, SSRF-Basisguard) sind hier **nicht** erneut gelistet — außer wo ein Restrisiko fortbesteht.
**Markierung:** [Sicher] = im Code verifiziert · [Wahrscheinlich] = starke Indizien · [Vermutung] = nicht abschließend verifizierbar.

---

## Prioritätsübersicht (nur 🔴 kritisch + 🟡 mittel)

| # | ID | Schweregrad | Titel | Ort |
|---|----|-------------|-------|-----|
| 1 | R-1 | 🔴 | Türcodes (`property_guest_portal`) tenant-weit sichtbar für staff/cleaner/owner | `0121_property_guest_portal.sql:44-53` |
| 2 | R-2 | 🔴 | Objektkartei (8 Dossier-Tabellen): Owner-Scope ja, **Staff-Scope fehlt** | `0128_property_dossier_rls.sql` + `0136_staff_property_rls.sql` |
| 3 | Q-1 | 🔴 | Unbegrenzter Datums-Span auf **public** Booking-Engine → unauth DoS (1 Request kippt Worker) | `booking_engine/service.py:443` |
| 4 | F-1 | 🔴 | DNS-Rebinding-TOCTOU im iCal-Fetch (SSRF-Guard umgehbar, IP-Pinning fehlt) | `external_calendar/service.py:235-238` |
| 5 | W-1 | 🔴 | Rich-Text-Regex-Sanitizer umgehbar → Stored XSS im Gast-Browser | `builder/lib/sanitize.ts:8-23` |
| 6 | W-2 | 🔴 | `href`/`cta_href` ohne Schema-Prüfung → `javascript:`-Stored-XSS | `site_config/schemas.py:143,173` |
| 7 | R-4 | 🟡→🔴 | `user_mfa`-SELECT gibt `totp_secret`+`recovery_codes` an Row-Owner (2FA-Bypass bei Session-Diebstahl) | `0021_user_mfa_totp.sql:31-34` |
| 8 | P-1 | 🟡 | Refund nicht idempotent → Doppel-Erstattung bei Doppelklick/Retry | `payments/service.py:654-705` |
| 9 | P-2 | 🟡 | `bill_pending_commissions` nicht nebenläufigkeitssicher → Doppel-Fakturierung | `subscriptions/service.py:572-632` |
| 10 | R-5 | 🟡 | Owner-/Staff-Objekt-Scope filtert nur SELECT; Schreibpfad tenant-weit offen | `0059_owner_property_rls.sql:52`, `0136:88` |
| 11 | R-3 | 🟡 | `external_calendar`-Feed-URLs (Secret-Tokens) ohne Owner/Staff-Scope | `0119_external_calendar.sql:64-82` |
| 12 | U-1 | 🟡 | SVG-Upload in **public** Bucket `company-logos` → Stored XSS | `buchhaltung/service.py:1113-1136` |
| 13 | U-2 | 🟡 | Kein Magic-Byte-Check; Upload vertraut Client-`content_type` | mehrere Upload-Services |
| 14 | D-1 | 🟡 | `create_connect_account` nimmt `tenant_id` aus dem Body statt `ctx` | `payments/service.py:286-316` |
| 15 | I-1 | 🟡 | PostgREST-Filter-Injection über `.or_()` im Gäste-Suchbegriff (tenant-gescoped) | `guests/service.py:128-132` |
| 16 | S-1 | 🟡 | E-Mail (PII) im Klartext-Log bei Auth-Fehlern (DSGVO/CWE-532) | `auth/service.py:251,493` |
| 17 | S-2 | 🟡 | Gast-Telefonnummer im Klartext-Log | `whatsapp/service.py:426` |
| 18 | S-3 | 🟡 | Rohe Exception-Strings an Client (Diagnostics, billing-gated) | `payments/service.py:162,177,191` |
| 19 | F-2 | 🟡 | 5-MB-iCal-Deckel greift erst nach Download → Memory-DoS | `external_calendar/service.py:249` |
| 20 | F-3 | 🟡 | SSRF-Blocklist ohne CGNAT `100.64/10` und IPv4-mapped-IPv6 | `external_calendar/service.py:42-51` |
| 21 | U-3 | 🟡 | Bucket `avatars` ohne Migration (Config-Drift, keine MIME-/Größenlimits) | `auth/account_service.py:519,556` |
| 22 | Q-2 | 🟡 | Unbegrenzter Span auch auf authentifizierten Read-Endpunkten | `calendar/schemas.py:27` u. a. |
| 23 | Q-3 | 🟡 | `/calendar/board`: Amplifikation Objekte × Tage (500 × Mio) | `calendar/router.py:72` |
| 24 | Q-4 | 🟡 | `/pricing/explain` LLM-Call nur im großzügigen default-Bucket → Kosten-DoS | `pricing/router.py:176-252` |
| 25 | Q-5 | 🟡 | Teure Report-Endpunkte (owner_statements) im default-Bucket | `owner_statements/router.py:55,67` |
| 26 | W-3 | 🟡 | Page-Builder ohne CSP/Security-Header (keine XSS-Defense-in-Depth) | `builder/next.config.ts:5-8` |
| 27 | M-1 | 🟡 | Android-Release mit eingechecktem Debug-Keystore signiert | `android/app/build.gradle:100-103` |
| 28 | M-2 | 🟡 | Hardcodiertes `€`-Symbol in Mobile-Screens (Wurzel 4) | `screens/Checkout.tsx:73-98` u. a. |

**Grün/Randnotiz (verifiziert, kein akuter Handlungsbedarf):** I-2…I-7, D-2, P-3…P-6, U-4, R-6, R-7, S-4…S-6, Q-6, M-3, M-4, W-4…W-7 — siehe Domänen-Abschnitte.

---

## Kritische Befunde (🔴) im Detail

### R-1 — Türcodes tenant-weit sichtbar [Sicher]
`property_guest_portal` (0121) enthält `door_code`, `show_code_only_if_paid`, `maintenance_phone` und hat **nur** die tenant-weite `for all`-Policy; die Tabelle ist in `supabase_realtime` publiziert. Damit lesen/abonnieren **staff, cleaner und owner** desselben Tenants die Türcodes **aller** Objekte — §4.2/§4.3-Verstoß, exakt das PostgREST/Realtime-Angriffsmuster.
**Fix:** `as restrictive for select`-Policies `owner_can_see_property(property_id)` + `staff_can_see_property(property_id)` ergänzen (Muster wie 0136/0140).

### R-2 — Objektkartei ohne Staff-Scope [Sicher]
`0128_property_dossier_rls.sql` legt nur `*_owner_scope` an; die Staff-Tabellenliste in `0136` enthält die 8 Dossier-Tabellen (`property_access`, `property_emergency_authority`, `property_tradespeople`, …) **nicht**. Asymmetrie: owner gefiltert, staff/cleaner sehen/abonnieren Zugangsdaten, Notfallvollmachten, Handwerker aller Objekte.
**Fix:** die 8 Dossier-Tabellen in die `0136`-`tables[]`-Schleife aufnehmen.

### Q-1 — Unauth DoS über Datums-Span [Sicher]
`booking_engine/service.py:443` (`public_availability`, **kein JWT**) nimmt rohe `start`/`end` ohne Obergrenze; `resolver.py:60` baut einen Tag-für-Tag-Loop. `?start=2000-01-01&end=9999-12-31` → ~2,9 Mio Objekte gebaut + serialisiert → ein einziger Request kippt den Worker. Der Listings-Bucket (240/60/IP) hilft nicht (1 Request reicht). Gleiches Muster in `list_listings`/`listing_detail`.
**Fix:** `end - start ≤ MAX_SPAN` (z. B. 730 Tage) serverseitig → 422.

### F-1 — DNS-Rebinding im iCal-Fetch [Sicher, dass Mitigation fehlt]
`_assert_public_url` (Zeile 54) löst den Host per `getaddrinfo` auf und prüft die IP — danach verbindet `_fetch` mit `client.get(current, …)` über **denselben Hostnamen** (Zeile 235-238) und löst DNS bei Connect **erneut** auf. Angreifer mit kurzer TTL: Prüfung sieht öffentliche IP (pass), Fetch trifft `127.0.0.1`/`169.254.169.254`/RFC-1918. Der Docstring (Z. 61) verweist auf IP-Pinning „`_resolve_public`" — **diese Funktion existiert nicht** (per grep bestätigt). Gilt auch je Redirect-Hop.
**Fix:** geprüfte IP pinnen — Host einmal auflösen, IP direkt anfragen mit `headers={"Host": host}` + SNI, oder httpx-Transport mit fixiertem Resolver. Hostname nach Validierung nicht erneut auflösen.

### W-1 — Rich-Text-Sanitizer umgehbar → Stored XSS [Sicher]
`builder/lib/sanitize.ts:8-23` ist ein handgeschriebener Regex und die **einzige** Verteidigung für `dangerouslySetInnerHTML` (`rich-text.tsx:14,28`). Umgehungen: unquotiertes `<a href=javascript:alert(1)>`; `<img src=x/onerror=alert(1)>` (Slash statt Whitespace); `jav&#9;ascript:` (Browser normalisiert, Regex nicht). Inhalt kommt aus dem Agentur-Dashboard und läuft im Browser des buchenden **Gastes**.
**Fix:** serverseitig beim Speichern mit echtem Sanitizer (DOMPurify/`nh3`/`bleach`, Allowlist), nicht per Regex im Renderer.

### W-2 — `href`/`cta_href` ohne Schema-Prüfung [Wahrscheinlich]
`ButtonContent.href` / `HeroContent.cta_href` (`site_config/schemas.py:143,173`) sind ungeprüftes `str`; React rendert `<a href={href}>` ohne `javascript:`-Blockade. Agentur kann `href:"javascript:…"` speichern → Skriptausführung beim Gast-Klick.
**Fix:** `field_validator` auf href/cta_href/url — nur `http(s):`/`mailto:`/relative Pfade, sonst 422.

---

## Hohe/mittlere Befunde (🟡) nach Domäne

**Auth/MFA & Tenant-Isolation (Agent 7)**
- **R-4** `user_mfa`-SELECT (`using (user_id = auth.uid())`) liefert dem Row-Owner die **ganze** Zeile inkl. Klartext-`totp_secret` + `recovery_codes`; RLS ist row-, nicht column-level. Kompromittierte Session kann 2FA abziehen → **Eskalation auf 🔴** in dieser Konstellation. Fix: `revoke select (totp_secret, recovery_codes) … from authenticated` bzw. Status-View. [Sicher]
- **R-5** Owner-/Staff-Objekt-Scope-Policies sind `for select`; die permissiven Tenant-Policies bleiben `for all` → per anon-key + gültigem Staff-JWT (PostgREST) sind INSERT/UPDATE/DELETE auf nicht zugewiesene Objekte im Tenant DB-seitig ungeschützt (nur Service-Layer greift). Fix: restrictive `for all`-Scope-Policies. [Wahrscheinlich]
- **R-3** `external_calendar`-Feed-URLs (oft mit Secret-Tokens) nur tenant-scoped, realtime-published → Objekt-Feeds tenant-weit lesbar. Fix: restrictive owner/staff-SELECT-Policy. [Wahrscheinlich]

**Payment-Integrität (Agent 4)**
- **P-1** Refund-Doppel-Guard wird vor dem Stripe-Call geprüft, `refunds.create` erhält **keinen** `idempotency_key` → zwei nebenläufige Refunds buchen 2×. Fix: deterministischer `idempotency_key=refund:{payment_id}:{amount}` + status/DB-Claim vor Stripe. [Wahrscheinlich]
- **P-2** `bill_pending_commissions` liest pending → `invoice_items.create` (ohne idempotency) → danach `invoiced`; manueller Endpoint + Worker parallel → Doppel-Belastung. Fix: `idempotency_key=comm:{tenant}:{period}` + atomarer Claim. [Wahrscheinlich]
- Grün: P-3 (Refund-Accounting-Drift, konservativ), P-4 (Betrag nicht `>0`-validiert, Stripe fängt), P-5 (Owner-Preview-Override nur Anzeige), P-6 (public Intent-Erzeugung per UUID).

**Injection & Query-Bau (Agent 1)**
- **I-1** `guests/service.py:128-132`: `q` roh in PostgREST-`or`-Grammatik (`name.ilike.%{q}%,…`) → Filter-/Spalten-Injection innerhalb des Tenants (Cross-Tenant durch vorgeschaltetes `.eq("tenant_id")` blockiert). Fix: `q` von PostgREST-Metazeichen + LIKE-Wildcards escapen (`_like_escape` existiert bereits in `identity.py:149`). [Sicher]
- Grün: kein SQLi/`text()`/Cursor, kein `subprocess`/`eval`/`shell=True`, kein Path-Traversal; `.rpc()` durchgängig parametrisiert.

**Secrets/PII/Logging (Agent 3)**
- **S-1** E-Mail im Klartext in Prod-Logs (`auth/service.py:251,493`, `account_service.py:153`); `core/logging.py` ohne Redaction. Fix: maskieren/hashen. [Sicher]
- **S-2** Gast-Telefon im Log (`whatsapp/service.py:426`). Fix: maskieren. [Sicher]
- **S-3** Rohe Exception-Strings in `payments`-Diagnostics an Client (billing-gated). Fix: statische Meldung, `exc` nur serverseitig. [Wahrscheinlich]
- Grün: `.env` gitignored, keine echten Secrets im Repo, kein `debug=True`, kein globaler Stacktrace-Handler; S-4/S-5/S-6 gering.

**SSRF/Outbound (Agent 5)**
- **F-2** `resp.content[:5MB]` schneidet erst **nach** vollem Download (httpx nicht-streaming) → Multi-GB-Antwort erschöpft Speicher. Fix: `client.stream()` + Abbruch bei Limit. [Sicher]
- **F-3** Blocklist ohne `100.64.0.0/10` (CGNAT) und IPv4-mapped-IPv6 (`::ffff:169.254.169.254`). Fix: `ip.ipv4_mapped` entpacken + CGNAT ablehnen. [Vermutung]
- Grün: alle übrigen 10 Outbound-Calls haben feste Hosts; WhatsApp-Webhook HMAC fail-closed, lädt keine Medien.

**Upload/Media (Agent 6)**
- **U-1** SVG in **public** Bucket `company-logos` (`buchhaltung/service.py:1113`, Bucket `0067`, Frontend `konto/page.tsx:318`) → Stored XSS bei Direktaufruf/`<object>`-Rendering; Logo wird Gästen gezeigt. Fix: SVG aus MIME-Allowlists entfernen oder serverseitig sanitizen + `Content-Disposition: attachment`. [Sicher/Wahrscheinlich]
- **U-2** Nur Client-`content_type` geprüft, keine Magic-Bytes (properties/tasks/addons/auth/buchhaltung/travel_agencies, `core/uploads.py:38`). Fix: Magic-Number-Check, sonst 415. [Sicher]
- **U-3** Bucket `avatars` ohne Migration → keine Storage-MIME/Größen-Whitelist, Config-Drift. Fix: idempotente Bucket-Migration nachziehen. [Sicher/Vermutung]
- Grün: OCR ist Stub, keine Bildbibliothek (kein Decompression-Bomb-Vektor), E-Invoice-XML nicht serverseitig geparst (kein XXE), Signed-URLs tenant-gescoped, kein Path-Traversal.

**DoS/Rate-Limit (Agent 8)**
- **Q-2/Q-3** Unbegrenzter Datums-Span auf authentifizierten Endpunkten (`calendar`, `pricing/effective`, `public_portal`, `reservations` stats) + `/calendar/board`-Amplifikation (≤500 Objekte × Mio Tage). Fix: Max-Span-Validator zentral in `DateRange`. [Sicher]
- **Q-4** `/pricing/explain` löst kostenpflichtigen Groq-LLM-Call im default-Bucket aus → Kosten-DoS. Fix: eigener strenger `ai`-Bucket. [Wahrscheinlich]
- **Q-5** Teure Report-/Aggregations-Endpunkte (`owner_statements/preview`, `fetch_all_rows` ohne Cap) im default-Bucket. Fix: strengerer Bucket. [Wahrscheinlich]
- Grün: Q-6 (kein globales JSON-Body-Limit, Traefik ggf. vorgelagert), **kein ReDoS** (alle Regex linear/verankert).

**Mobile (Agent 9)**
- **M-1** Release wird mit eingechecktem `debug.keystore` (Passwort `android`) signiert. Fix: eigener Release-Keystore, nicht im Repo. [Sicher]
- **M-2** Hardcodiertes `€` in Gast-/Inserat-Screens (Wurzel 4). Fix: `formatCurrency`/`currencySymbol` aus `lib/currency`. [Sicher]
- Grün: Tokens nur in Keychain, kein Token-Log, 401→single-flight-Refresh, URLs zentral, kein WebView, Realtime `setAuth` vor `subscribe`, Rollen-Gating aus `/auth/me`; M-3 (Custom-Scheme-Deep-Link, keine Tokens), M-4 (kein Proguard).

**Web/Page-Builder (Agent 10)**
- **W-3** Builder ohne CSP/`X-Frame-Options`/`Referrer-Policy` → keine XSS-Defense-in-Depth, einbettbar, Draft-Token via `Referer` leakbar. Fix: strenge `headers()` in `next.config.ts`. [Sicher]
- Grün: W-4 (CanvasBridge-Origin), W-5 (Draft-Token in Query, aber HMAC+1h+eigen-Tenant), W-6 (`x-forwarded-host`, nur öffentlicher Inhalt), W-7 (self-XSS im Dashboard); Draft-Token-Design solide, kein `service_role` im Bundle.

**IDOR/Rollen (Agent 2)**
- **D-1** `create_connect_account` nutzt `req.tenant_id` aus dem Body (metadata) statt `ctx.tenant_id` — einzige Wurzel-3-Abweichung; MANAGE_BILLING-gated, Impact begrenzt (Webhook mappt über `stripe_account_id`). Fix: `ctx.tenant_id` durchreichen, `req.tenant_id` entfernen. [Wahrscheinlich]
- Grün: alle übrigen Slices korrekt tenant-/rollen-gescoped (staff/cleaner ohne Finanzsicht bestätigt).

---

## Empfohlene Reihenfolge

**Sofort (🔴 / Datenexposition):** R-1, R-2, R-4 (RLS-Scope-Migrationen — schnell, hoher Schutz), W-1 + W-2 (Stored XSS gegen Gäste), Q-1 (unauth DoS), F-1 (Rebinding-Pinning).

**Kurzfristig (🟡 mit Geld-/Compliance-Bezug):** P-1, P-2 (Doppelzahlung/-fakturierung), S-1, S-2 (PII-Logs, DSGVO), U-1, U-2 (Upload-XSS/Spoofing), R-5, R-3.

**Mittelfristig (Härtung):** F-2, F-3, Q-2…Q-5, W-3, U-3, D-1, I-1, S-3, M-1, M-2.

**Grenzen:** Alles statisch. Laufzeit-Erreichbarkeit interner Dienste (F-1/F-2), tatsächliche Realtime-Publikation und PostgREST-Exposition (R-1…R-5) müssen in der Prod-Umgebung bestätigt werden. Keine der Änderungen wurde umgesetzt.

---

## Quellen (aggregiert aus den 10 Domänen)
- OWASP API Security Top 10 (2023) — BOLA/BFLA: https://owasp.org/API-Security/editions/2023/en/
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- Supabase RLS Docs & Advisors: https://supabase.com/docs/guides/database/postgres/row-level-security · https://supabase.com/docs/guides/database/database-advisors
- SSRF/DNS-Rebinding (CVE-2026-27826, Prevention 2026): https://github.com/advisories/GHSA-489g-7rxv-6c8q · https://chs.us/guides/ssrf/
- Stored XSS via SVG-Upload (Tenable TRA-2026-25): https://www.tenable.com/security/research/tra-2026-25
- Next.js XSS / dangerouslySetInnerHTML: https://vibeappscanner.com/vulnerability-in/xss-nextjs
- Stripe Refund Abuse / Connect Risk: https://stripe.com/resources/more/refund-abuse · https://docs.stripe.com/connect/risk-management/best-practices
- File-Upload Magic-Numbers: https://transloadit.com/devtips/secure-api-file-uploads-with-magic-numbers/
- ReDoS (regexploit): https://github.com/doyensec/regexploit
- React Native Security: https://reactnative.dev/docs/security
