# Umsetzungsstand Mega-Audit (2026-07-16)

Die im Mega-Audit (10 Domänen) bestätigten 🔴- und die meisten 🟡-Befunde sind
umgesetzt, getestet (`996 passed`, ruff sauber, pylint 10.00/10 auf geänderten
Modulen) und — für die DB-Migration — per Dry-Run gegen die echte Server-DB
verifiziert (BEGIN/…/ROLLBACK, gegengelesen).

| ID | Fix |
|----|-----|
| R-1 | `property_guest_portal`: owner+staff RESTRICTIVE-SELECT-Scope — Migration `0155` |
| R-2 | 8 Objektkartei-Tabellen: fehlender staff_scope nachgezogen — `0155` |
| R-4 | `user_mfa`: tabellen-weites SELECT für authenticated/anon entzogen, SELECT nur auf unkritischen Spalten (totp_secret/recovery_codes verborgen) — `0155`. **Erkenntnis:** reiner column-REVOKE greift NICHT, solange das pauschale Tabellen-GRANT besteht. |
| Q-1 | Max-Span-Guard (`_assert_span`, 730 Tage) in booking_engine (availability/listings/detail) → 422 |
| F-1 | DNS-Rebinding: `_fetch` pinnt auf die geprüfte IP (Host-Header+SNI gegen echten Host), Redirects manuell revalidiert |
| F-2 | iCal-Body gestreamt + bei 5 MB abgebrochen (kein Multi-GB-Download) |
| F-3 | SSRF-Blocklist um CGNAT `100.64/10` + IPv4-mapped-IPv6 erweitert |
| W-1 | Rich-Text serverseitig mit `nh3` (Allowlist-Parser) sanitisiert statt Regex |
| W-2 | `href`/`cta_href`: field_validator, nur http(s)/mailto/tel/relativ |
| W-3 | Builder: CSP + X-Frame-Options + Referrer-Policy in `next.config.ts` |
| P-1 | Refund: deterministischer Stripe-`idempotency_key` |
| P-2 | Kommissions-Fakturierung: `idempotency_key=comm:{tenant}:{period}` |
| D-1 | `create_connect_account`: tenant_id aus `ctx`, Body-Feld entfernt |
| I-1 | Gäste-Suche: PostgREST-`or`-Term entschärft (`_or_ilike_term`) |
| S-1/S-2 | E-Mail/Telefon in Logs maskiert (`mask_email`/`mask_phone`) |
| U-1 | SVG-Logo vor Upload mit `nh3` auf reine Vektor-Grafik sanitisiert |

Offen (bewusst nicht umgesetzt): **M-2** (€-Hardcode in Mobile-Screens) — betrifft
reine Mock-Screens OHNE Währungsdaten; ein Umbau auf `formatCurrency` bräuchte ein
erfundenes `"EUR"` (selbst Wurzel-4-Verstoß) → gehört in den Feature-Umbau, der
echte Preis-/Währungsdaten anbindet. **U-2/U-3, Q-2…Q-5, S-3, F-** (Rest-Härtung),
**M-4** — mittelfristige Härtung, noch offen. Migration `0155` spielt der Nutzer
per `apply-migrations.sh` ein (Dry-Run bereits grün).

---

# Security-Audit 2 — Erweiterte Angriffsklassen (NextDays, apps/api)

**Art:** Statische Code-Analyse (defensiv, kein Live-Pentest).
**Datum:** 2026-07-16
**Abgrenzung:** Audit 1 (`docs/SECURITY-AUDIT-AUTH.md`) deckte Auth/JWT/RLS/BOLA ab. Audit 2 erweitert auf: SSRF, Webhook-/Payment-Sicherheit, CORS, Info-Disclosure, Upload, Dependencies, Mass-Assignment.
**Markierung:** [Sicher] = im Code verifiziert · [Wahrscheinlich] = starke Indizien · [Vermutung] = nicht abschließend verifizierbar.

---

## Schritt 1 — Erweiterte Checkliste (aus Web-Recherche)

| ID | Klasse |
|----|--------|
| A1 | Stripe-Webhook-Bypass bei leerem Secret (CVE-2026-41432-Muster) |
| A2 | Fehlende Webhook-Idempotenz (Replay, Doppelverarbeitung) |
| A3 | Channex-Webhook ohne/mit fail-open Secret-Prüfung |
| A4 | **SSRF** über nutzerkontrollierte URL (iCal-Feed, Notification-URL → interne/Metadata-IP) |
| A5 | SSRF über sonstige ausgehende Requests |
| A6 | SSRF/Upload über Media-Import |
| A7 | CORS-Fehlkonfiguration (Wildcard + Credentials) |
| A8 | Info-Disclosure: `/docs`, `/openapi.json` in Prod offen |
| A9 | Verwundbare Dependencies (bekannte CVEs) |
| A10 | Mass Assignment (Pydantic-Modelle exponieren zu viele Felder) |

