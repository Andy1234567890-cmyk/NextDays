# ADR-0003: Zahlungs-Gateway — Adapter-Pattern (superseded)

- Status: **superseded** → abgelöst durch [ADR-0011](0011-zahlungs-gateway-stripe-primaer.md)
- Datum: 2026-06-15

## Kontext

Das Lastenheft (§3) fordert die **Revolut Business API** als primäres,
kostengünstiges Zahlungs-Gateway für Mieten, Kautionen und Zusatzleistungen.
Die ursprüngliche Spezifikation und der vorhandene `payments`-Slice/`payments`-
Tabelle gingen von **Stripe** aus (Marktplatz-Auszahlungen via Connect).

## Entscheidung

- **Revolut** wird das **primäre** Gateway.
- **Stripe** bleibt **sekundär/konfigurierbar**.
- Der `payments`-Slice kapselt beide hinter einem **Gateway-Adapter-Interface**
  (analog zum `channel_manager`-Adapter-Pattern). Das aktive Gateway ist pro Tenant
  bzw. Konfiguration wählbar.
- Datenmodell: `payments.gateway` (`revolut | stripe`) + generisches `gateway_ref`
  statt des bisherigen `stripe_ref`.

## Optionen

### A) Nur Stripe (Status quo) — verworfen
Widerspricht dem Lastenheft; höhere Kosten.

### B) Nur Revolut — verworfen
Verliert Stripe-Stärken (Connect-Auszahlungen, breite Kartenabdeckung) als Fallback.

### C) Adapter, Revolut primär, Stripe sekundär (gewählt)
- Pro: folgt dem Lastenheft, hält Stripe als Option, entkoppelt das System vom
  konkreten Anbieter, testbar mit Mock-Adapter.
- Contra: etwas mehr Abstraktion; zwei Integrationen zu pflegen (Stripe nur bei
  Bedarf aktiv).

## Konsequenz

- `payments`-Slice mit `PaymentGateway`-Interface; konkrete Adapter `RevolutAdapter`,
  `StripeAdapter`.
- Migration ändert `payments`: `stripe_ref` → `gateway_ref`, neues `gateway`-Enum.
- Secrets als `SecretStr`: `REVOLUT_API_KEY` (primär), `STRIPE_SECRET_KEY` (optional).
- **0% Buchungsgebühr** im eigenen System bleibt unberührt (ADR-0006) — das Gateway
  erhebt nur seine eigenen Transaktionskosten, NextDays keine Provision auf
  PMS-Direktbuchungen.
