# Slice: channel_manager

Channel-Manager auf Basis **Channex** (white-label, kein iFrame/Branding),
`/api/v1/channel-manager`: Property-Mapping PMS↔Channex
(`property_mapping.py`, ein Objekt → synthetischer Room-Type), ARI-Push
(Verfügbarkeit/Preise/Restriktionen, `ari_push.py`), Buchungs-Sync von den
OTAs zurück ins PMS (`bookings_sync.py`) und Content-Sync
(`content_builder.py`/`content_sync.py`).

Channel-Verwaltung im 4-Schritt-Flow (`POST /channels/prepare` →
`POST /channels` → Mapping → live; `channels.py`), Airbnb-OAuth
(`airbnb_oauth.py`, `oauth_channels.py`), Webhook-Registrierung + -Empfang
(`/webhooks`, `/webhook`) und eine interne Reconcile-Route. Für die Sandbox
gibt es eine Mock-OTA (`sandbox_ota.py`, OpenChannel).
Siehe ADR-0001 und ADR-0012.

## Buchungs-Pull (automatisch)

Buchungen kommen über den **Booking-Revisions-Feed** (paginiert, 100/Seite,
älteste zuerst) und werden erst NACH erfolgreichem Speichern ge-ackt. Trigger:

1. Channex-Webhook `booking_*`/`non_acked_booking` → Job `sync_bookings_feed`
   (coalesced je Minute),
2. Worker-Backstop-Tick alle 5 min (`BOOKINGS_TICK_SECONDS`) — fängt verlorene
   Webhooks ab (Channex wiederholt nur ~24 h).

`sync_bookings_all()` ordnet jede Revision über `channex_property_map` ihrem
Tenant zu; Revisionen ohne aktives Mapping werden übersprungen und NICHT
ge-ackt (Mandantentrennung / Selbstheilung nach Mapping).

## Webhook-Ereignisse (`channex_webhook_event`, Migration 0132)

Abonniert ist das volle Event-Set (inkl. `booking_unmapped_room/rate`,
`sync_error`/`rate_error`, `reservation_request`/`alteration_request`/`inquiry`
(Airbnb), `review`, Kanal-Statuswechsel). Ereignisse mit Operator-Relevanz
werden tenant-scoped persistiert (`GET /events`, `POST /events/{id}/resolve`;
Realtime-Publication für die Live-Liste). `ari`-Webhooks stoßen einen
`import_ari_property`-Job an (Webhook = Trigger, Daten werden gepullt —
Channex garantiert keine Reihenfolge).

## Full-Sync-Push DB→Channex

`full_sync_property` (Worker-Job): Availability über den 365-Tage-Horizont als
RLE-Ranges in einem gebatchten Push + Recompute-Enqueue für Preise/Min-Stay.
Nächtlich je aktiver Property (UTC-Fenster `FULL_SYNC_HOUR_UTC`, dedup je
Property+Tag, gestaffelt) — Channex-Doku: „daily full update each night per
property". Manuell: `POST /properties/{map_id}/full-sync`.

## Löschkette („break the chain")

- Entfernte lokale Preispläne werden beim Content-Sync auch in Channex gelöscht
  (`_prune_orphan_rate_plans`) — fail-closed OHNE force: hängt der Plan noch an
  einem Kanal, bleibt das Mapping bestehen und der Konflikt wird geloggt.
- `disconnect_property` deaktiviert VOR dem Soft-Delete alle Channex-Kanäle des
  Objekts (sonst verkauft die OTA blind weiter); Channex räumt die Property nach
  90 Tagen ohne Kanal selbst ab (Retention).

## Hotel Policy

`_sync_hotel_policy` (Teil des Content-Syncs) legt die Channex-Hotel-Policy an
(`channex_property_map.channex_hotel_policy_id`), sobald ALLE Pflichtfelder
lokal gepflegt sind: `type_attributes.policies.checkInTime/checkOutTime` +
`type_attributes.policies.hotelPolicy.{internetAccessType, internetAccessCoverage,
parkingType, parkingReservation, parkingIsPrivate, petsPolicy,
petsNonRefundableFee, petsRefundableDeposit, smokingPolicy}` (optional:
`internetAccessCost`, `adultsOnly`). Unvollständig → Skip mit Log, keine
erfundenen Defaults. Pflicht für Google-Kanal/Instant-Booking-Readiness.

