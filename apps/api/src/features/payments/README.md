# Slice: payments

Vertical Slice für Online-Zahlungen über **Stripe** (primäres Gateway; Revolut
sekundär, NotImplemented). Enthält: `router.py`, `service.py`, `schemas.py`,
`gateways.py`, `stripe_client.py`, `webhook.py`, `tests/`.

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
  | `portal` (unser Marktplatz) | **8 % all-in** | über die Plattform | myNextDays |
  | `direct` (eigene Website) | **0 %** (§5) | **Direct Charge** | Betrieb |
  | `booking`/`airbnb`/`vrbo` | 0 % am Charge (1 % monatlich) | kein Charge (409) | — |

  Die Regel dahinter: Wer an einer Buchung nichts verdient, haftet auch nicht
  für ihre Chargebacks (Lastenheft §7.1). Nur Direct Charges verlagern die
  Haftung wirklich — `on_behalf_of` tut das nachweislich NICHT.

  Voraussetzung: `stripe_charges_enabled = true`, sonst 409 (kein Fallback-Charge).
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
| POST | `/webhook` | Stripe-Signatur (kein JWT) |

## Konfiguration

`stripe_secret_key`, `stripe_webhook_secret`, `stripe_publishable_key`
(NEXT_PUBLIC_ im Frontend), `stripe_platform_fee_pct` (Default 0). Secrets nur
über Coolify-Env, nie im Repo.

## Tests

Gegen die echte Stripe-Test-API (Sandbox, `sk_test_…`) — kein Mock; ohne Key
werden netzabhängige Tests übersprungen. DB als In-Memory-Fake.

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
- Revolut-Adapter (`gateways.py`) bleibt NotImplemented.
