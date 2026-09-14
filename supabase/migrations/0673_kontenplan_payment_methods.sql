-- 0673_kontenplan_payment_methods.sql — Zahlungsarten (Bereich »kontenplan«)
--
-- WARUM: Rechnungen tragen eine Zahlungsart („Überweisung", „Bar", „PayPal",
-- „Karte") und ein Zahlungsziel. Das alte Werkzeug hielt die Liste nur im
-- Browser (components/accounting/PaymentMethodsTab.tsx, Typen BANK_TRANSFER/
-- CASH/CARD/PAYPAL/OTHER). Hier wird sie Stammdatum des Betriebs:
--   * `type` deckungsgleich mit dem Pydantic-Literal in
--     bereiche/kontenplan/schemas.py.
--   * `payment_term_days` OHNE Default — das Zahlungsziel setzt der Betrieb,
--     kein erfundenes „14" (Wurzel 4). Leer heißt: kein Ziel hinterlegt.
--   * `is_default`: GENAU EINE Standard-Zahlungsart je Tenant, erzwungen über
--     den partiellen Unique-Index (Wurzel 2: zwei gleichzeitige „als Standard"
--     enden in 23505 → 409, nicht in zwei Standards).
--   * `payment_account_id`: optional das Zahlungskonto (0642), auf dem
--     Zahlungen dieser Art eingehen.
--
-- Finanz-Stammdaten sind server-only (Wurzel 6): RLS + Tenant-Policy UND
-- revoke für anon/authenticated. Nicht in supabase_realtime.

create table if not exists public.payment_methods (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    name                text not null check (length(name) between 1 and 120),
    type                text not null
                        check (type in ('bank_transfer', 'cash', 'card', 'paypal',
                                        'direct_debit', 'other')),
    payment_term_days   integer check (payment_term_days is null
                                       or payment_term_days between 0 and 365),
    payment_account_id  uuid references public.payment_accounts(id) on delete set null,
    is_default          boolean not null default false,
    active              boolean not null default true,
    notes               text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    constraint payment_methods_name_eindeutig unique (tenant_id, name)
);

comment on table public.payment_methods is
    'Zahlungsarten des Betriebs (Überweisung, Bar, Karte, PayPal …) mit '
    'Zahlungsziel; genau eine Standard-Zahlungsart je Tenant.';

create index if not exists payment_methods_tenant_idx
    on public.payment_methods (tenant_id, active);

-- Genau EIN Standard je Tenant (DB-Backstop zur Service-Prüfung).
create unique index if not exists payment_methods_ein_standard
    on public.payment_methods (tenant_id) where is_default;

drop trigger if exists trg_payment_methods_updated on public.payment_methods;
create trigger trg_payment_methods_updated
    before update on public.payment_methods
    for each row execute function public.set_updated_at();

alter table public.payment_methods enable row level security;

drop policy if exists payment_methods_tenant on public.payment_methods;
create policy payment_methods_tenant on public.payment_methods
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.payment_methods from anon, authenticated;
