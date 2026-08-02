# Slice: inbox

Posteingang: OTA-/Plattform-Konversationen (Threads), Nachrichtenversand,
Vorlagen, KI-Antworten, geplante Nachrichten und **planbare Automails**.

Module: `router.py`, `service.py` (Kern, setzt sich aus den Mixins
`planung.py` · `vorlagen.py` · `anhaenge.py` zusammen), `felder.py`
(Platzhalter), `schemas.py`, `scheduler.py`, `ai.py`, `authz.py`, `zeit.py`,
`errors.py`, `tests/`.

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

- `trigger`: booking_new | before_checkin | after_checkout | **message_received**
  (0257 setzt einen CHECK darauf — vorher war ein Tippfehler eine still tote
  Automation).
- `anchor`: arrival | departure | booking — das Bezugsdatum.
- `offset_days`: vorzeichen-behaftetes Tagesdelta (−3 = 3 Tage vor, +1 = 1 nach).
- `send_time`: Uhrzeit (z. B. 07:45). Genau EIN Zeitpunkt je Regel.
- `property_ids[]` / `channels[]`: Zuweisung nach Unterkunft UND Kanal,
  **UND-verknüpft**; leer = alle. Kanal matcht case-insensitive auf `ota_name`
  (inkl. „myBestDays").
- `template_id` oder inline `message`: der Text.
- `use_property_timezone` (0258): `send_time` als **Ortszeit des Objekts**
  auslegen (`properties.timezone`, IANA) statt UTC. Fehlt die Zeitzone am
  Objekt, wird die Planung übersprungen und geloggt
  (`automation_ohne_objekt_zeitzone`) — kein erfundener Ersatz (Wurzel 4).
- Nur für `message_received` (0257): `only_first_message` (nur auf die erste
  Gastnachricht antworten), `window_days smallint[]` (Wochentage) und
  `window_from`/`window_to` (Uhrzeitfenster, auch über Mitternacht) — das
  Abwesenheits-/Außerhalb-der-Bürozeiten-Muster. Der CHECK erzwingt, dass
  beide Fensterzeiten gemeinsam gesetzt oder gemeinsam leer sind.

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
- `schedule_message_received(tenant_id, thread_id, *, ist_erste_nachricht)`:
  eigener Einstieg für den Auslöser `message_received`, aufgerufen aus dem
  Channex-Webhook-Event `message` (`channel_manager/channels.py`,
  `_nachricht_eingegangen`, best effort — der Webhook antwortet immer 200).
  `send_at = jetzt`; der Dedup-Index `(automation_id, thread_id)` begrenzt die
  Antwort auf **einmal je Thread**. `_im_zeitfenster()` prüft Wochentag und
  Uhrzeitfenster gegen die Ortszeit. Kann die Zahl der bisherigen
  Gastnachrichten nicht ermittelt werden, gilt „nicht die erste" (eine
  ausgelassene Abwesenheitsantwort ist harmloser als eine, die in einen
  laufenden Dialog platzt).
  **Grenze:** `automation_scheduled_message.thread_id` zeigt per FK auf
  `channex_booking` — WhatsApp-Eingänge können diesen Auslöser deshalb nicht
  auslösen, nur OTA-/Plattform-Threads.

### Tabelle `automation_scheduled_message` (0072)

tenant_id, automation_id, thread_id, body, send_at, status
(pending|sent|failed|skipped|cancelled), last_error. RLS tenant-scoped; in der
Realtime-Publication (Posteingang/Automations live ohne Reload).

## Platzhalter (`felder.py`)

`{{guest_first_name}}`, `{{check_in_date}}`, `{{property_title}}` … — 22 Felder
in vier Gruppen (guest · reservation · property · company). Die Schlüssel sind
sprachneutral englisch, die Beschriftung kommt aus `inbox.field_*` (24 Sprachen).

- Aufgelöst wird **beim Senden** (`send_message`), nicht beim Planen: ein
  Türcode, der erst am Anreisetag feststeht, steht sonst als alter Wert in der
  Warteschlange.
- Fehlt einem benutzten Feld der Wert, wirft `FeldFehlt` — es wird **kein**
  Platzhalter-Text und kein Ersatzwert verschickt (Wurzel 4). Ausnahme:
  `children` darf 0 sein, das ist eine Aussage.
- Unbekannte Schlüssel bleiben beim Rendern stehen; beim **Speichern** einer
  Vorlage/Automation weist `_felder_pruefen` sie mit 422 ab.
- Der Kontext ist bewusst **unmaskiert** — Empfänger ist der Gast selbst.
- Beträge werden ohne Währungszeichen formatiert; `{{currency}}` ist ein
  eigenes Feld (Wurzel 4).
- `GET /fields` liefert den Katalog an die Oberfläche (Feld-Picker),
  `POST /{thread_id}/render` die Vorschau im Editor.

## Anhänge (`anhaenge.py`, Migration 0259)

Privater Bucket `inbox-attachments` (10 MB) + Tabelle `inbox_attachment`.
Dateityp per **Magic Bytes** (PNG/JPEG/WebP/GIF/PDF), nie aus dem
Client-`content_type` (Wurzel 8). Ausgeliefert nur über signierte URLs (1 h).
Die Datei wird auch dann gespeichert, wenn der Kanal sie ablehnt — der Fehler
steht als `channel_error` an der Zeile und die Oberfläche zeigt „nicht
zugestellt" statt still zu schlucken (Wurzel 5). Versand über Channex
`create_attachment` (base64) + `send_booking_attachment`.

## Wissensdatenbank (Migration 0260)

`inbox_knowledge_fact`: gesicherte Angaben, die der KI-Antwortvorschlag als
Fakten verwenden darf (`ai.py` hängt sie als eigenen Block an den Prompt).
`property_id` leer = betriebsweit, sonst genau ein Objekt. `source`:
manual | document | message.

**Wurzel 6:** `inbox_attachment` und `inbox_knowledge_fact` haben
`revoke all from anon, authenticated` + `as restrictive for all using (false)`
— dort stehen WLAN-Passwörter und Türcodes. Kein Realtime-Abo auf beiden; ein
solches wäre eine stumme Attrappe (die Oberfläche lädt nach eigener Änderung
neu).

## Weitere Endpunkte (`/api/v1/inbox`, tenant-scoped)

- Threads: `GET /` · `GET /{id}/messages` · `POST /{id}/messages` · Flags/Status.
- Vorlagen: `GET/POST/PUT/DELETE /templates`. KI: `inbox_ai_settings` + `/ai-reply`.
- Geplante (manuell): `inbox_scheduled_message` (0040) +
  `POST /internal/dispatch-scheduled`.
- Automations-CRUD: `GET/POST/PUT/DELETE /automations`.
- Platzhalter: `GET /fields` · `POST /{thread_id}/render`.
- Anhänge: `GET/POST /{thread_id}/attachments` · `DELETE /attachments/{id}`.
- Wissen: `GET/POST /knowledge` · `PUT/DELETE /knowledge/{id}`.
