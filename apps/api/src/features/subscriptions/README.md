# subscriptions — Abo-Billing (Tenant → myNextDays)

Der Tenant zahlt an myNextDays: **Grundgebühr + Objekt-Staffel (graduated) +
Zusatzmodule**. Getrennt vom Gast→Vermieter-Fluss (`features/payments`, Stripe
Connect), der GENAU umgekehrt läuft.

## Preise

Liegen ausschließlich in **Stripe** (Quelle der Wahrheit), angelegt idempotent
per `deploy/billing/seed_stripe_prices.py`. Nie im Code hardcoden (Wurzel 4).
Stabile `lookup_key`s:

| lookup_key | Bedeutung | Betrag (EUR) |
|---|---|---|
| `mnd_grundtarif_month` | Grundtarif, graduated | 19,90 flat / +6 / +5 / +4 |
| `modul3_flat` | Buchhaltung | 30,00 |
| `modul4_flat` / `modul4_per_seat` | Mitarbeiter (flat/Nutzer) | 19,90 / 2,50 |
| `modul6_flat` / `modul6_per_room` | Hotel (flat/Zimmer) | 600,00 / 1,50 |

Modul 5 (Jobmarkt, 2 % Umsatz) und die Buchungs-Provisionen (0,5 % extern /
8 % Portal) sind **variabel** → nachgelagert als Invoice-Item bzw. über die Connect-
`application_fee`, KEIN festes Stripe-Produkt.

**27 EU-Staaten:** graduated + Stripe **Adaptive Pricing** (Checkout rechnet in
die Käuferwährung um, Stripe-Kurs — kein erfundener Wechselkurs). Multi-Currency
am graduated Preis via `currency_options` geht NICHT (Stripe ignoriert es still).

## Objektzahl = graduated quantity (Wurzel 1)

Die abrechenbare Objektzahl = `COUNT(properties WHERE status='active')`
(draft/inactive zählen nicht). Bei jedem Property-`create`/`update(status)`/
`delete` zieht ein best-effort-Hook im properties-Slice
(`_sync_subscription_quantity`) die quantity nach — neu BERECHNET, nicht ±1,
daher idempotent (Wurzel 2). Ein Fehler dort kippt den Property-Pfad nie (Wurzel 5).

## DB (Migration 0117)

- `tenant_subscription` — 1:1 pro Tenant (Stripe-Customer/Subscription, Status,
  Periodenende, gemeldete Objektzahl). RLS: nur eigener Tenant liest.
- `tenant_module_entitlement` — gebuchte Module, steuert Feature-Gates. UNIQUE
  (tenant_id, module_key) als Idempotenz-Backstop.
- Beide in `supabase_realtime` (Billing-UI live).

## Webhook (im payments-Webhook)

`customer.subscription.*` → Status + Modul-Entitlements spiegeln (Gegenzustand:
entferntes Modul wird deaktiviert, nicht gelöscht). `invoice.paid`/
`payment_failed` → nur die sicheren Übergänge (führt der Subscription-Status).
Idempotent über `stripe_webhook_event` (Wurzel 2), Signatur fail-closed (Wurzel 5).

## Externe Provision (OTA-Buchungen, Migration 0118)

Preisliste: einheitlich **0,5 %** auf Buchungen über externe Kanäle
(Booking/Airbnb/Vrbo), unabhängig von der Objektzahl — Quelle der Wahrheit ist
`COMMISSION_RATE_STANDARD` in `schemas.py`. Die frühere Staffel (1 % bis 100
Objekte, 0,5 % ab 101) ist mit Migration `0310_provision_einheitlich_0_5_prozent`
abgeschafft. Da wir den Gast dabei NICHT kassieren, läuft die Provision
nachgelagert über `commission_ledger`:

- **Erfassung:** `bookings_sync` legt beim OTA-Import eine Ledger-Zeile an
  (best-effort-Hook, kippt den Import nie — Wurzel 5). Satz ist der eine
  einheitliche 0,5-%-Wert, keine Staffel. Idempotent über UNIQUE(reservation_id)
  — Wurzel 2.
- **Gegenzustand (Wurzel 1):** Storno → offene Zeile weg; Kanalwechsel extern→eigen
  oder Betrag→0 beim Resync → offene Zeile weg. Bereits fakturierte Zeilen bleiben.
- **Abrechnung:** `bill_pending_commissions(tenant, period)` bucht alle pending als
  EIN Stripe-Invoice-Item aufs Abo, setzt sie auf `invoiced`. Idempotent, gemischte
  Währungen → 409 (nicht raten). Kein Abo → 409.

> Die Portal-Provision (8 %) ist NICHT hier — die läuft sofort am Gast-Charge
> (payments.application_fee). Nur EXTERNE Buchungen kommen ins Ledger.

## Endpunkte (`/api/v1/subscriptions`, alle MANAGE_BILLING)

- `GET /status` — Abo-Status + Objektzahl + Module (Billing-UI)
- `GET /pricing` — echte Stripe-Beträge für die UI
- `POST /checkout` — Stripe Checkout (Grund-Abo + Module); 409 wenn schon aktiv
- `POST /portal` — Stripe Billing-Portal
- `POST /sync-quantity` — Objektzahl → Stripe-quantity nachziehen
- `GET /commissions` — offene externe Provisionen + aktueller Satz
- `POST /bill-commissions?period=YYYY-MM` — offene Provisionen fakturieren

> **Offen (bewusst):** Die MONATLICHE Automatik (Cron/Worker-Tick, der
> `bill-commissions` am Monatsanfang pro Tenant auslöst) ist noch nicht verdrahtet —
> der Endpunkt existiert, die Auslösung erfolgt aktuell manuell/extern. Jobmarkt-
> Provision (Modul 5, 2 %) fehlt komplett, da das Modul noch nicht gebaut ist.
