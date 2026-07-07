# Plan: Stripe-Preisliste + Abo-Billing im ganzen System

> **Status: STRIPE-PREISE ANGELEGT (Test) — Systemintegration offen.** 2026-07-07.
>
> Angelegt im Test-Account (idempotent per `seed_stripe_prices.py`, live gegengelesen):
> - `mnd_grundtarif_month` → `price_1TqV9801LoAahqnDNkjWWC3o` (graduated 19,90/6/5/4 €)
> - `modul3_flat` 30 € · `modul4_flat` 19,90 € · `modul4_per_seat` 2,50 €
> - `modul6_flat` 600 € · `modul6_per_room` 1,50 €
> - Idempotenz + PDF-Rechenbeispiele (1/3/20/100/200 Obj.) verifiziert. Adaptive
>   Pricing (Checkout) deckt die 7 Nicht-EUR-EU-Währungen ab (Stripe-Kurs).

> Quelle: `myNextDays_Preisliste.pdf` (Stand 07/2026). Stripe-Account
> `acct_1TnCie01LoAahqnD` („Mynextdays sandbox", **TEST-Modus**, Land DK,
> default_currency DKK, `charges_enabled=false`) — **aktuell 0 Produkte, 0 Preise.**

## Grundsatz-Abgrenzung (WICHTIG — nicht verwechseln)

Es gibt im System **zwei völlig getrennte Geldflüsse**:

1. **Gast → Vermieter (existiert schon):** `features/payments/` = Stripe **Connect**
   (Destination Charge). Der Gast bezahlt eine Buchung, das Geld geht an den
   Connected Account des Vermieters. Das ist NICHT dieser Plan.
2. **Vermieter → myNextDays (NEU, dieser Plan):** Das **Abo-Billing**. myNextDays
   kassiert Grundgebühr + Objekt-Staffel + Zusatzmodule + Provisionen vom Kunden.
   Dafür gibt es im Code bisher **nichts** (keine Subscription-Domäne, keine
   Modul-Entitlements, kein Stripe-Customer pro Tenant).

Die 8 %-Portal-Provision hängt am **Connect-Fluss (1)** (`application_fee`), die
1 %-Extern-Provision am **Abo-Fluss (2)**. Siehe Abschnitt „Provisionen".

## Nutzer-Entscheidungen (2026-07-07)

- Objekt-Staffel = **Graduated Pricing** (ein Stripe-Preis mit Tiers, `quantity` =
  Objektzahl, Stripe rechnet die Staffel selbst).
- **Alles per CLI/SDK** von hier aus einstellen — nichts im Stripe-Dashboard klicken.
- **27 EU-Staaten:** Plattform wird in allen 27 EU-Ländern deployt → Basispreis
  `19,90 €` ist der Anker, muss aber **pro Land/Währung anpassbar** sein.
  → Umsetzung via Stripe **Multi-Currency** (`currency_options` am Preis), KEIN
  €-Hardcode (Wurzel 4).

## OFFENE ENTSCHEIDUNG (blockiert das Anlegen der Nicht-EUR-Preise)

Von den 27 EU-Staaten nutzen **20 den Euro**. Sieben haben eigene Währungen:

| Land | Währung |
|---|---|
| Dänemark | DKK |
| Schweden | SEK |
| Polen | PLN |
| Tschechien | CZK |
| Ungarn | HUF |
| Rumänien | RON |
| Bulgarien | BGN |

Für diese 7 brauche ich **echte Zielbeträge** — ich darf keinen Wechselkurs
erfinden (Wurzel 4: kein Fantasie-Fallback). Zwei saubere Wege:

- **(A) Nur EUR jetzt anlegen** (deckt 20 der 27 Länder sofort ab), die 7
  Fremdwährungen später mit vom Nutzer bestätigten Beträgen ergänzen. ← Vorschlag,
  damit wir nicht auf Kurse warten.
- **(B) Alle 8 Währungen jetzt**, aber dann muss der Nutzer die 7 Nicht-EUR-Beträge
  liefern (z.B. glatte Marketing-Preise wie 149 DKK statt krummer Umrechnung).

**→ Entscheidung des Nutzers nötig, bevor Nicht-EUR-Preise entstehen.**

## Zielzustand in Stripe (Test zuerst, dann Live)

Alles wird **idempotent per Skript** (SDK) angelegt — `lookup_key`/`metadata` als
stabiler Schlüssel, Re-Run legt nichts doppelt an (Wurzel 2). Ein Stripe-Preis ist
**immutable**: Änderungen = neuen Preis anlegen + alten `active=false`, nie mutieren.

### 1. Produkt „myNextDays Grundtarif" + Graduated Price (monatlich)

Ein Produkt, ein wiederkehrender Preis (`interval=month`), `billing_scheme=tiered`,
`tiers_mode=graduated`, `quantity` = Objektzahl des Tenants:

| Tier (Objekte) | Betrag EUR |
|---|---|
| bis 1 (`up_to: 1`) | 19,90 € **flat** (`flat_amount`, nicht per-unit) |
| 2–50 (`up_to: 50`) | 6,00 € je Objekt (`unit_amount`) |
| 51–100 (`up_to: 100`) | 5,00 € je Objekt |
| ab 101 (`up_to: inf`) | 4,00 € je Objekt |

> Prüf-Rechnung gegen PDF Abschnitt 4: 20 Objekte = 19,90 + 19×6 = **133,90 €** ✓;
> 100 Objekte = 19,90 + 49×6 + 50×5 = **563,90 €** ✓;
> 200 Objekte = 19,90 + 49×6 + 50×5 + 100×4 = **963,90 €** ✓. Tiers stimmen.

