-- 0082_payments_core.sql — Stripe Payment-Kern (Feature 14)
--
-- Ergänzt die für Online-Zahlung nötigen Felder. KEINE neue Tabelle — die
-- betroffenen Tabellen (payments, reservations, tenant_billing_profile) sind
-- über 0054 bereits in der supabase_realtime-Publication (replica identity full),
-- neue Spalten erscheinen dort automatisch. Daher hier KEIN add-table nötig.
--
-- Inhalt:
--   1. payments.gateway-Default revolut -> stripe (Stripe ist jetzt primär,
--      gedreht ggü. ADR-0003; Revolut bleibt sekundäre Option).
--   2. reservations.payment_status — eigener Enum (NICHT der bestehende
--      public.payment_status der payments-Tabelle; andere Wertemenge).
--   3. properties.deposit_amount — Kautionsbetrag pro Objekt (nullable = keine
--      Kaution / nicht gesetzt; KEIN Default-Erfinden).

-- 1. Stripe als Default-Gateway neuer Zahlungen ----------------------------
alter table public.payments
  alter column gateway set default 'stripe';

-- 2. Zahlstatus der Reservierung -------------------------------------------
-- Eigener Typname, da public.payment_status (0005) bereits für die payments-
-- Tabelle existiert und eine andere Wertemenge hat.
do $$
begin
  create type public.reservation_payment_status as enum (
    'unpaid', 'pending', 'paid', 'refunded', 'deposit_held'
  );
exception when duplicate_object then null;
end $$;

alter table public.reservations
  add column if not exists payment_status public.reservation_payment_status
    not null default 'unpaid';

comment on column public.reservations.payment_status is
  'Online-Zahlstatus der Buchung (Stripe). unpaid=keine Online-Zahlung; '
  'pending=PaymentIntent offen; paid=bezahlt; refunded=erstattet; '
  'deposit_held=Kaution vorautorisiert.';

-- 3. Kautionsbetrag pro Objekt ---------------------------------------------
alter table public.properties
  add column if not exists deposit_amount numeric(12, 2)
    check (deposit_amount is null or deposit_amount >= 0);

comment on column public.properties.deposit_amount is
  'Kautionsbetrag (Security Deposit) für Online-Vorautorisierung. '
  'NULL = keine Kaution konfiguriert.';

-- 4. Webhook-Idempotenz ----------------------------------------------------
-- Stripe kann denselben Event mehrfach zustellen (at-least-once). Die Event-ID
-- (evt_...) wird hier festgehalten; ein zweiter Eintrag derselben ID wird vom
-- Handler übersprungen. Rein technische Tabelle (kein Tenant-Bezug, KEIN
-- Realtime — sie speist keine UI).
create table if not exists public.stripe_webhook_event (
    id           text primary key,             -- Stripe Event-ID (evt_...)
    type         text not null,
    received_at  timestamptz not null default now()
);

comment on table public.stripe_webhook_event is
  'Verarbeitete Stripe-Webhook-Event-IDs (Idempotenz, at-least-once delivery).';
