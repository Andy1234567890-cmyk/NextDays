# payouts — Auszahlungen an Betriebe

Ledger, Verrechnung und Auszahlungslauf. Modell wie Booking.com/Airbnb: **die
Plattform hält das Geld bis zur Abreise**, ein Storno wird **verrechnet**, nicht
vom Bankkonto des Betriebs zurückgeholt.

Gilt **nur für Buchungen über das myNextDays-Portal** (`channel='portal'`).
Direktbuchungen über die eigene Seite des Betriebs und OTA-Buchungen laufen als
Direct Charge bzw. gar nicht über uns — dort gibt es nichts auszuzahlen. Der
Kanal entscheidet, nicht `tenants.account_type` (Preisliste §1: „Ein Tarif für
alle").

## Der Schalter: `stripe_separate_transfers`

Der Slice ist **nur wirksam, wenn Charge und Transfer getrennt sind**.

| Flag | Charge | Dieser Slice |
|---|---|---|
| `false` (Default) | Destination Charge — Geld sofort beim Betrieb | **gesperrt** |
| `true` | Separate Charge — Geld auf dem Plattform-Saldo | aktiv |

`_trennt_charge_und_transfer()` ist die erste Prüfung in `_verarbeite_zeile` und
wirft `_Uebersprungen`. Grund: Bei einer Destination Charge hat der Betrieb sein
Geld bereits aus dem Charge; ein Transfer hier wäre die **zweite** Zahlung
derselben Buchung zu Lasten des Plattform-Saldos (Marktplatz: 920 € Verlust je
1000 €-Buchung, PMS: 1000 €). Gesperrte Zeilen bleiben mit erhaltener Fälligkeit
liegen — es geht nichts verloren, es fließt nur nichts doppelt.

Dieselbe Sperre sitzt in `cohosts/payout_service.py::pay_pending` — der
Co-Gastgeber-Anteil steckt **nicht** in der `application_fee`, sondern wird vom
Gastgeber-Anteil abgezogen; ohne Sperre wäre auch er doppelt geflossen.

> Umstellung des Flags: API **und** Worker gemeinsam neu starten (`get_settings`
> ist `lru_cache`). Vorher müssen Altzeilen aus der Destination-Charge-Ära
> behandelt werden — ihr Geld liegt bereits beim Betrieb.

## Ablauf

1. **Planen** — `payment_intent.succeeded` → `_plane_auszahlung` (webhook.py)
   legt die Zeile an. Beträge kommen aus den festgeschriebenen Ledgern
   (`platform_fees`, `donations`, `cohost_payouts.payout_amount_cents`), nicht
   aus einer Neuberechnung. **Kautionen sind ausgenommen** (`type='deposit'`) —
   sie sind kein Umsatz und würden die Zeile der Buchung überschreiben.
2. **Fällig werden** — `faelligkeit.py`: Basis ist `checked_out_at`, ersatzweise
   `check_out` + 1 Tag Nachtragefrist. Darauf der Rhythmus des Betriebs
   (täglich / wöchentlich Do / monatlich zum 15.).
3. **Auszahlen** — `fuehre_lauf_aus` (Worker, stündlich): Holds freigeben,
   offene Verrechnungsposten abziehen, Rest transferieren. Fehler isolieren je
   Zeile (`failed`), nie still „ausgezahlt".

## Storno — der Wasserfall

In `payments/service.py::_hole_zurueck_oder_verrechne`, in dieser Reihenfolge:

1. **Geld noch bei uns** (Separate Charge, kein Transfer): Auszahlung stoppen,
   fertig. Nichts zurückzuholen.
2. **Transfer lief**: Reversal versuchen.
3. **Reversal scheitert** (Betrieb hat abgezogen): Verrechnungsposten — die
   nächste Auszahlung wird gekürzt. **Nie ein Einzug vom Bankkonto.**

Der Refund an den Gast läuft **immer zuerst** und mit `reverse_transfer=False`.
Mit `True` würde der gesamte Refund scheitern, wenn der Betrieb kein Guthaben
hat — der Gast bekäme nichts. Live gegen Stripe belegt.

`payout_adjustments` ist gegen Doppelanlage gesichert: Guard im Service plus
UNIQUE-Index `(reservation_id, kind)` (0219). Refund-Pfad und
`charge.refunded`-Webhook erreichen dieselbe Stelle (Wurzel 2).

## transfer_group

`faelligkeit.transfer_group(reservation_id)` → `"reservation:<id>"`. **Eine
Quelle** für Charge, Gastgeber-Transfer und Co-Gastgeber-Transfer — sonst
zerfällt die Zuordnung in Stripe. Liegt in `faelligkeit.py`, weil das Modul
importfrei ist und beide Slices es ziehen können, ohne den Zyklus
payments↔payouts zu verschärfen.

## Tabellen (0217, 0218, 0219)

- `payouts` — eine Zeile je Buchung. DB-Constraint `payouts_aufteilung_stimmig`:
  netto + Gebühr + Spende + Cohost = brutto. `source_charge_id` (0218) bindet den
  Transfer per `source_transaction` an den Zahlungseingang.
- `payout_adjustments` — offene Forderungen gegen den Betrieb, Teilverrechnung
  über mehrere Auszahlungen möglich.
- `payout_settings` — Rhythmus, `paused`.
- `payout_holds` — Zurückhaltung bei Prüfung. Für Clients komplett gesperrt.

Alle vier mit RLS + `revoke ... from anon, authenticated`; `authenticated` liest
nur, geschrieben wird ausschließlich über die service_role (Wurzel 6).

## Bewusst offen

- (erledigt) `charge.dispute.created` legt jetzt einen 45-Tage-Hold an
  (`payments/webhook.py::_halte_auszahlung_zurueck`).
- `payout_settings.paused` ist über kein API schreibbar (nur Plattform-seitig
  gedacht, Endpunkt fehlt).
- Zwischen `create_transfer` und dem Status-Update gibt es kein `processing`.
  Abgesichert nur über `idempotency_key` — der bei Stripe nach 24 h abläuft.
- PayPal plant gar keine Auszahlungszeile (Multiparty zahlt direkt an den
  Verkäufer) — Co-Gastgeber und Spenden greifen dort nicht.
