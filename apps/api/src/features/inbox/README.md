# Slice: inbox

Posteingang: OTA-/Plattform-Konversationen (Threads), Nachrichtenversand,
Vorlagen, KI-Antworten, geplante Nachrichten und **planbare Automails**.
Enthält: router.py, service.py, schemas.py, scheduler.py, ai.py, tests/.

Threads werden aus den importierten Buchungen (`channex_booking`) abgeleitet —
egal ob OTA (Channex) oder eigene Plattform „myBestDays" (booking_engine setzt
`ota_name='myBestDays'`). Versand läuft aktuell über die Channex-Messaging-API.

## Threads & Filter

`list_threads` liefert pro Thread: Gast (maskiert je Berechtigung), Kanal
(`ota_name`), **Objekt** (`property_id`/`property_title` via property_map_id →
channex_property_map → properties), An-/Abreise, Status, gelesen/zugewiesen.
Der Posteingang filtert client-seitig nach Kanal, Unterkunft (durchsuchbares
Multiselect — skaliert für 100+ Objekte), Reservierungsstatus, gelesen/ungelesen
und Anreise-Zeitraum.

## Automails (planbare Auto-Nachrichten) — Migration 0072

Regelbasierte Nachrichten (Buchungsbestätigung, Anreise-/Check-out-Info) mit
Zeitplan und Zuweisung. Tabelle `message_automation` (0037, erweitert in 0072):

- `trigger`: booking_new | before_checkin | after_checkout (semantisch).
- `anchor`: arrival | departure | booking — das Bezugsdatum.
- `offset_days`: vorzeichen-behaftetes Tagesdelta (−3 = 3 Tage vor, +1 = 1 nach).
- `send_time`: Uhrzeit (z. B. 07:45). Genau EIN Zeitpunkt je Regel.
- `property_ids[]` / `channels[]`: Zuweisung nach Unterkunft UND Kanal,
  **UND-verknüpft**; leer = alle. Kanal matcht case-insensitive auf `ota_name`
  (inkl. „myBestDays").
- `template_id` oder inline `message`: der Text.

### Engine

- `schedule_automations_for_thread(tenant_id, thread_id)`: bei jedem
  importierten/aktualisierten Booking (Aufruf aus channel_manager
  `_upsert_booking`, best effort). Für jede aktive Automation: Zuweisung prüfen
  (`_automation_matches`), `send_at` aus anchor+offset@send_time berechnen
  (`_compute_send_at`, UTC), Text auflösen (`_automation_body`), und EINE Zeile
  je (Automation, Thread) in `automation_scheduled_message` upserten.
  Dedup-Constraint `(automation_id, thread_id)` verhindert Doppelversand.
- `dispatch_due_automations()`: Cron über alle Tenants — fällige pending Automails
  (`send_at ≤ now`) via `send_message` (Channex) versenden, Status → sent|failed.
  **Kein Fallback:** fehlt das Ankerdatum, wird übersprungen (kein erfundenes Datum).
- Endpunkt: `POST /inbox/internal/dispatch-automations` (Cron-Secret
  `x_internal_cron_secret` = CHANNEX_WEBHOOK_SECRET), analog `/dispatch-scheduled`.

### Tabelle `automation_scheduled_message` (0072)

tenant_id, automation_id, thread_id, body, send_at, status
(pending|sent|failed|skipped|cancelled), last_error. RLS tenant-scoped; in der
Realtime-Publication (Posteingang/Automations live ohne Reload).

## Weitere Endpunkte (`/api/v1/inbox`, tenant-scoped)

- Threads: `GET /` · `GET /{id}/messages` · `POST /{id}/messages` · Flags/Status.
- Vorlagen: `GET/POST/PUT/DELETE /templates`. KI: `inbox_ai_settings` + `/ai-reply`.
- Geplante (manuell): `inbox_scheduled_message` (0040) +
  `POST /internal/dispatch-scheduled`.
- Automations-CRUD: `GET/POST/PUT/DELETE /automations`.
