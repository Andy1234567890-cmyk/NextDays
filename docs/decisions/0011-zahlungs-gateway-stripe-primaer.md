# ADR-0011: Zahlungs-Gateway — Stripe primär, Revolut sekundär

- Status: **akzeptiert**
- Datum: 2026-06-28
- Ersetzt: [ADR-0003](0003-zahlungs-gateway-revolut-primaer.md)

## Kontext

ADR-0003 legte Revolut als primäres Gateway fest. In der Praxis wird jedoch
**Stripe** als primäres Gateway eingesetzt:

- Stripe Connect Custom ist die Grundlage für das Plattform-Modell
  (Gastgeber-Onboarding, Provisionen einbehalten, Auszahlungen).
- Die Stripe-Integration ist vollständig implementiert (Connect-Accounts,
  Webhook-Handler, Migration 0081).
- Revolut bleibt als sekundäre Option im Adapter-Interface erhalten.

## Entscheidung

- **Stripe Connect Custom** ist das **primäre** Gateway.
- **Revolut** bleibt **sekundär/konfigurierbar** — kann pro Tenant aktiviert werden.
- Das bestehende Gateway-Adapter-Interface (`PaymentGatewayAdapter`) bleibt
  unverändert; nur die Prioritätsreihenfolge im Enum und der Default in der
  Factory-Funktion ändern sich.

## Konsequenz

- `PaymentGateway`-Enum: `stripe` an erster Stelle, `revolut` an zweiter.
- `get_adapter()` Default-Kommentar: „Default Stripe".
- Stripe Connect Endpunkte live: `POST /payments/connect/accounts`,
  `GET /payments/connect/accounts/{id}`, Webhook `account.updated`.
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` als Pflicht-Secrets.
- `REVOLUT_API_KEY` bleibt optional, kein Breaking Change.
