-- 0642_zahlungskonten.sql — Zahlungskonten des Betriebs (Buchhaltung → Bank).
--
-- WARUM: Zahlungseingänge, Bankumsätze und das Kassenbuch brauchen ein Konto,
-- auf dem sie stehen. Im alten Taskilo lagen die Zahlungskonten in Firestore
-- (`paymentAccountService.ts`), im alten SQL-Schema als `payment_accounts`
-- mit `currency DEFAULT 'EUR'` und Typen CHECKING/SAVINGS/CREDIT/CASH. Beides
-- wird hier NICHT übernommen: die Währung kommt beim Anlegen aus
-- `tenants.currency` (Wurzel 4, serverseitig, nie Default), die Typen sind die
-- fachlichen Kontoarten (bank/cash/paypal/stripe/other).
--
-- Finanzdaten sind server-only (Wurzel 6): RLS + Tenant-Policy UND revoke für
-- anon/authenticated. Nicht in supabase_realtime.

create table if not exists public.payment_accounts (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenants(id) on delete cascade,
    name             text not null,
    type             text not null
                     check (type in ('bank', 'cash', 'paypal', 'stripe', 'other')),
    iban             text,
    bic              text,
    bank_name        text,
    -- Pflicht, KEIN Default: wird beim Anlegen aus tenants.currency übernommen,
    -- wenn der Client nichts mitgibt; fehlt beides → 422 (Wurzel 4).
    currency         text not null check (currency ~ '^[A-Z]{3}$'),
    opening_balance  numeric(14,2) not null default 0,
    is_default       boolean not null default false,
    active           boolean not null default true,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

comment on table public.payment_accounts is
    'Zahlungskonten des Betriebs (Bank, Kasse, PayPal, Stripe …). Auf ihnen '
    'stehen Bankumsätze (bank_transactions), Zahlungseingänge (invoice_payments) '
    'und Kassen (cash_registers). Währung ohne Default — aus tenants.currency.';

create index if not exists payment_accounts_tenant_idx
    on public.payment_accounts (tenant_id, active);

-- Höchstens EIN Standardkonto je Betrieb.
create unique index if not exists payment_accounts_ein_standard_idx
    on public.payment_accounts (tenant_id)
    where is_default;

drop trigger if exists trg_payment_accounts_updated on public.payment_accounts;
create trigger trg_payment_accounts_updated
    before update on public.payment_accounts
    for each row execute function public.set_updated_at();

alter table public.payment_accounts enable row level security;

drop policy if exists payment_accounts_tenant on public.payment_accounts;
create policy payment_accounts_tenant on public.payment_accounts
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.payment_accounts from anon, authenticated;