## OTA-Zusatzflächen (`ota_extras.py`)

Alle tenant-gescopt über die Channex-Property-IDs des Tenants (Wurzel 3):

- **Reviews**: `GET /reviews`, `POST /reviews/{id}/reply`,
  `POST /reviews/{id}/guest-review` (Airbnb), `GET /properties/{map_id}/scores`.
- **Availability Rules** (close_out/availability_offset/max_availability je
  Kanal): CRUD unter `/properties/{map_id}/availability-rules` bzw.
  `/availability-rules/{rule_id}`.
- **Reporting (Booking.com)**: `POST /bookings/{id}/report/no-show`,
  `/report/invalid-card`, `/report/cancel-invalid-card`.
- **Message-Threads** (inkl. Airbnb-Inquiries ohne Buchung): `GET /threads`,
  `GET|POST /threads/{id}/messages`, `POST /threads/{id}/close`,
  `POST /threads/{id}/no-reply-needed` (nur Booking.com).
- **Booking CRS** (Beta): `POST /crs/bookings`, `PUT /crs/bookings/{id}` —
  PMS-Änderungen an (auch OTA-)Buchungen nach Channex zurückspiegeln.
- **Gäste-Chat freischalten**: `GET /chat-app` (Status je Objekt),
  `POST /chat-app/{property_id}` (installieren, kostenpflichtig, idempotent).

## Wie die Gastnachricht vom Portal in den Posteingang kommt

Belegt aus der Anbieter-Doku (Messages Collection, Webhook Collection,
Applications API) und live gegengeprüft.

1. **Freischaltung je Objekt.** Der Chat ist eine kostenpflichtige „Application"
   (`channex_messages`), die an der Property installiert sein MUSS. Fehlt sie,
   antwortet `GET /bookings/{id}/messages` mit **403** — nicht mit einer leeren
   Liste. Unterstützt sind nur Booking.com, Airbnb und Expedia (Expedia nicht
   über EAN/Affiliate-Buchungen).
2. **Webhook als Klingel.** Der globale Webhook enthält das Event `message`
   (Nutzlast: `payload.booking_id`, `message_thread_id`, `sender`, `message`,
   `ota_message_id`). Er wird NICHT als Datenquelle verwendet: die Doku sagt
   ausdrücklich, dass Webhooks in beliebiger Reihenfolge eintreffen können.
3. **Ziehen statt annehmen.** Der Verlauf wird beim Öffnen des Threads live
   geholt (`GET /bookings/{channex_booking_id}/messages`) — Felder `message`,
   `attachments`, `sender` (`guest`|`property`), `inserted_at`. Nichts davon
   liegt bei uns gespiegelt; die Wahrheit bleibt beim Portal.
4. **Antwort zurück.** `POST /bookings/{id}/messages` (Anhänge zuerst als
   `POST /attachments`, dann als `attachment_id` senden).
5. **Ohne Buchung.** Airbnb-Anfragen („Inquiry") erzeugen einen Thread ohne
   Buchung — dafür `GET /message_threads` samt `/messages`.

Der Ereignisblock „Gast macht Buchung" im Verlauf ist KEINE Nachricht, sondern
der Lebenslauf der Reservierung: Zeitpunkt aus `channex_booking.ota_inserted_at`
(Eingang der ersten Booking Revision, write-once via 0261), Kanal aus `ota_name`,
und — wenn das Portal sie mitschickt — der Buchungszeitpunkt aus der
OTA-Originalmeldung (`raw.raw_message.date`/`time`, bei Booking.com Ortszeit,
deshalb unverändert als Text). Unsere eigene Importuhr (`created_at`) wird nur
noch verwendet, wenn keine Portal-Angabe existiert — und dann sichtbar als
solche ausgewiesen.
