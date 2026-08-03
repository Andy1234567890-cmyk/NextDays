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

**Zahlungsweg → Bezahlt-Status (0240/0268):** Kein Portal liefert ein eigenes
„bezahlt"-Feld — übermittelt wird nur der Zahlungsweg (`payment_collect`
= „ota" heißt laut Aggregator-Doku „guest already pay at OTA"). Der Import
leitet daraus den Status ab (Branchenstandard, vgl. Hostaway/Beds24): bei
`payment_collect='ota'` — oder einer virtuellen Kreditkarte
(`guarantee.is_virtual`, Booking.com lässt `payment_collect` oft leer),
oder Kanal Airbnb (kassiert IMMER selbst, meldet aber weder Feld noch
VCC; Kanal-Regel 0271) —
werden `paid_amount = total_amount` und `payment_status='paid'` gesetzt;
Modifikationen ziehen den Betrag nach, ein expliziter Wechsel auf
`property` nimmt nur den abgeleiteten Zustand zurück, eine Folge-Revision
ohne das Feld ist KEIN Wechsel (zieht aber eine Preisänderung nach). Auch
ein Storno nimmt den abgeleiteten Zustand zurück (das Portal erstattet).
Nach Check-out sind die Zahlfelder eingefroren (Schlussrechnung).
Vom Portal einbehaltene Steuern (`collected_taxes` je Zimmer, nur
Booking.com) werden als Summe in `reservations.ota_withheld_taxes` (0270)
geführt — die Auszahlung ist Brutto − Provision − einbehaltene Steuern.
Zahlungsgebühren von Payments by Booking.com sind in der Aggregator-Doku
NICHT strukturiert spezifiziert — kein geratenes Parsing; die Roh-Payloads
liegen in `channex_booking.raw`, sobald echte Gebühren-Revisionen deren
Struktur zeigen, wird das Feld nachgezogen.

## Steuern → Channex (`tax_sync.py`)

Quelle sind die Objekt-Steuern (`type_attributes.pricing.taxes`); Idempotenz
über `channex_tax_map` (unique `property_id, local_tax_id`). Abgeleitet wird:

| unsere Steuer | Channex `logic` |
|---|---|
| `mode=percent` | `percent` |
| `amount` + `SingleCharge`/`PerStay` | `per_booking` |
| `amount` + `SingleCharge`/`PerNight` | `per_night` |
| `amount` + `PerPerson`/`PerStay` | `per_person` |
| `amount` + `PerPerson`/`PerNight` | `per_person_per_night` |

Ohne gespeicherte Basis (Altbestand) bleibt es bei `per_night` — dem
bisherigen Verhalten. Der `type` kommt aus der Steuerart: ortsbezogene Abgaben
(`TouristTax`, `TourismAssessment`, `TransientOccupancyTax`) → `city tax`,
Beherbergungs-/Zimmersteuern → `tax`; ohne Steuerart entscheidet weiter `kind`.
Als Titel geht der gastseitige Name (`names[locale]`) ans Portal.

Gegenzustand (Wurzel 1): eine im Objekt GELÖSCHTE Steuer wird bei Channex per
`DELETE /taxes/:id` entfernt (der dokumentierte Weg — ein leeres `taxes: []` am
Tax-Set ist KEIN Ersatz, dort ist `taxes` Pflichtfeld) und danach das Mapping
stillgelegt; erst löschen, dann Mapping schließen, sonst bliebe eine Steuer am
Portal aktiv, auf die wir keinen Zugriff mehr hätten. Ist die letzte Steuer
entfernt, wird das Tax-Set gelöscht (`_drop_tax_set`). Ein bereits
verschwundener Datensatz (404) gilt als erledigt.

**Zwei Sync-Wege.** Ändern sich AUSSCHLIESSLICH die Steuern, reiht
`properties.update` den schlanken Job `sync_property_taxes` ein
(`sync_taxes_only`, 2 Channex-Calls) statt des vollen Content-Syncs (~6:
Property, Room-Type, Rate-Plan, Tax, Tax-Set, Hotel-Policy). Die Entscheidung
trifft `properties.steuern.nur_steuern_geaendert` per Alt/Neu-Diff — bewusst
konservativ: jede Unsicherheit führt zum vollen Sync, der die Steuern ohnehin
mitnimmt. Nie beides. Ohne registriertes Objekt (kein `channex_property_map`)
meldet der schlanke Pfad `no_mapping` und tut nichts — die Property muss erst
der volle Sync anlegen.

