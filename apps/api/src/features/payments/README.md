# Slice: payments

Vertical Slice für Online-Zahlungen über **Stripe** (primäres Gateway) und
**PayPal**. Enthält: `router.py`, `service.py`, `schemas.py`,
`stripe_client.py`, `paypal_client.py`, `webhook.py`, `tests/`.

## Funktionen

- **Stripe Connect (Custom, voll white-label)** — Gastgeber-Konten ohne Stripe-
  Branding. Account anlegen (`type=custom`, `tos_acceptance.service_agreement=full`),
  KYC-Daten/IBAN über die eigene Dashboard-UI per `Account.update` /
  `external_account`. KEIN Stripe-hosted Onboarding-Link.
- **Gast-Zahlung** — der Gast zahlt immer über den Plattform-Account. WANN das
  Geld beim Betrieb ankommt, steuert `stripe_separate_transfers`:
  - **aus (Default, Altpfad):** Destination Charge — `transfer_data.destination`
    reicht sofort nach dem Charge weiter. Solange das gilt, ist der
    Auszahlungslauf (`features/payouts`) gesperrt, sonst flösse dieselbe Buchung
    zweimal.
  - **an (Ziel):** Separate Charge — der Betrag landet auf dem Plattform-Saldo
    und wird erst nach dem Checkout per Transfer freigegeben (gleiche
    `transfer_group`). Storno vor Anreise braucht dann kein Zurückholen.

  `on_behalf_of` ist in beiden Fällen der Betrieb: seine Währung, sein Land, sein
  Name auf der Kartenabrechnung. Live über 8 Länder/5 Währungen geprüft — jeder
  Betrieb erhält seine eigene Währung, nicht die der Plattform.

  **Provision und Haftung hängen am KANAL, nicht am Kontotyp** (Preisliste §1:
  „Ein Tarif für alle. Kein Privat- oder Agentur-Modell"). Derselbe Betrieb
  verkauft über alle drei Wege:

  | `reservations.channel` | Provision | Charge-Typ | Haftung |
  |---|---|---|---|
  | `portal` (unser Marktplatz) | **8 % all-in** | über die Plattform | myBestDays |
  | `direct` (eigene Website) | **0 %** (§5) | **Direct Charge** | Betrieb |
  | `booking`/`airbnb`/`vrbo` | 0 % am Charge (1 % monatlich) | kein Charge (409) | — |

  Die Regel dahinter: Wer an einer Buchung nichts verdient, haftet auch nicht
  für ihre Chargebacks (Lastenheft §7.1). Nur Direct Charges verlagern die
  Haftung wirklich — `on_behalf_of` tut das nachweislich NICHT.

  Voraussetzung: `stripe_charges_enabled = true`, sonst 409 (kein Fallback-Charge).
- **Branding (Logo beim Bezahlen)** — das Logo, das der GAST auf der Zahlseite
  sieht, kommt aus `settings.branding` des VERBUNDENEN Kontos, nicht aus unserer
  DB. `PaymentsService.sync_branding_logo` überträgt `company_logo_url` dorthin
  (bei jedem Profil-Sync und direkt nach dem Logo-Upload). Drei live gelernte
  Regeln: die Datei muss auf **Plattform-Ebene** hochgeladen werden (im
  verbundenen Konto hochgeladen → „No such file upload"), `purpose` muss zum
  Zielfeld passen (`business_logo` für `logo`, `business_icon` für `icon`), und
  das Icon verlangt **1:1 ab 128 px** — dafür wird das Logo serverseitig auf ein
  Quadrat gepolstert (nie beschnitten, nie verzerrt). Stripe nimmt nur PNG/JPEG;
  SVG/WebP werden mit klarer Meldung abgelehnt. `stripe_branding_logo_url`
  (0387) merkt den Stand, damit nicht jeder Sync eine weitere Datei anlegt.
- **Kaution** — manual-capture PaymentIntent (`properties.deposit_amount`):
  vorautorisieren, später `capture` (Schaden) oder `cancel` (Freigabe).
- **Refund** — voll/teilweise; schreibt eine `refund`-Zahlung + Status-Update.
- **Webhook** (`webhook.py`) — signaturgeprüft, idempotent über
  `stripe_webhook_event`. Behandelt `account.updated` (KYC-Spiegel in
  `tenant_billing_profile`) + `payment_intent.succeeded|payment_failed|
  amount_capturable_updated` + `charge.refunded` (Zahlstatus in `payments` +
  `reservations.payment_status`).

## Endpoints (`/api/v1/payments`)

| Methode | Pfad | Zugriff |
|---|---|---|
| POST | `/connect/accounts` | MANAGE_BILLING |
| GET | `/connect/accounts/{id}` | MANAGE_BILLING |
| PATCH | `/connect/accounts/{id}` | MANAGE_BILLING |
| PUT | `/connect/accounts/{id}/bank` | MANAGE_BILLING |
| POST | `/booking/{reservation_id}/intent` | public (Gast) |
| POST | `/deposit/{reservation_id}/hold` | MANAGE_BILLING |
| POST | `/deposit/{payment_id}/capture` | MANAGE_BILLING |
| POST | `/deposit/{payment_id}/release` | MANAGE_BILLING |
| POST | `/{payment_id}/refund` | MANAGE_BILLING |
| GET | `/reservations/{reservation_id}/nachberechnung` | MANAGE_CALENDAR |
| POST | `/reservations/{reservation_id}/nachberechnung` | MANAGE_CALENDAR + EDIT_CALENDAR_BOOKINGS |
| POST | `/reservations/{reservation_id}/nachberechnung/senden` | MANAGE_CALENDAR + EDIT_CALENDAR_BOOKINGS |
| POST | `/reservations/{reservation_id}/nachberechnung/bezahlt` | MANAGE_CALENDAR + EDIT_CALENDAR_BOOKINGS |
| POST | `/reservations/{reservation_id}/nachberechnung/erfasst` | MANAGE_CALENDAR + EDIT_CALENDAR_BOOKINGS |
| POST | `/reservations/{reservation_id}/nachberechnung/{link_id}/offen` | MANAGE_CALENDAR + EDIT_CALENDAR_BOOKINGS |
| DELETE | `/reservations/{reservation_id}/nachberechnung` | MANAGE_CALENDAR + EDIT_CALENDAR_BOOKINGS |
| POST | `/webhook` | Stripe-Signatur (kein JWT) |

## Nachberechnung einer Website-Buchung (0469, `nachberechnung.py`)

Ein Aufenthalt wird nachträglich teurer — der Regelfall ist die manuelle
Verlängerung, bei der `reservations.move(reprice=True)` den Preis neu rechnet.
Der Gast zahlt die Differenz über einen **Stripe Payment Link**.

- **Nur `channel='website'`.** Bei einer OTA-Buchung kassiert das Portal (dort
  wird auch verlängert), beim Marktplatz läuft die Zahlung über die eigene
  Buchungsstrecke, bei `direct` (Telefon/vor Ort) ist der Zahlweg außerhalb des
  Systems vereinbart. Ein gesetztes `source_channex_booking_id` sperrt zusätzlich
  (fail-closed), auch wenn der Kanal `website` sagt.
- **Provisionsfrei.** 0380: eine Buchung über die eigene Website läuft nicht
  über uns. `application_fee_cents = 0`; der 5-%-Satz `tenants.addon_fee_bps`
  gilt für Zusatzleistungen und wird hier NICHT herangezogen.
- **Warum ein Link und kein off-session-Charge:** Der reale Anlass war eine aus
  Lodgify übernommene Buchung — kein Stripe-Customer, keine gespeicherte Karte.
  `charge_due_balance` kann dort nichts belasten.
- **Betrag:** Client-Vorschlag, serverseitig gegen `total_amount − paid_amount`
  geprüft (mehr → 422). Vorbelegung in der Oberfläche aus dem `repriced`-
  Ereignis (`detail.previous_total`, seit 0469); fehlt es (Altbestand), gibt es
  keinen Vorschlag statt einer erfundenen Zahl.
- **Grund ist Pflicht** (3–500 Zeichen). Er ist der Produktname auf der
  Stripe-Zahlseite und steht in der Mail an den Gast — kein Gastname dort.
- **Gegenzustände (Wurzel 1):** `move()` und `cancel()` schließen einen offenen
  Link VOR der Änderung (fail-closed, ein 502 bricht den Vorgang ab). Eine
  bezahlte Nachberechnung erhöht `reservations.paid_amount` und zieht die
  geplante Restzahlung nach (`passe_restzahlung_an`) — sonst zöge der
  stündliche Worker-Tick den alten Betrag ein.
- **Verbuchung:** `payments`-Zeile Typ `surcharge` mit der Checkout-Session als
  `gateway_ref` (nicht dem PaymentIntent — sonst greift der
  `payment_intent.succeeded`-Pfad und plant eine Auszahlung). Idempotent über
  den Link-Claim (`status open → paid`) plus Unique-Index auf der Session.
- **Zustellung:** `/senden` mailt den Link in der Sprache des Gastes unter der
  Marke myBestDays. Eigener Rate-Limit-Bucket (10/60), weil der Aufruf ein
  fremdes Postfach befüllt.
### Bezahlt ohne Karte (0470)

- **Sichtbarkeit:** `GET .../nachberechnung` liefert neben dem offenen Link die
  Liste der bereits BEZAHLTEN Nachberechnungen (`bezahlt[]`, neueste zuerst) mit
  Betrag, Grund, Zeitpunkt und Herkunft. Ohne sie verschwand nach der Zahlung
  jede Spur: sichtbar blieb allein ein gestiegenes `paid_amount`.
- **`/bezahlt`** markiert den offenen Link als bezahlt (Gast hat bar/überwiesen).
  Reihenfolge: ZUERST bei Stripe deaktivieren, dann buchen — andernfalls nimmt
  die URL weiter Geld an, während die Zahlung schon verbucht ist.
- **`/erfasst`** legt eine bereits bezahlte Nachberechnung ohne Link an (Zahlung
  an der Rezeption). Die Stripe-Spalten sind seit 0470 optional; ein CHECK
  erzwingt alles-oder-nichts, ein zweiter, dass eine Zeile ohne Link nie `open`
  ist (sie würde den „ein offener Link je Buchung"-Index blockieren).
- **`/{link_id}/offen`** nimmt eine manuelle Bezahlt-Markierung zurück (Grund
  Pflicht). NUR bei `paid_manually`: eine über Stripe eingegangene Zahlung ist
  eine Tatsache und wird erstattet, nicht umgedeutet. Blockiert bei
  festgeschriebener Rechnung (GoBD). Gegenzustand: Beleg wird gelöscht (es ist
  kein Geld geflossen), `paid_amount` sinkt, geplante Restzahlung wird nachgezogen.
- **Zeitleiste:** `surcharge_paid` (Stripe), `surcharge_paid_manually`,
  `surcharge_unpaid` — mit Label und Symbol in `booking-timeline.tsx`. Beträge
  (`amount`, `previous_total`) und die Freitexte (`grund`/`reason`) hängen an der
  Betrags-Maske (§4.3), sonst läse Personal ohne Finanzeinblick sie mit.
- **Diagnose:** `bash scripts/diagnose/nachberechnung-pruefen.sh` (read-only
  gegen die Live-DB: unzulässige offene Links, veraltete Basisbeträge, bezahlte
  Links ohne Beleg, falsche geplante Restzahlungen, Direktpfad/RLS).

## Konfiguration

`stripe_secret_key`, `stripe_webhook_secret`, `stripe_publishable_key`
(NEXT_PUBLIC_ im Frontend), `stripe_platform_fee_pct` (Default 0). Secrets nur
über Coolify-Env, nie im Repo.

## Tests

Gegen die echte Stripe-Test-API (Sandbox, `sk_test_…`) — kein Mock; ohne Key
werden netzabhängige Tests übersprungen. DB als In-Memory-Fake.

## Go-Live-Checkliste Stripe (Test → Live)

„Key getauscht" ist KEINE Live-Schaltung. Stripe trennt Test und Live
vollständig: Connected Accounts, Kunden, Abos, Preise, Webhook-Endpunkte,
Signing-Secrets und gespeicherte Zahlungsmethoden aus dem Testmodus existieren
live NICHT. Wer nur `STRIPE_SECRET_KEY` tauscht, hat drei stille Fehler
gleichzeitig — keinen Webhook (jede Zahlung bleibt „pending"), keine Preise
(Abo-Anlage scheitert) und ein `acct_…` in der DB, das live niemand kennt,
während `stripe_charges_enabled = true` weiter Verkaufsbereitschaft behauptet.

Reihenfolge (die letzten zwei Schritte sind der Beweis, nicht die Hoffnung):

1. **Konto aktivieren** (Stripe-Dashboard, Live): Geschäftsangaben, Bankkonto,
   Verantwortliche. Ziel: `charges_enabled = true` und die Capabilities
   `card_payments`/`transfers` auf `active`. Ohne sie gibt es keinen Charge und
   keine Weiterleitung an den Betrieb.
2. **Connect freischalten**: Plattform-Profil ausfüllen (Branche, Zahlungsfluss,
   Verlusthaftung). ACHTUNG: `type=custom` ist für NEUE Integrationen abgekündigt.
   Ob unser Aufruf live erlaubt ist, beweist nur ein Versuch —
   `stripe_live_check.py --probe-connect` legt genau einen Account an und löscht
   ihn sofort wieder. Lehnt Stripe ab, ist das Gegenstück
   `controller.stripe_dashboard.type=none` + `controller.losses.payments=application`
   + `controller.fees.payer=application` (dasselbe Verhalten, neue Parameter) —
   dann muss `create_connect_account` umgestellt werden.
3. **Alte Kennungen aus der DB nehmen**: `deploy/billing/stripe_mode_reset.py`
   (erst Bericht, dann `--apply`). Setzt Connect-Account, KYC-Flags, Kunde/Abo und
   Co-Host-Konten zurück. Zahlungs-/Auszahlungsprotokoll bleibt unberührt — es
   dokumentiert den Testbetrieb und ist keine Zeigerliste.
4. **Preise live anlegen**: `STRIPE_SECRET_KEY=sk_live_… python3
   deploy/billing/seed_stripe_prices.py` (Dry-Run), dann `--apply`. Idempotent
   über `lookup_key`; Beträge bleiben die Quelle der Wahrheit in Stripe.
5. **Webhook-Endpunkt live registrieren** auf die Produktions-URL
   `…/api/v1/payments/webhook` mit ALLEN Events, die `webhook.py` verarbeitet
   (16, siehe `BENOETIGTE_EVENTS` in `stripe_live_check.py`) — inklusive
   `charge.dispute.created`/`charge.dispute.closed`, die am Staging-Endpunkt
   fehlen. Danach das **Signing-Secret dieses Endpunkts** in
   `STRIPE_WEBHOOK_SECRET`; das Test-Secret verwirft live jedes Ereignis
   (fail-closed, richtig, aber unsichtbar).
6. **Env in Coolify** (nur dort, nie im Repo): `STRIPE_SECRET_KEY=sk_live_…`,
   `STRIPE_PUBLISHABLE_KEY=pk_live_…`, `STRIPE_WEBHOOK_SECRET=whsec_…` (Live-
   Endpunkt). Der Publishable Key geht NICHT als `NEXT_PUBLIC_` ins Frontend —
   die Gast-Strecke holt ihn vom Intent-Endpunkt, es gibt nur diese eine Stelle.
   Danach API + Worker neu deployen (`lru_cache` hält den Client pro Prozess).
7. **Prüfen**: `apps/api/.venv/bin/python deploy/billing/stripe_live_check.py`
   muss „BEREIT" melden — Konto, Capabilities, Webhook-Events, alle
   `lookup_keys`, und dass KEINE gespeicherte Kennung aus dem anderen Modus
   stammt (jede wird bei Stripe abgefragt, kein Prefix-Raten).
8. **Erste echte Zahlung** mit einer eigenen Karte über die Gast-Strecke, danach
   erstatten. Erst dieser Durchlauf beweist Webhook, `payment_status`, Provision
   und Auszahlung.

Zwei Entscheidungen, die vor dem ersten echten Geld stehen müssen:
`stripe_separate_transfers` (Destination Charge vs. Separate Charge — solange
`false`, MUSS der Auszahlungslauf gesperrt bleiben, sonst wird doppelt
ausgezahlt) und die Frage, welche Kanäle überhaupt Charges erzeugen (Tabelle
oben: `direct` = Direct Charge beim Betrieb, `portal` = über die Plattform,
OTA = kein Charge).

## PayPal (Complete Payments Platform / Multiparty)

Zweites Gateway neben Stripe — dasselbe Muster (verbundene Verkäufer + Plattform-
Provision), aber PayPals Multiparty-API. Dateien: `paypal_client.py`,
`paypal_webhook.py` + PayPal-Methoden in `service.py`/`router.py`.

- **Onboarding (Partner Referrals / „Connected Path")** — jeder Betrieb verbindet
  sein EIGENES PayPal-Geschäftskonto. `start_paypal_onboarding` erzeugt eine
  `action_url`, zu der der Betrieb umgeleitet wird; nach Rückkehr lädt der
  Return-Handler den echten Status (`sync_paypal_status`). Sellbar NUR wenn
  `payments_receivable && primary_email_confirmed` (fail-closed).
- **Gast-Zahlung (Order + Provision)** — `create_paypal_order` legt eine Order mit
  `payee.merchant_id` (Verkäufer) + `platform_fees` (Plattform-Provision, gleicher
  Satz wie Stripe: `stripe_platform_fee_pct`) an; `capture_paypal_order` zieht sie
  ein. Beträge als Major-Unit-Strings (Zero-Decimal: HUF/JPY/TWD). „Im Namen des
  Verkäufers": PayPal-Auth-Assertion-JWT + BN-Code-Header auf create/capture/refund.
- **Refund** — `refund_capture` über die `paypal_capture_id`; die Provision wird
  anteilig zurückgegeben (bei PayPal NICHT automatisch — explizit `platform_fees`).
  Der Storno-Refund-Pfad (`refund_payment`) verzweigt nach `gateway`.
- **Webhook** (`paypal_webhook.py`) — Signatur über die PayPal-API verifiziert
  (kein Fetch auf die angreiferkontrollierte `cert_url` → SSRF-frei), idempotent
  über `transmission_id` (`paypal_webhook_event`). Behandelt
  `MERCHANT.ONBOARDING.COMPLETED`/`MERCHANT.PARTNER-CONSENT.REVOKED` (Onboarding-
  Spiegel) + `PAYMENT.CAPTURE.COMPLETED|DENIED|DECLINED|REFUNDED` (Zahlstatus).

### PayPal-Endpoints

| Methode | Pfad | Zugriff |
|---|---|---|
| POST | `/paypal/onboarding` | MANAGE_BILLING |
| POST | `/paypal/status` | MANAGE_BILLING |
| GET | `/paypal/onboarding/return` | public (PayPal-Redirect) |
| POST | `/paypal/booking/{reservation_id}/order` | public (Gast) |
| POST | `/paypal/order/{order_id}/capture` | public (Gast) |
| POST | `/paypal/webhook` | PayPal-Signatur (kein JWT) |

### PayPal-Konfiguration

`paypal_client_id`, `paypal_secret`, `paypal_bn_code`,
`paypal_platform_merchant_id`, `paypal_webhook_id`, `paypal_base_url`
(Sandbox/Live), `paypal_publishable_client_id` (NEXT_PUBLIC_). Secrets nur über
Env. Fehlt die Config → fail-closed (503 bzw. Webhook nicht verarbeitet).

### Go-Live-Checkliste (außerhalb des Codes zu besorgen)

PayPal Multiparty verlangt eine Partner-Freischaltung — das kann NICHT im Code
gelöst werden. Für LIVE (Sandbox testet ohne Approval):

1. PayPal-Developer-App Typ **Platform** anlegen → `client_id`/`secret` (Partner).
2. **Partner-Approval** beantragen (Formular; PayPal-Rep evaluiert). Ohne Approval
   → Live-Calls geben 401.
3. **BN-Code** (`PayPal-Partner-Attribution-Id`): App-Einstellungen → Reports.
4. **platform_fee-Feature (`PARTNER_FEE`)** durch PayPal freischalten lassen — sonst
   schlagen Provisions-Orders fehl.
5. **Webhook** registrieren (`POST /v1/notifications/webhooks`) → `webhook_id` in
   die Env. Events: PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED,
   MERCHANT.ONBOARDING.COMPLETED, MERCHANT.PARTNER-CONSENT.REVOKED.
6. `paypal_base_url` auf `https://api-m.paypal.com` (Live) umstellen.

### Sicherheit (Wurzel 6)

`payments` und `tenant_billing_profile` sind gegen den anon-Direktpfad gehärtet
(`revoke` + restriktive tenant-Policy, Migrationen 0169/0172) — die neuen PayPal-
Felder (capture_id/order_id, merchant_id) erben das. `paypal_webhook_event` ist
server-only (revoke, 0174).

## Bewusst offen

- Gast-Checkout-UI (PayPal-Buttons/Stripe-PaymentElement) ist im Web noch nicht
  gebaut — es gibt aktuell keine Gast-Checkout-Seite in `apps/web`. Die Backend-
  Endpunkte (`create_paypal_order`/`capture`) sind fertig und docken an, sobald
  die Gast-Buchungsstrecke gebaut wird.
- Owner→Owner-Auszahlung über Stripe (Owner sind im Datenmodell keine Stripe-
  Accounts).
- Ein Revolut-Adapter existiert NICHT (mehr): `gateways.py` war eine nie
  eingebundene Adapter-Hülle (0 Aufrufer) und wurde entfernt. Kommt Revolut
  zurück, entsteht der Adapter neu — mit Anbindung statt auf Vorrat.
