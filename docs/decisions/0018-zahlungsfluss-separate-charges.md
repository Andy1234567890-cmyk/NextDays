# ADR-0018 — Ein Zahlungsfluss für PMS und Marktplatz (Separate Charges)

**Status:** ANGENOMMEN · 2026-07-26
**Ersetzt teilweise:** ADR-0011 (Gateway-Wahl bleibt gültig, Geldfluss präzisiert)

## Kontext

myNextDays hat **einen Tarif für alle** (Preisliste §1: „Kein Privat- oder
Agentur-Modell"). Jeder Kunde zahlt Abo *und* eine kanalabhängige Provision —
derselbe Betrieb verkauft über drei Wege:

| Kanal (`reservations.channel`) | Provision | Geldweg |
|---|---|---|
| `portal` — unser Marktplatz | **8 % all-in** (§2) | über die Plattform |
| `direct` — eigene Website des Betriebs | **0 %** (§5) | direkt zu ihm |
| `booking`/`airbnb`/`vrbo` | 1 % monatlich fakturiert (§2) | nie über uns |

Alle liefen über **Destination Charges**: `transfer_data.destination` reicht das
Geld unmittelbar nach dem Charge an den Betrieb weiter — und die Provision hing
am Kontotyp (`tenants.account_type`) statt am Kanal.

Drei Probleme daraus:

1. **Doppelzahlung.** Der 2026 gebaute Auszahlungs-Slice (0217) transferierte
   dieselbe Buchung ein zweites Mal — das Geld war per Destination Charge längst
   beim Betrieb. Marktplatz: 920 € Verlust je 1000 €-Buchung, PMS: 1000 €.
   Derselbe Fehler steckte im Co-Gastgeber-Pfad.
2. **Storno.** Das gewünschte Airbnb-/Booking-Modell — verrechnen statt
   zurückholen — ist mit Destination Charges nicht abbildbar: Das Geld ist beim
   Betrieb, bevor der Aufenthalt stattgefunden hat.
3. **Falsche Provisionsbasis.** `account_type` kannte die Preisliste nicht: Ein
   PMS-Kunde zahlte auf Portal-Buchungen 0 % (Provision entging uns), ein
   Marktplatz-Kunde auf Direktbuchungen 8 % (zu Unrecht belastet). Verschärft
   dadurch, dass die Buchungs-Engine Marktplatz-Buchungen als `channel='direct'`
   ablegte.

## Verworfene Alternativen

**Zwei Stripe-Plattform-Accounts.** Scheitert an Stripes
Single-Platform-Connection-Policy: Ein Connected Account kann nur mit **einer**
Plattform verbunden sein. Ein Betrieb, der beide Kanäle nutzt, müsste sich
zweimal onboarden (zwei KYC, zwei Bankverbindungen). Organizations lösen nur
Reporting, nicht Onboarding.

**Zwei getrennte Dienste.** Widerspricht ADR-0016 (modularer Monolith,
ausdrücklich „KEINE Änderung nötig"). Zudem müsste erst der Slice-Zyklus
payments↔payouts↔cohosts↔donations aufgelöst werden.

**Alles über die Plattform, einheitlich.** Hätte einen Pfad ergeben, aber uns zum
Merchant of Record auch für Buchungen gemacht, an denen wir nichts verdienen —
im Widerspruch zu Lastenheft §7.1 („0 % Buchungsgebühr") und zu den AGB
(„myNextDays wird nicht Vertragspartei"). `on_behalf_of` löst das nicht: Stripe
belastet den Plattform-Saldo bei Disputes „with or without on_behalf_of".

## Entscheidung

**Der Kanal entscheidet — über Provision UND Haftung. Wer nicht verdient, haftet
nicht.**

| Kanal | Charge-Typ | Merchant of Record | Provision | Auszahlung |
|---|---|---|---|---|
| `portal` | Separate Charge + Transfer | myNextDays | 8 % all-in | nach Checkout |
| `direct` | **Direct Charge** (`Stripe-Account`) | Betrieb | 0 % | entfällt |
| OTA | kein Charge (409) | — | 1 % monatlich | entfällt |

Für Portal-Buchungen ist der Fluss `Gast → Plattform → Betrieb`:

1. Charge auf den Plattform-Account, mit `transfer_group` und `on_behalf_of`
   (Betrieb bleibt Settlement-Händler: seine Währung, seine Kartenabrechnung).
2. Transfer nach dem Checkout, aus dem Auszahlungslauf.

Die Weiche fällt **einmal** am Eintrittspunkt (`_traegt_haftung(res)`), danach
laufen zwei disjunkte Pfade. `tenants.account_type` wird im Zahlungspfad **nicht
mehr gelesen** — es gibt nur einen Tarif.

Bei Direct Charges müssen auch Refund, Capture und Cancel im Konto des Betriebs
laufen (`stripe_account`-Header), sonst findet Stripe den Intent nicht.

Umgestellt wird über `STRIPE_SEPARATE_TRANSFERS`, Default `false` (Altpfad).
Solange es aus ist, sind **beide** Transferpfade gesperrt (Auszahlungslauf und
Co-Gastgeber) — fail-closed, Wurzel 5.

## Konsequenzen

**Gut:**
- Provision folgt der Preisliste statt dem Kontotyp — auf Portal-Buchungen 8 %,
  auf Direktbuchungen 0 %, unabhängig davon, wer der Kunde ist.
- **Haftung folgt der Provision** (Lastenheft §7.1): Bei Direktbuchungen ist der
  Betrieb Merchant of Record und trägt Chargebacks selbst. Live belegt: Charge im
  Betriebskonto, `net=967,25 fee=32,75` — die Stripe-Gebühr trägt er.
- Doppelzahlung an beiden Transferpfaden gesperrt (Auszahlungslauf + Cohost).
- Storno vor Anreise braucht kein Zurückholen: das Geld war nie beim Betrieb.
- Live geprüft über 8 Länder / 5 Währungen (DE, IT, FR, ES, DK, SE, PL, GB) plus
  USD: jeder Betrieb erhält seine **eigene** Währung. Das löst zugleich den
  DKK-Fehler, bei dem ein italienischer Anbieter 7474,64 DKK statt 920 EUR bekam.
- Altzeilen abgesichert: `payouts.charge_modell` (0220) nimmt Zeilen aus der
  Destination-Charge-Ära dauerhaft vom Lauf aus. Bestand korrigiert (0221).

**Preis:**
- **Zwei Charge-Typen im Code.** Unvermeidbar: Nur Direct Charges verlagern die
  Haftung, und die Haftung MUSS der Provision folgen. Die Weiche fällt einmal
  (`_traegt_haftung`), nicht verstreut im Geldpfad.
- **Für Portal-Buchungen bleiben wir Merchant of Record** — dort verdienen wir
  8 %, das ist die Gegenleistung fürs Risiko.
- **90-Tage-Grenze**: Stripe erlaubt kein unbegrenztes Halten. Betrifft
  vermutlich nur Guthaben im Connected-Account-Saldo, nicht unseren
  Plattform-Saldo — vor dem Livegang mit Stripe schriftlich zu klären.
- **AGB angepasst** (§ 6, alle 24 Sprachfassungen): Der Zahlungsweg richtet sich
  nach dem Buchungskanal.

## Belege

- [Connect charge types](https://docs.stripe.com/connect/charges)
- [Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)
- [Account balances / holding funds](https://docs.stripe.com/connect/account-balances)
- [Disputes on Connect platforms](https://docs.stripe.com/connect/disputes)
- [Single-platform-connection policy](https://support.stripe.com/questions/security-permissions-and-access-levels-when-connecting-your-stripe-account-to-a-third-party-platform)
- Präzedenzfall Booking.com: fährt Agency- und Merchant-Modell parallel unter
  einem Dach, unterschieden pro Buchung. Kein PMS-Anbieter (Cloudbeds, Guesty,
  Hostaway) betreibt einen eigenen Marktplatz — die Kombination ist Neuland.