**Heilung.** Schlägt ein Content-Push endgültig fehl (10 Versuche, ~5 h), holte
ihn früher NICHTS nach: der Tenant-Reconcile spiegelt nur Channex→DB, der
nächtliche Full-Sync ist reines ARI. Der stündliche Tick
`worker._enqueue_failed_content_syncs` reiht deshalb alle Objekte mit
`channex_property_map.last_sync_status='error'` erneut ein (max. 50 je Lauf).

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

## Wie viel wird verkauft? — die Einheiten (0265/0266/0267)

Ein Objekt ist der Einheiten-TYP; darunter hängen seine identischen Einheiten
(`property_units`). Verfügbarkeit geht deshalb als STÜCKZAHL raus, nicht als
0/1: `einheiten.freie_einheiten_spannen` liefert zusammenhängende Spannen
gleicher freier Zahl, gerechnet aus `availability` (eine Zeile je Einheit und
Tag, `unit_id` seit 0266). Eine eingehende OTA-Buchung bekommt über
`core.einheiten.freie_einheit` die erste freie Einheit, sperrt nur deren Tage
und trägt sie in `reservations.unit_id`; ist keine frei, wird der ganze Typ
gesperrt und `ota_buchung_ohne_freie_einheit` geloggt — lieber alles zu als
eine belegte Einheit doppelt vergeben.

## Wer teilt sich eine Portal-Kennung? — das Gebäude (0264)

Nicht die Betriebsart. Objekte mit demselben `properties.building_id` landen
unter EINER Channex-Property (eine Booking-Unterkunft mit mehreren Einheiten,
jede Einheit ein Room-Type mit eigener Rate); Objekte ohne Gebäude bekommen je
eine eigene Property. Umgesetzt in `content_sync._existing_building_channex_property`
(Wiederverwendung beim Anlegen) und `channels._register_building_units`
(beim Verbinden alle Einheiten des Hauses registrieren, damit die Zuordnungs-
liste vollständig ist). Der Gebäudename trägt den Titel der geteilten Property —
sonst hieße sie wie die zuletzt gesyncte Einheit.

## Preisänderung je Portal (0272)

