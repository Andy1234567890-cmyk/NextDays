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
- `GET /properties/{property_id}/library` — Zusatzleistungen **anderer** Objekte
  des Betriebs, die auf dieses übernehmbar sind (Gegenstück zur Gebühren-
  Bibliothek). Nur gleiche Währung; was hier schon liegt, fehlt bewusst. Ohne
  Währung am Ziel ist die Liste leer und `currency` `null` — kein geratenes EUR.
- `POST /{addon_id}/apply` — dieselbe Zusatzleistung auf weitere eigene Objekte
  übertragen (Block „Zu anderen Objekten hinzufügen" im Editor). Jede Ziel-ID
  einzeln tenant-gescopt (Wurzel 3), Währungskonflikte werden **vor** dem ersten
  Schreiben abgelehnt, idempotent über die fachliche Signatur (Wurzel 2). Es ist
  eine **Kopie, keine Verknüpfung**: spätere Änderungen an der Quelle wandern
  nicht mit — wie bei Gebühren und Steuern. Logik in `verteilung.py`.
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

## Bezahlen: Zahlungslink (Stripe, 0386)

Der Betrieb schickt dem Gast einen **Stripe Payment Link** über alle offenen
Zusatzleistungen einer Buchung. `mark-paid` bleibt daneben bestehen (Barzahlung
an der Rezeption), ist aber nicht mehr der einzige Weg.

- **Geldfluss:** Direct Charge **im verbundenen Konto des Betriebs**
  (`stripe_account`-Header). Der Charge gehört ihm — seine Währung, sein Name
  auf der Kartenabrechnung, das Geld liegt auf SEINEM Stripe-Saldo und wird von
  dort ausgezahlt (`/konto/abrechnung`). Die Plattform behält
  `tenants.addon_fee_bps` (Default 500 = 5 %) als `application_fee` ein.
- **Nicht mit dem Auszahlungslauf verwechseln:** `features/payouts` transferiert
  nur Marktplatz-Buchungen (`channel='portal'`) vom PLATTFORM-Saldo. Eine
  Zusatzleistung fließt nie über beide Wege.
- **Warum Payment Link, nicht Checkout-Session:** Die Session-URL verfällt nach
  24 h; ein Link, den der Betrieb per Nachricht verschickt, wäre dann tot.
  Payment Links verlangen eine echte Price-ID (`price_data` gibt es dort nicht) —
  deshalb legt `stripe_client.create_addon_payment_link` erst Preis + Produkt im
  Konto des Betriebs an.
- **Einmal bezahlbar:** `restrictions.completed_sessions.limit = 1`.
- **Idempotenz:** höchstens EIN offener Link je Buchung (partieller
  Unique-Index). Gleiche Positionen → derselbe Link; geänderte Positionen →
  alter Link wird bei Stripe deaktiviert, dann ein neuer erzeugt.
- **Zahlungseingang:** `checkout.session.completed` (Connect-Event, trägt
  `account`). `zahlung.verbuche_checkout_session` filtert auf die eigene
  Metadata, prüft das absendende Konto und den Betrag. Netz darunter: der
  GET-Endpunkt gleicht einen offenen Link einmal mit Stripe ab — ohne das bliebe
  eine bezahlte Leistung „offen", wenn der Connect-Webhook nicht zustellt.
- **Beleg:** eine `payments`-Zeile mit `type='addon'` und `gateway_ref` = der
  **Checkout-Session-ID** (nicht dem PaymentIntent). Über die PaymentIntent-ID
  würde der `payment_intent.succeeded`-Pfad die BUCHUNG als bezahlt markieren
  und eine Plattform-Auszahlung planen — beides wäre falsch.

### Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/addons/reservations/{id}/zahlungslink` | offener Link (oder `null`), mit Stripe-Abgleich |
| POST | `/addons/reservations/{id}/zahlungslink` | Link erstellen (idempotent) |
| DELETE | `/addons/reservations/{id}/zahlungslink` | Link zurückziehen |

### Voraussetzung am Stripe-Key

Ein *restricted key* (`rk_live_…`) braucht in der Spalte **Connect-
Berechtigungen**: Prices/Products/Payment Links **Schreiben**, Checkout Sessions
**Lesen**. Für Saldo und Auszahlung zusätzlich Balance **Lesen**, Payouts
**Schreiben**, Payout Settings **Lesen**; für das Logo-Branding Files
**Schreiben** (Plattform-Ebene genügt dort nicht — Connect setzen). Fehlt ein
Recht, scheitert der Aufruf sichtbar mit dem Stripe-Originaltext; es gibt keinen
stillen Ersatzweg.
