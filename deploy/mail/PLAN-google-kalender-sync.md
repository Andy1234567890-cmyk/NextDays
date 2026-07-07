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

## Architektur (an bestehende Bausteine angedockt)

```
  Google Calendar ──(events.watch Push-Webhook)──▶ myNextDays API
        ▲                                          (features/calendar_sync)
        │ Calendar API v3 (OAuth)                        │
        │                                                ▼
        └───────────────  Sync-Worker (worker.py) ──(CalDAV, App-Passwort)──▶ SOGo
                                                          persönlicher Kalender
   Webmailer-Änderung ──(Hook/Delta sync-collection)──▶ Worker ──▶ Google
```

**Wiederverwendet (schon im Repo, live geprüft):**
- `apps/api/src/worker.py` + Muster `features/channel_manager/bookings_sync.py`.
- **Webhook-Muster** `features/payments/webhook.py` (Idempotenz `_claim_event`,
  `secrets_match`) → Vorlage für den Google-Push-Callback (Wurzel 2 + 5).
- **CalDAV-Auth:** Mailcow `app_passwd` mit **`dav_access=1`** → pro Nutzer ein
  **DAV-only App-Passwort** anlegen; Worker nutzt das, NIE das Klartext-Passwort.
- Supabase-Realtime (`use-realtime.ts`) für Status-UI.
- SOGo CalDAV live: `https://mail.mynextdays.dk/SOGo/dav/<user>/Calendar/personal/`.

## Komponenten & Bau-Reihenfolge

1. **Google-Cloud-Projekt (zuerst — Verifizierung dauert Wochen):**
   - Calendar API aktivieren, OAuth-Consent-Screen („myNextDays", Logo,
     Datenschutz/AGB auf mynextdays.com), Scope
     `https://www.googleapis.com/auth/calendar`.
   - OAuth-Web-Client + Redirect-URI auf unsere API.
   - **Verifizierung starten** (sensibler Scope → Google-Review Tage–Wochen).
     Bis dahin Test-User-Modus (max. 100).

2. **Datenmodell (neue Tabellen, RLS Pflicht — Wurzel 3):**
   - `calendar_sync_accounts`: user_id, tenant_id, google_refresh_token
     (verschlüsselt), google_calendar_id, google_channel_id/expiry (Push),
     dav_app_password_ref, sync_token_google, sync_token_caldav, status, fehler.
   - `calendar_sync_event_map`: google_event_id ⇄ caldav_uid ⇄ etag/updated;
     UNIQUE(google_event_id), UNIQUE(caldav_uid) → Idempotenz-Backstop (Wurzel 2).
   - Migration + `supabase/apply-migrations.sh`; jede neue Tabelle bekommt RLS.

3. **OAuth-Flow (`features/calendar_sync`, FastAPI):**
   - connect → Google-Consent; callback → Tokens tauschen, Refresh-Token
     verschlüsselt speichern; disconnect → widerrufen + Push-Channel schließen.
   - Beim Connect: DAV-App-Passwort für den Nutzer erzeugen (Mailcow-API/DB),
     Referenz speichern.
   - Scope serverseitig auf tenant/user erzwingen (`load_scoped`).

4. **Push-Webhook-Empfänger (`calendar_sync/webhook.py`):**
   - `events.watch` registrieren; Google-Callback verifizieren
     (Channel-Token via `secrets_match`, fail-closed → 401, Wurzel 5).
   - Idempotent (`_claim_event`-Muster) → Redelivery ungefährlich.
   - Channel-Erneuerung vor Ablauf (Worker-Task).

5. **Sync-Worker (dockt an `worker.py`):**
   - Google→SOGo: `events.list` mit `syncToken` (Deltas) → CalDAV PUT/DELETE.
   - SOGo→Google: `sync-collection` (RFC 6578) Deltas → Google insert/update/delete.
   - Mapping über `calendar_sync_event_map`; last-writer-wins per `updated`/ETag;
     Löschungen als Tombstone. Kein Doppelanlegen (UNIQUE-Backstop).

6. **UI + Realtime + Monitoring + Doku:**
   - Button „Google-Kalender verbinden" (im Webmailer-Kontext/Dashboard).
   - Status live via `use-realtime.ts` (kein Polling).
   - Worker-Heartbeat in Uptime-Kuma. Worker NICHT in DB-Stack.
   - docs/ARCHITECTURE.md + Storybook-Diagramme aktualisieren.

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