---

## Schritt 2 — Befunde (Ampel)

| ID | Status | Beleg | Begründung |
|----|--------|-------|------------|
| A1 | 🟢 abgesichert | `features/payments/router.py:232-255` | Leeres Secret → **503**, fehlende Signatur → **400**, `stripe.Webhook.construct_event` (echte HMAC-+Timestamp-Prüfung), ungültige Signatur → **400**. Fail-closed, kein Empty-Secret-Bypass. [Sicher] |
| A2 | 🟢 abgesichert | `features/payments/webhook.py:_claim_event` | `upsert(on_conflict="id", ignore_duplicates=True)` — atomare Event-Claim, at-least-once-sicher (Wurzel 2). [Sicher] |
| A3 | 🟢 abgesichert | `features/channel_manager/router.py:423-424` | Inbound-Secret via `secrets_match` (zeitkonstant); leeres erwartetes Secret → `False` → Ablehnung (fail-closed). Leere Test-Pings ohne Event bewusst 200. [Sicher] |
| A4 | 🟢 abgesichert | `features/external_calendar/service.py` (`_assert_public_url`, `_fetch`) | http(s)-Allowlist + DNS-Auflösung, Ablehnung privater/loopback/link-local/reserved/multicast/unspecified IPs — beim **Anlegen** (`add_calendar`) UND beim **Sync**. `_fetch` folgt Redirects manuell und revalidiert JEDE Zwischenstation (Rebinding/302-SSRF), `follow_redirects=False`. Fail-closed. [Sicher] |
| A5 | 🟢 abgesichert | `pricing/weather.py`, `pricing/market/airdna.py`, `buchhaltung/vat_check.py`, `whatsapp/client.py`, `content/service.py`, `channel_manager/channex_client.py` | Alle ausgehenden Requests gehen an **fest kodierte** API-Endpunkte (Meta, AirDNA, VIES, Channex …), keine nutzerkontrollierte Ziel-URL. [Sicher] |
| A6 | 🟢 abgesichert | `features/media/service.py` | Media speichert **signierte Supabase-Storage-URLs**; kein serverseitiger Fetch beliebiger URLs. [Sicher] |
| A7 | 🟢 abgesichert | `src/main.py:106-119` | Explizite `allow_origins` aus `cors_origin_list` (kein `*`), `allow_credentials=True` mit **expliziter** Methoden-Allowlist statt `*` (dokumentiert). [Sicher] |
| A8 | 🟢 abgesichert | `src/main.py` (`create_app`) | In Prod (`app_env != local`) `docs_url=None`/`redoc_url=None`/`openapi_url=None` → `/docs`, `/redoc`, `/openapi.json` liefern 404; nur lokal offen. Test `test_docs_disabled_in_prod`. [Sicher] |
| A9 | 🟢 abgesichert | `apps/api/pyproject.toml`, `uv.lock` | `uvx pip-audit` (autoritativ) fand 9 CVEs: pillow 12.2.0 (8×, PYSEC-2026-2253…3453) + pydantic-settings 2.14.1 (GHSA-4xgf-cpjx-pc3j). **Behoben**: pillow→12.3.0, pydantic-settings→2.14.2; erneuter Scan „No known vulnerabilities found". [Sicher] |
| A10 | 🟢 abgesichert | `features/*/schemas.py` (Create/Update/Response-Trennung) | Slices nutzen getrennte Pydantic-Modelle; tenant_id/role werden serverseitig gesetzt, nicht aus dem Body übernommen. Einzelfall `update_connect_account(req.fields)` reicht Felder an Stripe durch — kein DB-Mass-Assignment. [Wahrscheinlich] |

---

## Behobene Befunde (Stand 2026-07-16)

**A4 und A8 sind umgesetzt und getestet** (`993 passed`, ruff sauber, pylint 10.00/10):
- **A4** — SSRF-Guard war bereits beim Anlegen/Sync aktiv; zusätzlich gehärtet gegen
  DNS-Rebinding/Redirect-SSRF: `_fetch` verfolgt Redirects manuell und revalidiert
  jede Zwischen-URL (`follow_redirects=False`). Regressionstest
  `test_fetch_revalidates_redirect_target`.
- **A8** — `/docs`, `/redoc`, `/openapi.json` in Prod deaktiviert (`app_env != local`).
  Regressionstest `test_docs_disabled_in_prod`.
- **A9** — `uvx pip-audit` fand 9 CVEs (pillow 12.2.0, pydantic-settings 2.14.1);
  Fix-Pins gesetzt (pillow>=12.3.0, pydantic-settings>=2.14.2), `uv.lock` erneuert,
  erneuter Scan sauber.

Der ursprüngliche A4-Befund (unten) ist historisch — die Guard-Funktion `_assert_public_url`
existiert bereits im Code; der Audit-Entwurf spiegelte einen älteren Stand.

