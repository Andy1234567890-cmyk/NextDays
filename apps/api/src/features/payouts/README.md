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
   `check_out` + 1 Tag Nachtragefrist, **plus die Karenz** (`karenz_tage`, 0411 —
   Default `KARENZ_TAGE` = 3, je Betrieb in `payout_settings`). Die Karenz gilt
   auf BEIDEN Pfaden, auch bei eingetragenem Checkout: läge sie nur auf dem
   Fallback, umgeht sie jeder, der auscheckt. Darauf der Rhythmus des Betriebs
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
- `payout_settings` — Rhythmus, `paused`, `karenz_tage` (Prüffrist).
- `payout_holds` — Zurückhaltung bei Prüfung. Für Clients komplett gesperrt.

Alle vier mit RLS + `revoke ... from anon, authenticated`; `authenticated` liest
nur, geschrieben wird ausschließlich über die service_role (Wurzel 6).

## Bewusst offen

- (erledigt) `charge.dispute.created` legt jetzt einen 45-Tage-Hold an
  (`payments/webhook.py::_halte_auszahlung_zurueck`).
- `payout_settings.paused` ist über kein API schreibbar (nur Plattform-seitig
  gedacht, Endpunkt fehlt). Dasselbe gilt für `karenz_tage`: bewusst nicht in
  `PayoutSettingsUpdate` — ein Betrieb, der seine eigene Prüffrist auf 0 setzen
  könnte, hätte keine. Abweichende Konditionen werden bis auf Weiteres direkt an
  der Spalte gesetzt.
- (erledigt) Die Karenz ist in der Oberfläche benannt. Die drei
  Rhythmus-Hinweise (`gastgeber/messages/*.json`, `azRhythmus*Hinweis`,
  45 Sprachen) beziehen sich jetzt auf die FREIGABE statt auf die Abreise, und
  `azKarenzHinweis` nennt die Frist mit `{tage}`. Vorher sagte der Text „Einen
  Tag nach der Abreise", während der Verlauf daneben das `due_at` mit Karenz
  zeigte — vier Tage später.
- (erledigt) `overview()` liefert `charge_modell` mit; die Oberfläche zeigt für
  Destination-Zeilen „direkt ausgezahlt" statt „geplant". Vorher stand dort ein
  Fälligkeitsdatum, das nie eintritt (der Lauf filtert auf `separate`) — für
  Geld, das der Betrieb längst hat.
- Zwischen `create_transfer` und dem Status-Update gibt es kein `processing`.
  Abgesichert nur über `idempotency_key` — der bei Stripe nach 24 h abläuft.
- PayPal plant gar keine Auszahlungszeile (Multiparty zahlt direkt an den
  Verkäufer) — Co-Gastgeber und Spenden greifen dort nicht.

## Zweiter Topf: Guthaben auf dem verbundenen Konto (`stripe_saldo.py`)

Alles oben beschreibt den PLATTFORM-Ledger (Marktplatz). Daneben steht das Geld,
das der Betrieb **selbst** kassiert hat — Zusatzleistungen (0386) und
Direktbuchungen laufen als Direct Charge in SEINEM verbundenen Konto. Dieses
Geld war nie bei uns; ausgezahlt wird es von Stripe auf sein Bankkonto.

Quelle ist durchgehend Stripe, nicht eine Kopie bei uns — auch der Rhythmus
(`settings.payouts.schedule.interval`). Eine gespiegelte Kopie wäre irgendwann
falsch, ohne dass es auffällt (Wurzel 4).

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/payouts/guthaben` | Saldo (verfügbar/ausstehend je Währung), Rhythmus, letzte Auszahlungen |
| POST | `/payouts/guthaben/auszahlung` | Auszahlung beantragen (Betrag optional = alles Verfügbare) |
| PUT | `/payouts/guthaben/rhythmus` | `manual` \| `daily` \| `weekly` \| `monthly` |

Schranken beim Antrag, alle fail-closed: Rhythmus muss `manual` sein (sonst plant
Stripe den Saldo bereits selbst ein), `payouts_enabled` muss stehen, und der
Betrag muss durch das **verfügbare** Guthaben gedeckt sein (`pending` zählt
nicht). Der Idempotency-Key ist aus Konto, Währung, Betrag und Kalendertag
gebildet — ein Doppelklick liefert dieselbe Auszahlung zurück.

Scheitert Stripe, wird der Fehler durchgereicht (502). Ein leerer Saldo als
Ersatzantwort wäre eine Falschaussage über fremdes Geld.

### Voraussetzung am Stripe-Key

`balance_read` (Saldo), Payouts-Schreibrecht und Connect-Accounts-Schreibrecht
(Rhythmus) — jeweils auf verbundenen Konten. Fehlt eines, meldet die
Abrechnungs-Seite den Stripe-Originaltext.

### Protokoll (`GET /payouts/protokoll`)

Jede Geldbewegung des verbundenen Kontos, getrennt nach Richtung — die Reiter
„Empfangene Zahlungen" und „Versendete Zahlungen". Quelle ist Stripes
`balance_transactions`, nicht unsere Kopie: So taucht auch auf, was nie durch
unsere Oberfläche lief (Erstattung im Stripe-Dashboard, Stripe-Gebühr,
Rückbelastung).

`amount` / `fee` / `net` stehen nebeneinander, weil nur die Summe der
**net**-Werte den Saldo ergibt. Die Richtung entscheidet eine **Positivliste**
(`AUSGANG_TYPEN`): Ein unbekannter neuer Stripe-Typ landet damit im Eingang und
bleibt sichtbar, statt aus dem Protokoll zu verschwinden.

Angereichert aus unseren Daten: Zu einer Zahlung werden Buchung und bezahlte
Zusatzleistungen dazugeschrieben (über `addon_payment_links.payment_intent_id` /
`checkout_session_id`), damit die Zeile „wofür war das?" beantwortet.

Dazu die OFFENE Seite: `offen` listet die noch unbezahlten Zahlungslinks des
Betriebs (mit Betrag, Positionen und Zahlseite). Ohne sie zeigte das Protokoll
nur, was schon da ist, und nie, worauf der Betrieb noch wartet. Sie stammt aus
unseren Daten und erscheint deshalb auch, wenn (noch) kein Stripe-Konto
verbunden ist.

Oberfläche: `/konto/abrechnung` (Nutzermenü → „Abrechnung") mit drei Reitern:
Abrechnung · Empfangene Zahlungen · Versendete Zahlungen.
