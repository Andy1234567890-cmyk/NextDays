-- 0010_payments_gateway.sql — Lastenheft §3 / ADR-0003: Revolut primär, Stripe sek.
--
-- payments wird gateway-agnostisch: stripe_ref -> gateway_ref + gateway-Enum.

create type public.payment_gateway as enum ('revolut', 'stripe');

alter table public.payments
    add column gateway public.payment_gateway not null default 'revolut';

-- stripe_ref in generisches gateway_ref umbenennen (bestehende Werte = Stripe-Refs).
alter table public.payments rename column stripe_ref to gateway_ref;

-- Aufschläge (Lastenheft §2.2): Reinigung, Hund, Wäsche, Nebenkosten etc.
create type public.surcharge_kind as enum (
    'cleaning', 'utilities', 'pet', 'linen', 'other'
);

create table public.surcharges (
    id          uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties (id) on delete cascade,
    kind        public.surcharge_kind not null,
    label       text not null,
    amount      numeric(12, 2) not null check (amount >= 0),
    currency    text not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index surcharges_property_id_idx on public.surcharges (property_id);
