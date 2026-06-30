# Slice: payments

Vertical Slice für Online-Zahlungen über **Stripe** (primäres Gateway; Revolut
sekundär, NotImplemented). Enthält: `router.py`, `service.py`, `schemas.py`,
`gateways.py`, `stripe_client.py`, `webhook.py`, `tests/`.

## Funktionen

- **Stripe Connect (Custom, voll white-label)** — Gastgeber-Konten ohne Stripe-
  Branding. Account anlegen (`type=custom`, `tos_acceptance.service_agreement=full`),
  KYC-Daten/IBAN über die eigene Dashboard-UI per `Account.update` /
  `external_account`. KEIN Stripe-hosted Onboarding-Link.
- **Gast-Zahlung (Destination Charge)** — der Gast zahlt über den Plattform-Account,
  das Geld geht per `transfer_data.destination` an den Connected Account des Tenants.
  Plattform-Provision via `stripe_platform_fee_pct` (Default 0). Voraussetzung:
  `stripe_charges_enabled = true`, sonst 409 (kein Fallback-Charge).
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

## Bewusst offen

- Owner→Owner-Auszahlung über Stripe (Owner sind im Datenmodell keine Stripe-
  Accounts).
- Revolut-Adapter (`gateways.py`) bleibt NotImplemented.
