# Plan: Google-Kalender ⇄ Webmailer (SOGo) — Zwei-Wege, Realtime

> **Status: PLANUNG** — nichts hiervon ist gebaut/deployt. Aktualisiert 2026-07-07
> mit den Nutzer-Entscheidungen: **nur gcloud/OAuth** (kein ICS-Abo),
> **Realtime-Sync** (Push, kein Polling), Ziel = **SOGo-Webmailer-Kalender**.

## Ziel (präzisiert)

Der Kunde verbindet in myNextDays Mail (white-label) seinen Google-Kalender per
**ein Klick (Google OAuth)**. Danach werden Termine **bidirektional in
Echtzeit** abgeglichen zwischen **Google Calendar** und dem **persönlichen
SOGo-Kalender** (`mail.mynextdays.dk`, „Personal Calendar"). Voll in unserer
Infra, kein Drittanbieter.

> **Nicht** der PMS-Belegungskalender (`features/calendar/` = Objekte/Reservierungen/
> stop-sell). Das ist ein anderer Kalender und NICHT Ziel dieses Plans.

## „Realtime" — was das konkret heißt (ehrlich)

- **Google → SOGo (echtes Push):** Google Calendar API `events.watch` öffnet
  einen **Push-Channel** → Google schickt bei jeder Änderung sofort einen
  **Webhook an unsere API**. Kein Polling. (Channel läuft ~ Tage ab → muss
  erneuert werden.)
- **SOGo → Google (kein natives Push):** CalDAV/SOGo kann uns NICHT pushen.
  Realtime hier = **wir triggern selbst**: bei Änderung im Webmailer-Kalender
  stößt ein Hook den Sync an. Fällt das aus, greift ein kurzer CalDAV-
  `sync-collection`-Delta-Abgleich als Sicherheitsnetz (Sekunden-Takt, nur Deltas).
- **UI-Realtime (NextDays-Pflicht):** Der Sync-Status/-Fortschritt wird über
  Supabase-Realtime (`use-realtime.ts`) live angezeigt, kein Reload/Polling.

## WICHTIG: Läuft auf dem MAIL-Server, getrennt vom Hauptprojekt

Der Mail-Server (`62.238.4.193`) ist eine **eigene, isolierte Einheit** und bleibt
das. Der Kalender-Sync ist Mail-nah → **eigener kleiner Dienst NEBEN Mailcow auf
dem Mail-Server**, NICHT die Haupt-API (`nextdays-api` auf dem Staging-Server),
NICHT in den Monorepo-Stack. **Mailcow-Stack selbst bleibt unberührt.**

- **Eigener Container** (z.B. `mail-sync`) auf `62.238.4.193`, eigenes
  Compose (NICHT im Mailcow-Compose, NICHT im DB-Stack).
- **Die TERMINE selbst landen in SOGos Kalender** (Mailcow-MySQL, via CalDAV) —
  KEINE eigene Termin-DB. Google-Termine erscheinen im ganz normalen
  SOGo-Kalender des Nutzers, wie alle anderen Termine auch.
- **Nur die Sync-VERWALTUNG** (Google-Token, Verbindungsstatus, Event-Mapping)
  kommt in **zusätzliche Tabellen in der BESTEHENDEN Mailcow-MySQL** — keine
  neue/separate Datenbank.
- **Domain:** `sync.mynextdays.dk` (Cloudflare-Zone liegt schon dort) mit
  eigenem TLS (Let's Encrypt) — nötig für Google-OAuth-Redirect + Push-Webhook
  (Google akzeptiert KEINE sslip.io/IP-Domains bei Verifizierung).

## Architektur

```
  Google Calendar ──(events.watch Push-Webhook)──▶ mail-sync Dienst
        ▲                                          (sync.mynextdays.dk, eigener
        │ Calendar API v3 (OAuth)                   Container auf 62.238.4.193)
        │                                                │
        └───────────────  Sync-Worker ──(CalDAV, DAV-App-Passwort)──▶ SOGo (lokal)
                                                          persönlicher Kalender
   Webmailer-Änderung ──(Hook/Delta sync-collection)──▶ Worker ──▶ Google
```

**Als VORLAGE/Muster aus dem Hauptrepo übernehmen (nicht direkt nutzen):**
- Worker-Muster `features/channel_manager/bookings_sync.py` (Struktur).
- **Webhook-Muster** `features/payments/webhook.py` (Idempotenz `_claim_event`,
  `secrets_match`) → Vorlage für den Google-Push-Callback (Wurzel 2 + 5).

**Direkt auf dem Mail-Server verfügbar (live geprüft):**
- **CalDAV-Auth:** Mailcow `app_passwd` mit **`dav_access=1`** → pro Nutzer ein
  **DAV-only App-Passwort**; Worker nutzt das lokal, NIE das Klartext-Passwort.
- SOGo CalDAV: `https://mail.mynextdays.dk/SOGo/dav/<user>/Calendar/personal/`
  (bzw. containerintern erreichbar — Worker läuft auf demselben Server).

> **Realtime-UI-Status:** Da der Sync auf dem getrennten Mail-Server läuft, kann
> die Status-Anzeige NICHT direkt über die PMS-Supabase-Realtime laufen. Optionen
> beim Bau klären: (a) der mail-sync-Dienst pusht Status per WebSocket/SSE an den
> Webmailer, oder (b) meldet Status an eine kleine Statuszeile im Webmailer-UI.

## Fortschritt (erledigt)

- ✅ **DNS:** `sync.mynextdays.dk` → `62.238.4.193` (Cloudflare A-Record, DNS-only/
  nicht proxied). Propagiert (1.1.1.1 + 8.8.8.8 verifiziert).
- ✅ **TLS:** Let's-Encrypt-Zertifikat für `sync.mynextdays.dk` über Mailcows
  eigenen ACME (`ADDITIONAL_SAN=sync.mynextdays.dk` + `ADDITIONAL_SERVER_NAMES`
  in `mailcow.conf`). Von außen: `SSL certificate verify ok`, HTTP 200. Mailcow
  erneuert automatisch. Mailcow-Stack nur über vorgesehene Config-Optionen
  erweitert (unberührt). Backup: `mailcow.conf.bak-*` auf dem Server.
  - Aktuell zeigt die Domain noch auf die Mailcow-UI; sobald der mail-sync-
    Container läuft, kommt ein nginx-Proxy-Block (`/etc/nginx/conf.d/*.conf` bzw.
    `data/conf/nginx/`) der `sync.` an den Container weiterleitet.

## Komponenten & Bau-Reihenfolge

1. **Google-Cloud-Projekt (zuerst — Verifizierung dauert Wochen):**
   - Calendar API aktivieren, OAuth-Consent-Screen („myNextDays", Logo,
     Datenschutz/AGB auf mynextdays.com), Scope
     `https://www.googleapis.com/auth/calendar`.
   - OAuth-Web-Client + Redirect-URI auf unsere API.
   - **Verifizierung starten** (sensibler Scope → Google-Review Tage–Wochen).
     Bis dahin Test-User-Modus (max. 100).

2. **Datenmodell — NUR Verwaltung, in der BESTEHENDEN Mailcow-MySQL:**
   > Die Termine gehen NICHT hier rein — die landen via CalDAV in SOGos
   > eigenem Kalender. Diese Tabellen sind nur der Sync-„Klebstoff".
   - `mnd_calsync_accounts`: mailbox (SOGo-Nutzer), google_refresh_token
     (verschlüsselt), google_calendar_id, google_channel_id/expiry (Push),
     dav_app_password_ref, sync_token_google, sync_token_caldav, status, fehler.
   - `mnd_calsync_event_map`: google_event_id ⇄ caldav_uid ⇄ etag/updated;
     UNIQUE(google_event_id), UNIQUE(caldav_uid) → Idempotenz-Backstop (Wurzel 2).
   - Als eigene Tabellen (Präfix `mnd_`) in der Mailcow-DB, damit Mailcow-Updates
     sie nicht anfassen. Migration als eigenes SQL-Skript im mail-sync-Dienst.

3. **OAuth-Flow (mail-sync Dienst, kleine FastAPI):**
   - connect → Google-Consent; callback → Tokens tauschen, Refresh-Token
     verschlüsselt in `mnd_calsync_accounts` speichern; disconnect → widerrufen
     + Push-Channel schließen.
   - Beim Connect: DAV-App-Passwort für den Nutzer erzeugen (Mailcow
     `app_passwd`, `dav_access=1`), Referenz speichern.
   - Zugriff pro Mailbox scopen (nur eigener Kalender).

4. **Push-Webhook-Empfänger (im mail-sync Dienst):**
   - `events.watch` registrieren; Google-Callback verifizieren
     (Channel-Token via `secrets_match`, fail-closed → 401, Wurzel 5).
   - Idempotent (`_claim_event`-Muster) → Redelivery ungefährlich.
   - Channel-Erneuerung vor Ablauf (Worker-Task).

5. **Sync-Worker (im mail-sync Dienst):**
   - Google→SOGo: `events.list` mit `syncToken` (Deltas) → **CalDAV PUT/DELETE
     in SOGos Kalender** (Termine landen in Mailcow/SOGo, wie gewünscht).
   - SOGo→Google: CalDAV `sync-collection` (RFC 6578) Deltas → Google
     insert/update/delete.
   - Mapping über `mnd_calsync_event_map`; last-writer-wins per `updated`/ETag;
     Löschungen als Tombstone. Kein Doppelanlegen (UNIQUE-Backstop).

6. **UI + Realtime-Status + Monitoring + Doku:**
   - Button „Google-Kalender verbinden" **im Webmailer** (SOGo-Kalender-UI oder
     Einstellungen) — white-label, kein „Google/SOGo" außer dem Consent-Screen.
   - Sync-Status live im Webmailer anzeigen (WebSocket/SSE vom mail-sync-Dienst,
     kein Polling).
   - mail-sync-Heartbeat in Uptime-Kuma (wie mail-heartbeat). Dienst NICHT in
     den Mailcow-/DB-Stack. Storybook-Mail-Doku aktualisieren.

## Fehlerbehandlung (Wurzel 5, fail-closed)

- Token abgelaufen / Scope entzogen / Push-Channel tot → Sync **pausieren** +
  Kunde informieren, NICHT still weiterlaufen oder Fehler verschlucken.
- Google-Rate-Limits respektieren (Backoff), Push-Channel-Ablauf proaktiv erneuern.

## Aufwand & Risiken (ehrlich)

| Punkt | Einschätzung |
|---|---|
| Google-Cloud + OAuth-**Verifizierung** | **Wochen Wartezeit**, nicht in unserer Hand → zuerst starten |
| OAuth-Flow + Token + DAV-App-Passwort | ~2–3 Tage |
| Push-Webhook (watch + Callback + Erneuerung) | ~2–3 Tage |
| **Bidirektionaler Delta-Sync** (der harte Teil) | ~1–2 Wochen (Konflikte, Löschungen, wiederkehrende Termine, Zeitzonen, Endlosschleifen-Schutz) |
| UI + Realtime-Status + Monitoring + Doku | ~3–4 Tage |

**Größte Risiken:** (1) Google-Verifizierung (Zeit). (2) Sync-Korrektheit
bidirektional. (3) Push-Channel-Lifecycle (Ablauf/Erneuerung). (4) SOGo→Google
hat kein echtes Push → Hook + Delta-Netz nötig.

## Nächster Schritt

Wenn's losgeht: **Schritt 1 (Google-Cloud-Projekt + OAuth-Consent + Verifizierung)**
zuerst, parallel Datenmodell/OAuth-Flow bauen. Für Schritt 1 braucht es Zugriff
auf die Google Cloud Console (dein Google-Konto) — ich führe dich durch, kann es
nicht allein anlegen.
