# addons — Zusatzleistungen / Upsells

Vertical Slice für **optionale Extras**, die Gäste dazubuchen (Früh-Check-in,
Late-Check-out, Reinigung, Transfer, Ausrüstung, Frühstück …) — auf der
Buchungsstrecke UND nach der Buchung. Vorbild: Hostaway/Guesty „Upsells".

Ein Upsell ist **kein** Custom Fee (pflicht/optional, immer im Preis), sondern
ein aktiv dazugebuchtes Extra mit Medien, Abrechnungsbasis und „wo/wann es
erscheint".

## Warum eigene Tabellen (nicht `add_ons`/`surcharges`)

- `property_pricing_config.add_ons` (jsonb, Migration 0051) ist zu dünn (keine
  Medien, kein „erscheint in", kein Zahlstatus) und wird vom Pricing-Resolver
  ohnehin nicht gelesen.
- Die `surcharges`-Tabelle (0010) ist ungenutzt und modelliert keine Upsells.

Beide bleiben für diesen Zweck **bewusst liegen** (kein Doppel-Mechanismus).

## Daten (Migrationen 0074 + 0075)

- `property_addons` — Katalog je Objekt: `name`/`description` (jsonb i18n),
  `media` (URLs, max. 5 im `property-images`-Bucket), `price`, `basis`
  (per_stay/per_night/per_guest/per_unit), `mandatory`, `appears_in`
  (booking_engine/guest_portal/checkin), `available_until`
  (before_checkin/anytime), `tax_rate`, `active`, `sort_order`. RLS via
  property → tenant.
- `reservation_addons` — gekaufte Extras je Reservierung: **Snapshot**
  (name/price/basis/tax) zum Kaufzeitpunkt, `qty`, `total` (serverseitig
  berechnet), `status` (pending/paid/cancelled), `charged_at`. RLS tenant-direkt;
  in `supabase_realtime` (WebSocket, kein Polling).

## Endpunkte (`/api/v1/addons`, MANAGE_PROPERTIES, tenant-gescoped)

- `GET /properties/{property_id}` — Katalog eines Objekts (inkl. inaktiver).
- `POST /properties/{property_id}` — Zusatzleistung anlegen.
- `PATCH /{addon_id}` — bearbeiten.
- `DELETE /{addon_id}` — löschen.
- `POST /{addon_id}/media` — ein Medium (Foto) hochladen (multipart), max. 5.
- `GET /reservations/{reservation_id}` — gekaufte Extras (Dashboard-Sicht).
- `GET /reservations/{reservation_id}/available` — aktive Katalog-Add-ons des
  Objekts dieser Reservierung (Schnell-Auswahl im Kalender-Detail).
- `POST /reservations/{reservation_id}/addons` — **Schnelltaste** (Lastenheft:
  „Direkt-Buchung Dienstleistungen … direkt im Kalender"): Extra zu einer
  bestehenden Buchung hinzufügen. Funktioniert für **jeden Kanal, auch OTA**
  (z. B. Booking) — die Hausverwaltung bucht ein Extra-Angebot provisionsfrei am
  OTA vorbei dazu.
- `POST /reservation-addons/{id}/mark-paid` — manuell als bezahlt markieren
  (solange kein Payment-Provider live ist).

## Verkauf

- **Buchungsstrecke** (booking_engine, public): `/listings/{id}` liefert die für
  `booking_engine` freigegebenen aktiven Add-ons; `/reservations` akzeptiert die
  Auswahl → `reservation_addons`.
- **Nach der Buchung** (booking_engine, public, E-Mail-verifiziert):
  `GET/POST /booking-engine/reservations/{id}/addons` zeigt/kauft die für
  `guest_portal` freigegebenen Add-ons unter Beachtung der „wann anzeigen"-Regel.
- Die Betrags-Wahrheit ist `addons/pricing.py` (`addon_total`); Preise kommen
  **immer** aus dem Katalog, nie aus Client-Input. Gemeinsame Kauf-Logik:
  `addons/service.purchase_addons`.

## Integration

- **Pricing-Resolver**: `quote()` nimmt optional gewählte Add-ons und rechnet sie
  nach Basis + eigener Steuer als zusätzliche Positionen in die Aufschlüsselung.
- **Tasks**: jeder Kauf löst `TasksService.generate_for_addon` aus (Trigger
  „addon_purchased") → Vorbereitungs-Aufgabe fällig am Anreisetag.
- **Owner-Statement**: `reservation_addons` (pending + paid, ohne cancelled)
  fließt als Extra-Umsatz in Total Price/Payout und damit in den Provisions-Split
  (provisionsfrei verkauft → keine channel_fee darauf).
- **Payment-gegatet**: `status` bleibt `pending` bis bezahlt. Ohne aktiven
  Payment-Provider (primär Stripe, Revolut sekundär — ADR-0011) gilt „zahlbar bei
  Anreise" (manuell als paid markierbar); Anzeige/Buchung sind **nicht** an
  Payment blockiert.