Lodgify-Modell: jede Portal-Verbindung kann einen prozentualen Aufschlag auf
ihre Tagespreise tragen (Booking +15 %, Airbnb +18 %, …). Umgesetzt als
automatisch gepflegter **Kanal-Plan**: ein abgeleiteter Rate-Plan (derived vom
Grundpreis-Plan, `offset_percent` = Aufschlag, `rate_plans.portal_scope` =
Portal-Code), dessen Channex-Rate am Kanal dieses Portals die Standard-Rate
ERSETZT (`_selected_rate_plan_ids` + `_swap_channel_rate_plan`). Dadurch wirkt
der Aufschlag auf die komplette effektive Tageskurve inkl. Dynamic Pricing —
über die vorhandene derived-Kurve, kein eigener Push-Pfad. Gepflegt über
`PUT /properties/{id}/connections/{portal}/price-adjustment` (0 % = Kanal-Plan
+ Mapping-Rückbau); UI: Objekt-Preise-Seite (Hauptpflege, alle Portale) und
Sync-Seite (Spalte „Preisänderung", editierbar). Der frühere „Mark-up"-Block
(`property_pricing_config.markup`) war eine Attrappe (wirkte nirgends) und
wurde ersatzlos entfernt.

## Zwei Blickrichtungen auf dieselbe Zuordnung

Dieselbe Verbindung wird von beiden Seiten gebraucht, deshalb gibt es sie
zweimal — nicht doppelt gepflegt, sondern aus derselben Quelle:

- **Portal → Objekte**: `GET /channels/{portal_code}/detail`, Oberfläche
  `/channels/[code]`. Alle Objekte eines Portals untereinander.
- **Objekt → Portale**: `GET /properties/{property_id}/connections`,
  Oberfläche `/objekte/[id]/synchronisierung`. Alle Portale eines Objekts,
  mit den Kennungen in der Schreibweise des Extranets (`hotel_id | room_code`).
- **Objekt × Portal**: `GET /properties/{property_id}/connections/{portal_code}`
  (`objekt_kanal.py`), Oberfläche `/objekte/[id]/synchronisierung/[portal]`.
  Kennungen, Verkaufsschalter (`is_active`), letzter Abgleich, Vollsync.

Keine Preise/Tarifpläne in dieser Ansicht (die führt das Kalender-Rate-Grid)
und keine „Inserats-Qualität": Channex führt kein solches Maß (die API kennt
„score" nur bei Gästebewertungen; `/properties/{id}/scores` antwortet 404).

## OTA-Zusatzflächen (`ota_extras.py`)

Alle tenant-gescopt über die Channex-Property-IDs des Tenants (Wurzel 3):

- **Reviews**: `GET /reviews`, `POST /reviews/{id}/reply`,
  `POST /reviews/{id}/guest-review` (Airbnb), `GET /properties/{map_id}/scores`.
  Der Property-Filter bekommt NUR echte UUIDs (`common.nur_uuids`): der
  Demo-Seed legt Zuordnungen mit synthetischen IDs an (`demo-0bca947c-…`), und
  Channex lehnt bei EINEM ungültigen Wert den ganzen Request mit
  `422 filter is_invalid` ab — dann kommt keine einzige Bewertung mehr durch
  (live beobachtet). Portal-Fehler werden übersetzt, nicht durchgereicht:
  „is invalid" hat im Kundentext nichts zu suchen.
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
- **Gäste-Chat**: keine eigene Route und kein Knopf — die Chat-Anwendung wird
  beim Verbinden gesetzt (`property_mapping._chat_freischalten`), im Reconcile
  nachgezogen (`_chat_nachziehen`) und beim ersten 403 im Posteingang sofort
  installiert und der Abruf wiederholt (`inbox._portal_nachrichten`).

## Bewertungs-Spiegel (`reviews_sync.py`, Migration 0262)

Portal-Bewertungen liegen als eigener Bestand in `channex_review` — ohne den
gäbe es kein „unbeantwortet"-Filter, keine Kennzahl über Kanäle hinweg, kein
Realtime, und jeder Seitenaufruf kostete Portal-Requests.

- **Auslöser** ist der Webhook (`review` / `updated_review`, seit jeher im
  `event_mask`). Wie überall gilt: der Webhook ist NUR das Signal — den Stand
  zieht `sync_single_review` per `GET /reviews/{id}` nach, weil Channex keine
  Reihenfolge zusichert.
- **Backstop** ist der stündliche Worker-Tick (`REVIEWS_TICK_SECONDS`), der
  kontoweit spiegelt und verlorene Webhooks abfängt.
- **Upsert auf `channex_review_id`** (Wurzel 2). Die eigenen Arbeitsfelder
  (`is_read`, `is_archived`, `assigned_user_id`) stehen bewusst NICHT im
  Datensatz — ein erneuter Abgleich darf sie nicht zurücksetzen (Wurzel 1).
- **Fail-closed**: eine Zeile ohne belegbare Objekt-Zuordnung landet bei
  KEINEM Mandanten (der Channex-Account ist kontoweit, white-label).

Verwendet wird der Bestand vom Slice `reviews` (Cockpit über alle Kanäle).

## Wie die Gastnachricht vom Portal in den Posteingang kommt

Belegt aus der Anbieter-Doku (Messages Collection, Webhook Collection,
Applications API) und live gegengeprüft.

1. **Freischaltung je Objekt.** Der Chat ist eine „Application"
   (`channex_messages`), die an der Property installiert sein MUSS. Fehlt sie,
   antwortet `GET /bookings/{id}/messages` mit **403** — nicht mit einer leeren
   Liste. Sie wird automatisch gesetzt (Verbinden → Reconcile → Selbstheilung
   beim Lesen/Senden); für den Betrieb gibt es dabei nichts zu tun. Unterstützt
   sind nur Booking.com, Airbnb und Expedia (Expedia nicht über
   EAN/Affiliate-Buchungen); andere Kanäle antworten 422 `not_supported`.
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
