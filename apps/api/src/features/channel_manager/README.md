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

Staging und Produktion sind **zwei getrennte Channex-Installationen** (getrennte
Konten, Objekte, Kanäle, Webhooks, Schlüssel). Umgeschaltet wird ausschließlich
über `CHANNEX_BASE_URL` (`channex_client.py:193`) — Reihenfolge, Grenzen und
Fallstricke: `deploy/CHANNEX-GO-LIVE.md`.

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

## Buchungshistorie je Objekt (`airbnb_historie*.py`, 06.08.2026)

Der Feed oben liefert nur, was Channex selbst als Revision gesehen hat. Alles,
was VOR dem Verbinden gebucht wurde, kennt es nicht — live gemessen am
Beta-Konto:

| Quelle | Buchungen |
|---|---|
| Channex `GET /bookings` je Objekt (6 geprüft) | 0 |
| Channex Revisions-Feed | 0 |
| `channex_booking` (Staging) | 0 |
| Airbnb `GET v2/reservations` | **462** (04/2022–07/2027, 41 Inserate) |

Deshalb der direkte Weg, wie schon bei Stammdaten/Fotos. Drei Module, damit
Lesen und Schreiben getrennt testbar bleiben:

- `airbnb_historie.py` — liest etappenweise bei Airbnb (nur GET)
- `airbnb_historie_import.py` — schreibt Reservierung, Gast, Kalender
- `airbnb_historie_dienst.py` — Route-Einstieg: Vorschau und Import

**Die drei API-Eigenheiten, die den Aufbau bestimmen** (alle live gemessen, KEINE
aus der Doku übernommen — jede verschluckt sonst still Buchungen):

1. `start_date` reicht ab dem Datum **genau ein Jahr** weit, dann endet der
   Cursor. Ein einziger Aufruf für 2020–heute liefert nur das erste Jahr.
2. `_limit` über 50 antwortet **200 mit leerer Liste** — kein Fehler. Wer 100
   anfragt, glaubt, es gäbe nichts.
3. `_offset` wird ignoriert; geblättert wird über `paging.next_cursor`.

**Etappen und ihre Belegung:** Schrittweite 3 Monate bei 12 Monaten Reichweite ⇒
jede Buchung liegt in vier Etappen. Gegenprobe gefahren:

| Teilung | Buchungen | Etappen | HTTP-Aufrufe |
|---|---|---|---|
| Quartalsschritte | 462 | 36 | 63 |
| Monatsschritte | 462 | 108 | 187 |

Die feinere Teilung findet **null** zusätzliche Buchungen — Quartalsschritte sind
nachweislich lückenlos. Dedup über `confirmation_code` (Wurzel 2).

**Nur das eigene Inserat:** gefiltert wird auf `properties.airbnb_listing_id`.
Von den 462 Buchungen liegen 322 auf 23 Inseraten, die es bei uns nicht als
Objekt gibt (`GET v2/listings/{id}` → 403, vom Betrieb archiviert/abgegeben) —
sie werden gezählt und gemeldet, aber nicht geschrieben.

**`vollstaendig` ist kein „hat geklappt":** false, sobald EINE Etappe scheitert.
Ein Lauf mit 26 von 27 Etappen darf sich nicht „fertig" nennen, sonst fehlen
Buchungen, ohne dass es jemand merkt (Wurzel 5).