`currency_options` am selben Preis für die weiteren EU-Währungen (sobald Beträge da).

### 2. Zusatzmodule (Abschnitt 3 der Preisliste) — je ein Produkt+Preis

| Modul | Preis | Stripe-Abbildung |
|---|---|---|
| Modul 3 Buchhaltung | 30,00 €/Monat | recurring flat |
| Modul 4 Mitarbeiter | 19,90 €/Monat **ODER** 2,50 €/Nutzer | zwei Preise (flat + per-seat `quantity`), Kunde wählt einen |
| Modul 5 Jobmarkt | 2 % vom Umsatz | **kein fixer Preis** → Usage/Invoice-Item nachgelagert (wie Provisionen) |
| Modul 6 Hotel | ab 600,00 €/Monat **ODER** 1,50 €/Zimmer | zwei Preise (flat + per-room) |

Jedes Modul = eigenes Subscription-Item, nur wenn gebucht. Entitlement steuert
Feature-Zugang im System (siehe „Systemintegration").

### 3. Provisionen (Abschnitt 2 der Preisliste)

- **Eigenes Portal 8 % all-in (Direktbuchung):** läuft über den BESTEHENDEN
  Connect-Fluss (`application_fee_amount` beim Gast-Charge in `features/payments/`).
  Aktuell ist `STRIPE_PLATFORM_FEE_PCT=0` (nicht gesetzt) → **muss auf die
  Portal-Logik gehoben werden.** Achtung: die Fee gilt NUR für eigene-Portal-
  Buchungen, NICHT für OTA-Buchungen, die über Connect laufen. → Fee pro
  Buchungskanal bestimmen, nicht global. (Verifizieren, wie der Kanal am Charge
  hängt, bevor das gesetzt wird.)
- **Externe Kanäle 1 % (0,5 % ab 101 Objekten):** die Buchung läuft NICHT über
  unser Stripe → nachgelagerte **monatliche Abrechnung** als Invoice-Item aufs
  Tenant-Abo (Summe der externen Buchungsumsätze × Satz). Staffel nach Objektzahl.
- Provisions-Sätze **nicht hardcoden** — als Konfig/DB-Wert, pro Tenant auflösbar
  (Objektzahl-abhängige Staffel).

## Systemintegration (das eigentliche „im ganzen System")

Neue Domäne `features/subscriptions/` (API) + Billing-Abschnitt auf `/konto`
(gebündelt, siehe [[konto-alles-gebuendelt]] — NICHT neuer Tab).

1. **DB-Migration (neue Nummer, RLS Pflicht — Wurzel 3 + RLS-Regel):**
   - `tenant_subscription`: tenant_id (FK, UNIQUE), stripe_customer_id,
     stripe_subscription_id, status, current_period_end, aktuelle Objektzahl,
     gebuchte Module (jsonb/eigene Tabelle), Provisions-Staffel-Satz.
   - `tenant_module_entitlement`: welches Modul für welchen Tenant aktiv (steuert
     Feature-Gates 3/4/5/6).
   - Beide: RLS `tenant_id = auth.tenant_id`, in `supabase_realtime`-Publication
     (Realtime-Pflicht), Migration via `supabase/apply-migrations.sh` (nie auto).
2. **Objektzahl → Stripe-`quantity`-Sync:** bei jedem Anlegen/Löschen eines
   `properties`-Eintrags die Subscription-`quantity` aktualisieren
   (`subscription_items.update` mit `proration_behavior`). **Idempotent** (Wurzel 2:
   Doppelklick/Retry), Gegenzustand pflegen (Wurzel 1: Objekt weg → quantity runter).
3. **Webhook** (erweitert `features/payments/webhook.py` oder eigener Handler):
   `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed` →
   `tenant_subscription.status` pflegen. Idempotenz über bestehende
   `stripe_webhook_event`-Tabelle. Signatur fail-closed (Wurzel 5).
4. **Feature-Gates:** Modul-Zugang (Buchhaltung/Mitarbeiter/Jobmarkt/Hotel) an
   `tenant_module_entitlement` hängen, serverseitig erzwingen (Wurzel 3 — nie nur
   im Frontend ausblenden).
5. **UI (`/konto`, Realtime):** aktueller Tarif, Objektzahl, gebuchte Module,
   nächste Rechnung, Modul buchen/kündigen. `formatCurrency` aus `lib/currency`
   (kein €-Hardcode, Wurzel 4). useRealtime auf `tenant_subscription`.
6. **Provisions-Job:** monatlicher Worker-Task, der externe Buchungsumsätze
   summiert und das Invoice-Item setzt (Objektzahl-Staffel).
7. **Doku/Diagramme** aktualisieren (Architektur-Regel).

## Reihenfolge

1. **Währungs-Entscheidung** (A oder B oben) — blockiert Preis-Anlage.
2. Idempotentes SDK-Skript: Produkte + Preise im **Test**-Account anlegen,
   gegen PDF gegenlesen (Betrags-Assertions wie oben).
3. DB-Migration + Domäne + Objektzahl-Sync + Webhook + Entitlements.
4. UI auf `/konto`.
5. Provisions-Mechanik (Portal-Fee-Kanal + externer Monatsjob).
6. Review-Loops gegen die 5 Wurzeln + Qualitätsgate; erst dann Live-Account.

## Was ich NICHT tue

- Keine Live-Charges/Live-Preise ohne ausdrückliche Freigabe (aktuell Test-Key).
- Keine erfundenen Wechselkurse für Nicht-EUR-Länder (Wurzel 4).
- Kein €-Hardcode irgendwo.
- Nichts committen/deployen ohne Ansage.
