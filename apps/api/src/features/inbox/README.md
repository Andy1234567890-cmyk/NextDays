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

### Was „ungelesen" heißt (`_ist_gelesen`, `spiegel._spiegel_stand`)

Der ausgelieferte `is_read` ist ABGELEITET, nicht die Spalte. Drei Werte
entscheiden, alle drei stehen im Spiegel (`portal_messages`) bzw. am Thread:

| Wert | Bedeutung |
| --- | --- |
| jüngste GAST-Nachricht | Ohne sie gilt schlicht das Flag `is_read`. |
| jüngste EIGENE Nachricht | Liegt sie danach, ist der Thread erledigt — niemand antwortet auf etwas, das er nicht gelesen hat. Deckt Scheduler-Antworten und Antworten ab, die direkt in der Portal-App geschrieben wurden. |
| `read_at` (0302) | Der Lesezeitpunkt. Liegt die Gastnachricht davor, wurde sie mitgelesen. Fehlt er (Altbestand), gilt das Flag. |

Verglichen werden **Zeitpunkte**, nie Zeichenketten: `…+00:00` (PostgREST) und
`…Z` (`ota_zeitstempel_utc`) meinen dasselbe, im Zeichenvergleich ist „Z" > „+".

Die Gegenseite dazu steht im Eingangspfad
(`channel_manager.nachrichten_eingang`): `is_read = false` setzt **nur eine
wirklich neue** Gastnachricht. Der Journal-Tick spiegelt jedes Ereignis seines
Fensters bei jedem Lauf erneut (Idempotenz am UNIQUE-Index); ein unbedingtes
Zurücksetzen machte deshalb alle fünf Minuten jeden Thread mit Gastnachricht im
Fenster wieder ungelesen — Lesen war wirkungslos (live 11.08.2026, neun
Threads).

`POST /bulk-update` filtert über die letzte **Aktivität**
(`last_message_at`, sonst `booked_at`) und nur in der aktiven Ansicht; `read`
schreibt `read_at` mit.

## Automails (planbare Auto-Nachrichten) — Migration 0072

Regelbasierte Nachrichten (Buchungsbestätigung, Anreise-/Check-out-Info) mit
Zeitplan und Zuweisung. Tabelle `message_automation` (0037, erweitert in 0072):

- `trigger`: booking_new | before_checkin | **after_checkin** |
  **before_checkout** | after_checkout | **message_received**
  (0257 setzt einen CHECK darauf — vorher war ein Tippfehler eine still tote
  Automation; 0307 ergänzt die zwei fehlenden Auslöser).
- `anchor`: arrival | departure | booking — das Bezugsdatum. Seit 0307 **aus dem
  Auslöser abgeleitet** (`ausloeser.py`), nicht frei wählbar: der Auslöser sagt
  Anker UND Richtung. Vorher konnte eine Regel „Vor Anreise" heißen und vor der
  ABREISE feuern (live so vorgefunden) — zwei DB-CHECKs halten das jetzt durch.
- `offset_days`: vorzeichen-behaftetes Tagesdelta (−3 = 3 Tage vor, +1 = 1 nach).
  Das Vorzeichen setzt der Server nach dem Auslöser; die Maske fragt nur den
  Betrag.
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
- `replan_tenant(tenant_id)` / `replan_all_tenants()` (0307): rechnet die
  geplanten Automails aus den AKTUELLEN Regeln neu — beim Anlegen/Ändern einer
  Regel sofort, dazu stündlich im Worker (`_automail_planung_tick`) und über
  `POST /inbox/internal/replan-automations`. Nötig, weil bis dahin
  ausschließlich beim Buchungs-Import geplant wurde: eine NEUE Regel erreichte
  keine bestehende Buchung, eine GEÄNDERTE ließ die alten Zeitpunkte stehen
  (beides live vorgefunden). Beide Richtungen (Wurzel 1): was nicht mehr gilt —
  pausierte Regel, geänderter Objekt-/Kanal-Zuschnitt, stornierte Buchung —
  wird auf `cancelled` gesetzt. Unangetastet bleibt, was bereits raus ist
  (`sent`/`sending`/`failed`).
- **Nachzügler** (`_versandstatus`): ein `send_at`, das über
  `NACHZUEGLER_STUNDEN` (24) zurückliegt, wird als `skipped` festgehalten statt
  verspätet verschickt. Ohne diese Grenze wird jeder Bestandsimport zur
  Nachrichtenlawine an längst abgereiste Gäste.
- **Anker „Buchung" = `booked_at`**, der Zeitpunkt beim Portal (Wurzel 5b), NICHT
  `created_at`. Live: 30 im selben Rutsch importierte Buchungen aus Februar bis
  Juni trugen dieselbe `created_at` und hingen dadurch gebündelt auf einer
  einzigen Minute. Fehlt `booked_at`, wird nicht geplant.
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