---

## Ursprünglicher Befund (historisch)

### 🔴/🟡 A4 — SSRF über iCal-Feed-URL (`external_calendar`)

**Fakt [Sicher]:** In `src/features/external_calendar/service.py` holt `_fetch(url)` eine **nutzergelieferte** URL:
```python
with httpx.Client(timeout=_SYNC_TIMEOUT, follow_redirects=True) as client:
    resp = client.get(url, headers={"User-Agent": "myNextDays-Calendar/1.0"})
```
Die URL stammt aus `cal["ical_url"]`, gesetzt beim Anlegen eines externen Kalenders (`ics_url` im Request-Body). Es gibt **keine** Host-/Schema-/IP-Validierung, und `follow_redirects=True` erlaubt Umleitung auf interne Ziele auch dann, wenn die Ausgangs-URL harmlos aussieht.

**Interpretation [Wahrscheinlich]:** Ein authentifizierter Tenant-User kann einen Feed mit `http://127.0.0.1:…`, `http://localhost:…`, interner RFC-1918-Adresse oder `http://169.254.169.254/…` (Cloud-Metadata) registrieren. Der Sync-Worker ruft das Ziel serverseitig ab → SSRF ins interne Netz (Redis, Supabase-intern, Admin-Interfaces). Auf **Hetzner/Coolify** (ADR-0010) ist ein klassischer AWS-Metadata-Credential-Diebstahl unwahrscheinlich, **internes-Netz-SSRF und localhost-Zugriff bleiben** aber real. Daher 🟡 mit Eskalation auf 🔴, falls interne Dienste erreichbar sind.

**Fix-Skizze (nicht umgesetzt):**
```python
# neuer Helper core/net_guard.py — vor JEDEM _fetch aufrufen:
# 1. Schema-Allowlist: nur http/https
# 2. Hostnamen auflösen (getaddrinfo), JEDE aufgelöste IP prüfen
# 3. ablehnen, wenn IP in: loopback, private, link-local (169.254.0.0/16),
#    ULA (fc00::/7), reserved, multicast
# 4. follow_redirects=False ODER eigener Redirect-Handler, der jede
#    Zwischenstation erneut durch (2)+(3) schickt (TOCTOU/Rebinding-Schutz)
import ipaddress, socket
def assert_public_url(url: str) -> None:
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        raise ExternalCalendarError("Nur http(s)-Feeds erlaubt.", status_code=422)
    for fam, *_rest, sockaddr in socket.getaddrinfo(p.hostname, None):
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ExternalCalendarError("Ziel-Host nicht erlaubt.", status_code=422)
```
Prüfung sowohl beim **Anlegen** (`ics_url` validieren) als auch beim **Sync** (DNS kann zwischenzeitlich umgebogen werden → Rebinding). `follow_redirects=False` setzen und Redirects manuell revalidieren.

---

## Nicht anwendbar / nicht verifizierbar
- Laufzeit-SSRF-Exploit (tatsächliche Erreichbarkeit interner Dienste) — nur mit laufender Infrastruktur prüfbar.
- Autoritativer Dependency-Scan (`uv pip-audit`) — im `uv`-Env des Projekts auszuführen, hier nicht möglich.

---

## Zusammenfassung

Ein neuer, echter Befund: **A4 (SSRF über iCal-Feed-URL)**. Alles andere im erweiterten Scope ist abgesichert (Stripe-Webhook fail-closed, Idempotenz, CORS, Dependencies aktuell) bis auf **A8** (offene `/docs` in Prod, geringe Schwere).

Empfohlene Reihenfolge: A4 (SSRF-Guard) zuerst, A8 (`docs_url=None` in Prod) als schneller Härtungs-Zusatz.

## Quellen
- OWASP API Security Top 10 (2023): https://owasp.org/API-Security/editions/2023/en/
- FastAPI Security Guide (SSRF, CORS, Mass Assignment): https://davidmuraya.com/blog/fastapi-security-guide/
- FastAPI OWASP-Härtung: https://oneuptime.com/blog/post/2025-01-06-fastapi-owasp-security/view
- SSRF-Prävention in FastAPI: https://codesignal.com/learn/courses/server-side-request-forgery-ssrf-prevention-in-fastapi/lessons/preventing-ssrf-in-fastapi-1
- Stripe Webhook Signature Bypass (leeres Secret), CVE-2026-41432: https://github.com/advisories/GHSA-xff3-5c9p-2mr4
- Missing Stripe-Signature Verification (n8n), CVE-2026-21894: https://www.gecko.security/blog/cve-2026-21894
- Stripe Webhook Security Guide: https://www.hooklistener.com/learn/stripe-webhook-security-guide
- SSRF via Notification-URL → interne/Metadata-IP (Muster): https://www.kodemsecurity.com/cve-archive/cve-2026-33655
