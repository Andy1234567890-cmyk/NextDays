-- 0005_messages_payments.sql — Posteingang und Zahlungen
--
-- messages/payments hängen an reservations; Tenant-Bezug erfolgt in den
-- RLS-Policies (0007) über den Join reservation -> tenant.

create type public.payment_type as enum ('deposit', 'full', 'refund');
create type public.payment_status as enum (
    'pending', 'succeeded', 'failed', 'refunded'
);

create table public.messages (
    id             uuid primary key default gen_random_uuid(),
    reservation_id uuid not null references public.reservations (id) on delete cascade,
    sender         text not null,
    body           text not null,
    channel        text not null,
    created_at     timestamptz not null default now()
);

create index messages_reservation_id_idx on public.messages (reservation_id);

create table public.payments (
    id             uuid primary key default gen_random_uuid(),
    reservation_id uuid not null references public.reservations (id) on delete cascade,
    amount         numeric(12, 2) not null check (amount >= 0),
    currency       text not null,
    type           public.payment_type not null,
    stripe_ref     text,
    status         public.payment_status not null default 'pending',
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index payments_reservation_id_idx on public.payments (reservation_id);