**Bewusste Festlegungen:** Historie wird OHNE rückwirkende Provisions-/
Auszahlungsbuchung übernommen (kein Eingriff in ein abgeschlossenes
Geschäftsjahr). Ein vergangener Aufenthalt wird `completed`, nicht `confirmed`.
Die Buchung belegt GENAU EINE Einheit (sonst wären bei fünf gleichen Studios
vier fälschlich dicht). Airbnb liefert im Reservierungs-Payload keinen
Gastnamen — nur `guest_id` und Personenzahlen; der Name steht im Thread
(`users[].first_name`), ohne Thread bleibt der Gast Platzhalter mit
`needs_review` (Wurzel 4: kein erfundener „Gast von Airbnb").

**Kein Upsert auf `source_channex_booking_id`** (live gescheitert, `42P10`): der
Index `reservations_source_channex_uidx` ist PARTIELL
(`WHERE source_channex_booking_id IS NOT NULL`), und darauf lässt PostgREST
keine ON-CONFLICT-Klausel zu. Deshalb explizit update-oder-insert; der Index
bleibt der Backstop gegen Doppelanlage bei zwei gleichzeitigen Läufen.

**Fortschritt je Etappe** (`POST …/historie/etappe?nummer=N`): Der Gesamt-Import
läuft über eine Minute; als EIN Request bliebe die Oberfläche so lange stumm.
Die Oberfläche fährt deshalb Etappe für Etappe und zeigt jede Zeile, sobald sie
fertig ist. Der Aufruf bekommt `bekannt` (die Codes der vorherigen Etappen) —
ohne das zählte die vierfache Überlappung dieselbe Buchung mehrfach als „neu";
auf die WIRKUNG hat die Liste keinen Einfluss (geschrieben wird ohnehin
idempotent über den Code). `uebernehmen=false` ist der Vorschau-Modus.

**Nachrichten:** `GET v2/threads/{id}/messages` (live 14 Nachrichten gelesen).
NICHT der naheliegende Weg — `v2/messages` gibt es nicht (404), und der Thread
liefert seine Nachrichten auch mit `_format=for_api_partners_with_posts` nicht
mit. Die Leseroutine steht; die lokale Spiegelung braucht noch eine Tabelle.

## Steuern und Gebühren → Channex (`tax_sync.py` + `ota_abgaben.py`)

Quelle sind die Objekt-Steuern (`type_attributes.pricing.taxes`) UND die
Gebühren (`…pricing.fees`). **WAS an welches Portal geht, steht in
`ota_abgaben.py`** — dem Branchenstandard als Regelwerk. `tax_sync.py` sagt nur,
WIE es zu Channex kommt.

Steuer und Gebühr sind bei Channex **dasselbe Objekt** (`/taxes`, unterschieden
nur durch `type` ∈ `tax` | `fee` | `city_tax`), deshalb ein gemeinsamer Pfad.

### Jedes Portal bekommt sein EIGENES Channex-Objekt

Channex führt `is_inclusive` und `logic` **an der Steuer**, nicht am Tax-Set. Ein
gemeinsames Objekt könnte deshalb nicht gleichzeitig „bei Booking im
Zimmerpreis" und „bei Airbnb getrennt ausgewiesen" sein. Genau daran scheiterte
der frühere Aufbau: der Widerspruch wurde nur protokolliert und eine Seite still
falsch bespielt.

Darum trägt `channex_tax_map` seit 0274 eine **`portal_scope`**-Achse
(`NULL` = portalneutrales Objekt im Standard-Set). Der Schlüssel ist
(Objekt, lokale Kennung, Portal); die Kennung ist eine Steuer-/Gebühren-ID oder
`cat:<kategorie>` für eine je Kategorie summierte Airbnb-Gebühr.

### Die Matrix (Branchenstandard, live gemessen 03.08.2026)

|              | Gebühren | Steuern |
|---|---|---|
| **Airbnb** | Kategorie×Berechnungsmodell (Tabelle unten); gleiche Kategorie wird zu EINER summiert; gemischte Modelle → gar nicht | Prozent ✔; Betrag **nur** „pro Gast pro Nacht"; **getrennt** vom Zimmerpreis; hängt am Steuererhebungsszenario |
| **Booking.com** | **nur Prozent**, **im** Zimmerpreis | **nur Prozent**, **im** Zimmerpreis |
| **Expedia** | nichts | nichts |
| **HomeAway/Vrbo** | Prozent und Betrag, getrennt, keine Summierung | Prozent und Betrag, getrennt |
| *alle anderen* | unverändert alles, `is_inclusive` wie am Objekt gepflegt | dito |

⚠️ **Vrbo ist NICHT verdrahtet**: der Channex-Kanalkatalog führt diesen Kanal
nicht (live geprüft, 52 Kanäle — kein Vrbo/HomeAway). Ein Portal-Code dafür wäre
erfunden. Die Regel steht in `ota_abgaben.py` als Kommentar, damit sie beim
Auftauchen des Kanals nur eingetragen werden muss.

**Airbnb-Exporttabelle** (Kategorie → erlaubte Berechnungsmodelle):

| Airbnb-Kategorie | pro Aufenthalt | pro Nacht | pro Gast/Aufenthalt | pro Gast/Nacht | Prozent erlaubt |
|---|---|---|---|---|---|
| Reinigung | ✅ | ❌ | ❌ | ❌ | ❌ |
| Haustier | ✅ | ❌ | ❌ | ❌ | ❌ |
| Wäsche | ✅ | ❌ | ✅ | ❌ | ❌ |
| Gemeinschaft | ✅ | ✅ | ✅ | ✅ | ✅ |
| Verwaltung | ✅ | ✅ | ✅ | ✅ | ✅ |
| Resort | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kaution / Unbekannt | ❌ (steht nicht in der Exporttabelle) | | | | |

Die 49 Gebührenarten und ihre Kategorie stehen in
`properties/gebuehren.py FEE_TYPE_CATEGORY` (live aus dem Standard abgelesen);
das Auswahlfeld holt sie über `GET /properties/fee-types` — eine Quelle.

### Logic-Abbildung

| unsere Steuer | Channex `logic` |
|---|---|
| `mode=percent` | `percent` |
| `amount` + `SingleCharge`/`PerStay` | `per_booking` |
| `amount` + `SingleCharge`/`PerNight` | `per_night` |
| `amount` + `PerPerson`/`PerStay` | `per_person` |
| `amount` + `PerPerson`/`PerNight` | `per_person_per_night` |

| unsere Gebühr | Channex `logic` (mit `type: "fee"`) |
|---|---|
| `mode=percent` (jede Basis) | `percent` — Prozent ist **immer einmalig** auf den Zimmerpreis, die Basis multipliziert nichts |
| `per_stay` | `per_booking` |
| `per_night` | `per_night` |
| `per_guest_stay` | `per_person` |
| `per_guest_night` | `per_person_per_night` |

Alle sieben `logic`-Werte sind live auch mit `type: "fee"` geprüft; die feineren
Arten (`cleaning_fee`, `resort_fee`, `pet_fee`, `service_fee`) lehnt Channex mit
422 ab — unsere Gebührenart lebt deshalb im **Titel**, nicht im Typ. Bei einer je
Kategorie summierten Airbnb-Gebühr ist der Titel die Kategorie („Gemeinschafts-
gebühr"), weil mehrere Gebühren darin aufgehen.

**Optionale Gebühren gehen nicht raus** (`fees[].optional`): beim Portal könnte
der Gast sie nicht abwählen, dort wären sie ein Pflichtaufschlag.

**Kaskade (`level`) = Steuerbemessungsgrundlage.** Channex rechnet von der
höchsten Zahl zur niedrigsten; Posten auf DERSELBEN Ebene besteuern sich nicht.
Damit wird die Grundlage ausdrückbar: eine Gebühr, deren Kategorie in
`taxes[].taxableBase` steht, liegt auf `level: 1` (wird mitbesteuert), eine
andere auf `level: 0` wie die Steuer. Ohne gepflegte Grundlage liegen alle
Gebühren auf `level: 1` — das bisherige Verhalten. Verlangen zwei Steuern
Verschiedenes, ist das bei Channex nicht abbildbar (die Ebene hängt an der
Gebühr, nicht am Paar): dann wird protokolliert und beim bisherigen Verhalten
geblieben, statt eine Seite still falsch zu bespielen.

Bei Portalen **ohne** Airbnb-Regel liegt keine Gebühr in der Grundlage — „für
alle anderen Kanäle gelten Steuern nur auf den Basispreis" (live abgelesen).
Dasselbe gilt im eigenen Quote (`pricing/resolver._taxable_base`).

Der `type` kommt aus der Steuerart: ortsbezogene Abgaben (`TouristTax`,
`TourismAssessment`, `TransientOccupancyTax`) → `city_tax`, Beherbergungs-/
Zimmersteuern → `tax`; ohne Steuerart entscheidet weiter `kind`. Als Titel geht
der gastseitige Name (`names[locale]`) ans Portal.

⚠️ **`city_tax` mit UNTERSTRICH** — live gegen die Sandbox gemessen
(03.08.2026). Die Channex-Doku schreibt „city tax" mit Leerzeichen, Responses
liefern „City Tax"; beide ergeben bei `POST /taxes` ein
`422 {"type": ["is invalid"]}`. Nicht nach der Doku „korrigieren" — hier gilt die
gemessene Realität.

### Airbnb-Steuererhebungsszenario (0274)

Ob eigene Steuern überhaupt an Airbnb gehen, entscheidet nicht der Betrieb
allein: Airbnb erhebt in manchen Regionen selbst. Drei Werte an der Verbindung
(`channex_channel_connection`):

* `airbnb_tax_scenario` ∈ `ineligible` | `no_collected` | `stacked`
* `airbnb_tax_acknowledged` — „Ich bestätige, dass ich das Szenario verstehe"
* `airbnb_send_user_taxes` — „Benutzungssteuern senden"

Steuern gehen an Airbnb **nur** wenn Szenario gesetzt und ≠ `ineligible` UND
beide Schalter an. **Fail-closed**: ohne erfasstes Szenario keine Steuern. Das
Szenario wirkt ausschließlich auf Steuern — Gebühren gehen unabhängig davon.

⚠️ Channex bietet für das Szenario **kein Feld** (der AirBNB-Kanal deklariert nur
`code`, `email`, `min_stay_type`, `rate_plans_enabled`,
`send_email_notifications`, `booking_amount_settings`,
`cohost_payout_calculations`). Es ist deshalb ein gepflegter Wert, kein
gelesener — im Standard liest die Software ihn direkt bei Airbnb aus.

Endpunkt: `PUT /properties/{id}/connections/{portal}/airbnb-tax`. Die Änderung
stößt den Steuer-Sync direkt an (Wurzel 1).

### Kanal-Einschränkung: n Tax-Sets je Objekt (0273)

Eine Steuer/Gebühr soll nicht immer an jedes Portal. Zieht das Portal die
Ortstaxe selbst ein, zahlt der Gast sie sonst doppelt.

⚠️ **Channex hat dafür KEIN Feld an der Steuer.** Live geprüft (03.08.2026):
`channels`, `excluded_channels`, `restrict_to_channels`, `channel_codes` und
`ota_ids` werden bei `POST /taxes` alle mit **201 angenommen und still
verworfen** — keines erscheint im Readback. Nicht daran weiterbauen.

Die einzige echte Achse ist **`tax_set_id` am Rate-Plan**, und ein Objekt darf
mehrere Tax-Sets haben. Also:

* **Standard-Set** → alle Rate-Plans ohne `portal_scope`. Es ist der Weg zu
  jedem Kanal ohne eigenen Plan, deshalb bleibt ein eingeschränkter Posten hier
  draußen.
* **Portal-Set je Kanal-Plan** (`rate_plans.portal_scope`, 0272) → nur die für
  dieses Portal erlaubten Posten. Fehlt der Kanal-Plan für ein Portal mit
  Sonderregel, legt der Sync ihn selbst an (`offset_percent = 0`).

`portalScope` an Steuer/Gebühr zählt auch die **eigenen Buchungsstrecken** mit
(`direct` = Website, `portal` = myBestDays) — der Preis-Resolver liest dieselbe
Einschränkung, damit eine Gebühr „nur an Booking" nicht in einer Direktbuchung
auftaucht.

`channex_tax_set_map` (0273) merkt sich, welches Channex-Set zu welchem Portal
gehört (`portal_scope IS NULL` = Standard). **Kein `upsert`/`on_conflict`**: die
Unique-Indizes sind partiell (`where portal_scope is not null` bzw. `is null`),
und Postgres akzeptiert für `ON CONFLICT` nur einen Index ohne `WHERE` — live
bestätigt mit `42P10`. Stattdessen stillgelegte Zeile reaktivieren oder neu
einfügen.

Fällt ein Kanal-Plan weg oder will kein Ziel einen Posten mehr, räumen
`_prune_portal_tax_sets` und `_prune_verwaiste_abgaben` ihn bei Channex ab. Das
deckt ALLE Wege ab, auf denen ein Posten verschwindet — lokal gelöscht, auf
`optional` gestellt, aus der Export-Matrix gefallen, in einer Kategorie
aufgegangen, Portal getrennt (Wurzel 1).

### Live-Nachweis

`scripts/channex/e2e_abgaben.py` fährt die ganze Matrix gegen die Staging-Sandbox
und liest bei Channex zurück (91 Prüfungen): Posten je Portal, `logic`, `type`,
`rate`, `is_inclusive`, Kaskadenebene, Szenario-Sperre und das vollständige
Abräumen. „HTTP 200" ist bei Channex kein Beweis — nur das Readback ist einer.

### Steuerregime automatisch erkennen (`tax_regime.py`)

Wie eine Steuer an ein Portal gehört, ist **keine Einstellung im Frontend**: der
Betrieb kann nicht wissen, dass Agoda „Inclusive With Commissions" kennt. Die
Information liefert Channex selbst — der Kanal-Katalog deklariert je Kanal seine
Steuer-Parameter, und der verbundene Kanal trägt den gewählten Wert.

Live gemessen (03.08.2026), welche Kanäle überhaupt ein Steuerfeld haben:

| Kanal | Feld | Werte |
|---|---|---|
| Agoda | `booking_tax_settings` | Inclusive, Inclusive With Commissions, Exclusive |
| CTrip | `booking_tax_settings` | Inclusive, Exclusive |
| AirBNB | `booking_amount_settings` | **Payout Amount** (Default), Total Paid Amount |
| Expedia | `booking_amount_settings` | Collect Amount, Total Amount, Total Amount Excluding Tax |
| Goibibo | `booking_amount_settings` | Payout Amount, Total Amount |
| Hostelworld, Ostrovok | `booking_amount_settings` | With/Without Commission (**Provision, keine Steuer**) |

Booking.com deklariert **kein** Steuerfeld → Standardverhalten.

Daraus wird abgeleitet: `Payout Amount`/`Collect Amount` → **nicht senden** (das
Portal rechnet die Steuer selbst zum Gastpreis; das ist der Airbnb-Fall, und
`Payout Amount` ist dort der Default). `Exclusive`/`Total Amount Excluding Tax`
→ `is_inclusive: false`. `Inclusive`/`Total Amount`/`Total Paid Amount` →
`is_inclusive: true`. Ein **unbekannter Wert wird nicht geraten** (Wurzel 4):
Standardverhalten plus Warnung, damit ein neuer Channex-Wert auffällt.

Damit die Einschränkung greifen kann, braucht das Portal einen eigenen
Kanal-Plan — ohne ihn hängt es am Standard-Set. Fehlt er, protokolliert der Sync
`channex_steuer_doppelt_moeglich_ohne_kanalplan`, statt stumm falsch zu senden.

**Löschkette (Wurzel 1).** Eine im Objekt entfernte Steuer muss auch beim
Portal weg — sonst kassiert Booking eine Kurtaxe weiter, die es hier nicht mehr
gibt. Channex verkettet die Objekte dabei dreifach; die Reihenfolge ist
komplett live ermittelt (03.08.2026), **nichts davon steht in der Doku**:

1. `PUT /properties/:id {"default_tax_set_id": null}` — sonst
   `Can't remove Tax Set used as default at Property`
2. `PUT /tax_sets/:id {"associated_rate_plan_ids": []}` — sonst
   `Can't remove TaxSet associated with at least one RatePlan`;
   `taxes` muss dabei MITgeschickt werden, sonst `taxes: can't be blank`
3. `DELETE /tax_sets/:id`
4. `DELETE /taxes/:id` — geht erst jetzt, vorher
   `can't be remove because used at TaxSet`

Erst danach wird das Mapping stillgelegt (`deleted_at`): wäre es umgekehrt,
bliebe eine Steuer am Portal aktiv, auf die wir keinen Zugriff mehr hätten. Ein
bereits verschwundener Datensatz (404) gilt als erledigt. Wird dieselbe
UI-Kennung später wieder verwendet, setzt der Upsert `deleted_at` zurück — der
Unique-Index `(property_id, local_tax_id)` kennt kein `deleted_at`, ohne das
Zurücksetzen bliebe die Zeile unsichtbar und die Steuer würde bei Channex ein
zweites Mal angelegt (Wurzel 2).

`_prune_removed_taxes` bekommt Steuern **und** Gebühren: beide liegen in
derselben `channex_tax_map`, und was dort nicht als „noch aktuell" gilt, wird
gelöscht. Ohne die Gebühren-Liste löschte jeder Lauf die gerade angelegten
Gebühren sofort wieder.

**Zwei Sync-Wege.** Ändern sich AUSSCHLIESSLICH Steuern oder Gebühren, reiht
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

## Promotions an die Portale — zwei Wege (`ota_aktionen.py` + `airbnb_aktionen.py`)

Eine Promotion (`property_discounts`) erreicht ein Portal auf genau einem von zwei
Wegen. Sie schließen sich nach Konstruktion aus, ein Gast kann also nie beide
bekommen: Weg 1 verlangt, dass KEINE buchungsbezogene Bedingung gesetzt ist,
Weg 2, dass GENAU EINE gesetzt ist.

**Weg 1 — Tagespreis (`ota_aktionen.py`).** Der gesendete Preis der betroffenen
Tage ist niedriger. Trägt JEDES Portal. `aktionsfaktor_je_tag()` liefert
`{ISO-Tag: Faktor}` (bester Einzelrabatt, kein Stacking, portal-scope-bewusst);
`ari_push._aktionen_einrechnen()` teilt die Segmente an den Faktor-Grenzen und
rechnet sie ein — an EINER Stelle (`push_rates_batch`) plus in der Soll-Kurve des
Reconcilers, damit der Abgleich den Rabatt nicht zurücknimmt. Ein Ladefehler
ergibt ein LEERES Ergebnis: dann geht der ungerabattete Preis raus (zu wenig
verlangt ist Geldverlust, den niemand sieht).

**Weg 2 — Airbnbs eigene Rabattregeln (`airbnb_aktionen.py`).** Mindestaufenthalt,
Frühbucher und Last Minute hängen an der BUCHUNG, nicht am Tag — über den
Tagespreis wären sie nur zu haben, indem man sie jedem Gast gibt. Airbnb kennt sie
als eigenes Objekt, Channex gibt es durch:
`GET|PUT /channels/{id}/mappings/{mapping_id}/pricing_settings` mit
`default_pricing_rules: [{rule_type, price_change, threshold_one}]`.

| unsere Bedingung | `rule_type`                    | Grenze                          |
| ---------------- | ------------------------------ | ------------------------------- |
| `min_nights`     | `STAYED_AT_LEAST_X_DAYS`       | ≥ 1, nur Preismodell `standard` |
| `lengthPrices[]` | `STAYED_AT_LEAST_X_DAYS`       | dito (Prozent abgeleitet)       |
| `lead_min_days`  | `BOOKED_BEYOND_AT_LEAST_X_DAYS`| Vielfaches von 28 ODER 30       |
| `lead_max_days`  | `BOOKED_WITHIN_AT_MOST_X_DAYS` | 1–28 Tage                       |

**Preise nach Aufenthaltsdauer laufen über DENSELBEN Weg.** Ein Wochen-/Monats-
preis IST ein Längenrabatt; er wird deshalb in die Form einer Aktion gebracht
(`aktion_aus_laengenpreis`) und durch dieselbe Pipeline geschickt — dann gelten
automatisch dieselben Airbnb-Grenzen, und ein Längenpreis konkurriert mit einer
Aktion um die EINE Regel dieser Art (höherer Rabatt gewinnt, wie im Resolver).
Zwei Dinge sind dabei ehrlich zu benennen: Airbnbs Regel ist PROZENTUAL, unser
Längenpreis absolut — der Prozentsatz kommt aus dem Grundpreis des Objekts
(`rate_plans`; bei mehreren Plänen gibt es keinen einen Grundpreis → nicht
darstellbar). Und gerundet wird ABWÄRTS: 8,9 % gehen als 8 % raus, damit bei
Airbnb nie billiger verkauft wird als eingestellt. Bleibt 0 % übrig, wird nichts
gesendet und die Zeile meldet „Manuelle Synchronisierung". Alle anderen Portale
haben für einen Längenrabatt kein Feld und tragen denselben Chip.

`price_change` = Rabatt in ganzen Prozent, 0–99. PUT ersetzt das GANZE Objekt →
immer den GET-Stand als Grundlage nehmen und nur `default_pricing_rules` tauschen,
sonst räumt ein Aktions-Push die Steuer-/Gebühren-Einstellungen des Listings ab
(Wurzel 1). Wir führen die Liste VOLLSTÄNDIG: eine gelöschte oder deaktivierte
Promotion verliert damit ihre Regel wieder. Geschrieben wird nur bei echter
Abweichung (Wurzel 2). Angestoßen wird der Push nach jeder Promotion-Änderung als
Job `sync_airbnb_aktionen` und über
`POST /channel-manager/properties/{id}/aktionen/airbnb-sync` — sowie nach jeder
Änderung an den Preisen nach Aufenthaltsdauer
(`properties.gebuehren.laengenpreise_geaendert`).

Zusätzlich kennt Channex Airbnbs eigene AKTIONSPROGRAMME
(`GET /channels/{id}/promotions`, `POST /channels/{id}/promotions/enable|disable`
mit `{promotion:{listing_id, type}}`): `NEW_LISTING_PROMOTION` 20 %,
`HIGH_RATED_GUEST_DISCOUNT` 15 %, `MOBILE_ONLY_DISCOUNT` 10 % — die Höhe gibt
Airbnb vor, es gibt nur an/aus. Die Client-Methoden liegen bereit
(`channex_client.list_channel_promotions` / `enable_…` / `disable_…`), eine
Oberfläche dafür gibt es noch nicht.

**Herkunft dieser Endpunkte (keine öffentliche Doku).** Ermittelt aus dem
ausgelieferten Channex-Client (`staging.channex.io/assets/index-*.js`, 03.08.2026)
und live gegengeprüft: `GET /channels/{id}/promotions` → **403** ohne verbundenes
Airbnb-Konto (die Route existiert also; ein erfundener Pfad wie
`/channels/{id}/discounts` antwortet **404**), ebenso
`POST /channels/{id}/execute/load_listing_price_settings` → 403. Das Wire-Format
ist snake_case: der Client schickt jeden Body durch einen rekursiven
snakeCase-Mapper und camelCase-t die Antwort erst im Browser zurück. NICHT live
verifizierbar war der Vollzug (PUT `pricing_settings`, `promotions/enable`) — dafür
braucht es ein per OAuth verbundenes Airbnb-Konto, das im Staging fehlt.

### Live-Nachweis (Promotions)

`scripts/channex/e2e_promotions.py` fährt die ganze Kette gegen die Server-DB
(47 Prüfungen, wiederholbar): Anlegen/Ändern/Löschen samt CHECKs und
Singleton-Index, die Rechnung (Grundlage nur Übernachtung, Teil-Aufenthalt je
Nacht, bester Wert in Geld, Code-Vorrang), jede Bedingung einzeln, die
Gast-Buchungsstrecke mit eingelöstem Code bis in `reservations.total_amount`, die
Auswahlliste, beide Portal-Wege samt „Manuelle Synchronisierung" je Portal und die
zwei eingereihten Jobs.

Das Skript verändert KEINE Preise des Testobjekts — es misst den Ist-Stand und
rechnet die Erwartungen daraus. Ein E2E, das die Ausgangslage erst passend macht,
prüft am Ende sich selbst. Der erste Lauf hat prompt einen echten Fehler gefunden:
`_aktionen_status` las `discount_bps` nicht mit und meldete deshalb für JEDE
Aktion mit Bedingung „nur ganze Prozent möglich" — ein Stub-Test kann das nicht
sehen, weil er die Spaltenliste ignoriert.

Was KEINER der beiden Wege trägt — Angebotscode (kein Portal übergibt einen
Gast-Code), Buchungszeitraum (die Airbnb-Regel hat kein Gültigkeitsfenster),
Pauschale (nicht auf Nächte verteilbar, ohne die Aufenthaltsdauer zu raten), zwei
Bedingungen in EINER Promotion, Aufenthaltszeitraum ZUSAMMEN mit einer Bedingung —
wird in der Oberfläche als „Manuelle Synchronisierung" samt Grund gemeldet
(`abgaben_status._aktionen_status`), statt still jedem Portal-Gast den Rabatt zu
geben.

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

## Airbnb-Content: der vollständige Weg (`action/listing_details`)

Hier stand lange, Channex gebe über Airbnb keinen Content heraus. Das war
falsch — der von **Airbnb selbst** dokumentierte Pfad war in den früheren
Messreihen nie geprüft worden (getestet wurden nur `proxy/v2/listings`,
`proxy/v2/calendars`, `channels/{id}/listings`, alle 500/404):

    GET  channels/{channel_id}/action/listings                        → 200
    GET  channels/{channel_id}/action/listing_details?listing_id=…    → 200
    POST channels/{channel_id}/action/api_proxy                       → 200
         {"request":{"endpoint":"listing_descriptions","method":"get",…}}

**Der `action`-Namensraum ist belastbar**, der `execute`-Namensraum daneben nicht:
`action/erfundene_aktion_zzz` → `400 {"details":["action is not supported"]}`,
während `execute/<beliebiger_name>` auf JEDEN Namen mit `200 Success` antwortet.
Wer im `execute`-Raum misst, hält alles für vorhanden.

Live übernommen für alle 18 Objekte des Beta-Betriebs (05.08.2026):

| Airbnb-Feld | unser Ziel | Objekte |
|---|---|---|
| `rooms[]` (+`is_private`, `id`) | `type_attributes.rooms` = `{privat/gemeinschaftlich: {slug: n}}` | 18 |
| `rooms[].beds[{type,quantity}]` | `type_attributes.beds` = `{slug: n}` | **3** |
| `bedrooms`/`beds`/`bathrooms` | `schlafzimmer`/`betten`/`badezimmer` | 18 |
| `total_inventory_count` | `einheiten` (Stückzahl des Typs, 0265) | 1 |
| `booking_settings.cancellation_policy_settings` | `airbnbStorno` (+ unser `modus`) | 18 |
| `booking_settings.instant_booking_allowed_category` | `airbnbSofortbuchung` | 18 |
| `booking_settings.guest_controls.*` | `airbnbGastregeln` | 18 |
| `check_in_time_start/_end`, `check_out_time` | `policies.checkInTime/…End/checkOutTime` | 18 |
| `pricing_settings.standard_fees[]` | `airbnbGebuehren` | 18 |
| `availability_rules` | `airbnbVerfuegbarkeit` | 18 |
| `quality_standards` | `airbnbQualitaet` | 18 |
| `amenities` (+`instruction`, Raumbezug) | `airbnbAusstattung` | 18 |
| `wifi_network`/`wifi_password`, `check_in_option` | `messaging.*` | 8 |
| `listing_descriptions[]` (alle Sprachen) | `airbnbTexte` = `{feld: {locale: text}}` | 18 |

Drei Dinge, die dabei NICHT gehen und warum:

- **Wohnfläche (m²).** Airbnb hat kein Feld dafür — in keinem der zwölf
  Dokumente, und live ist `property_details.listing_size` ein leeres Objekt.
  Lodgifys „30 m²" ist dort von Hand eingetragen.
- **Bundesland/Region.** `state` ist auch hier `null`. Dafür gibt es die
  Rückwärts-Geokodierung aus `lat`/`lng` (`region_geokodierung.py`).
- **Betten, wo der Gastgeber sie nicht pflegt.** 15 der 18 Objekte haben
  `beds: []` in jedem Raum — geprüft über zwei Wege (`listing_details` und
  Airbnbs eigenes `listing_rooms` per Proxy). Aus `beds: 2` ein „Doppelbett" zu
  machen wäre eine Falschaussage über das Objekt (Wurzel 4); die Maske bleibt
  leer.

**Sprachen:** `listing_descriptions` liefert je Sprache einen Eintrag mit
`locale` — bei Objekt 020 drei (de, en, da), die Hausregeln nur auf Deutsch.
Deshalb wird die Sprache NIE angenommen: derselbe Fehler hatte schon die
Bildtexte betroffen (alle unter `en`, die deutsche Oberfläche las `de` und zeigte
Platzhalter).

## Airbnb-Anfragen beantworten (`live_feed`, Migration 0284)

Airbnb schickt drei handlungspflichtige Anfragearten, die KEINE Buchung sind und
deshalb auch keine Buchungs-Revision erzeugen: `reservation_request`, `inquiry`,
`alteration_request`. Sie wurden abonniert und als Blob weggeschrieben — aber es
gab keinen Weg, sie zu BEANTWORTEN. Unser `/events/{id}/resolve` setzte nur ein
Flag in unserer eigenen Tabelle, während bei Airbnb nach ~24 h der Auto-Decline
zuschlug.

    POST /api/v1/channel-manager/events/{event_id}/airbnb-antwort
    {"aktion": "annehmen" | "ablehnen" | "alteration_annehmen" | … }

Die gesendete Form ist je Anfrageart ANDERS — das ist die Falle, wegen der
`airbnb_anfragen.py` je Art einen eigenen Bauhelfer hat:

| Anfrage | Form |
|---|---|
| Reservation Request | `{"accept": true}` / `{"accept": false, "reason": …}` — **Boolean** |
| Alteration Request | `{"accept": "accept"｜"decline"｜"cancel"}` — **String** |
| Inquiry | `{"type": "preapproval", "block_instant_booking": …}` |
| Inquiry (Angebot) | `{"type": "special_offer", "total_price": <Minor Units>}` |

`accept: true` statt `"accept"` ist ein 422, und die Frist läuft weiter.
Ablehnungsgründe sind auf Airbnbs vier begrenzt (Allowlist, kein Freitext).

**Das Journal als zweiter Weg.** `GET live_feed` ist ein Ereignis-JOURNAL (nicht
die Arbeitswarteschlange `booking_revisions/feed`): nichts verschwindet durch ein
Ack, man kann nach `event`/`property_id` filtern, und es enthält alle
Ereignisarten. Ohne es war der Webhook für alles außer Buchungen der EINZIGE Weg
— ging er verloren, war das Ereignis weg. Der 5-min-Tick `sync_live_feed` zieht
nach; erkannt wird jedes Ereignis über `live_feed_event_id` (UNIQUE-Index 0284),
Live-Nachweis: Lauf 1 = 4 neu, Lauf 2 = 0 neu.

Kontrolltest, der die Filter belegt: `filter[event]=erfunden_zzz` → `422
{"filter":["is_invalid"]}`. Eine 200 mit leerer Liste hätte auch „still
ignoriert" heißen können.

## Der Buchungsbetrag: Brutto, nicht Auszahlung

`connection_settings` bestellt bei Airbnb jetzt `booking_amount_settings:
"Total Paid Amount"`. Vorher stand dort `"Payout Amount"` — der Betrag NACH Abzug
der Airbnb-Host-Fee —, während unser Geldpfad denselben Wert als Bruttobetrag
verbucht: als `paid_amount` („der Gast hat das bezahlt"), als Grundlage unserer
Provision und als Wert, von dem Portalgebühren erst noch abgezogen werden. Die
Host-Fee wurde damit doppelt abgezogen und unsere Provision zu niedrig
fakturiert. Beide Werte sind bei Airbnb erlaubt — wir müssen den bestellen, der
zur Buchhaltung passt.
