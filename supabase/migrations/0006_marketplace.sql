-- 0006_marketplace.sql — Marktplatz-Erweiterung (Phase 2, Struktur jetzt)
--
-- portal_guests sind die Gast-Accounts der Demand-Seite (tenant-übergreifend),
-- getrennt von den vermieterseitigen public.users. Logik folgt in Phase 2.

create type public.commission_status as enum ('pending', 'invoiced', 'paid');

create table public.portal_guests (
    id         uuid primary key references auth.users (id) on delete cascade,
    email      text not null,
    name       text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.reviews (
    id              uuid primary key default gen_random_uuid(),
    property_id     uuid not null references public.properties (id) on delete cascade,
    portal_guest_id uuid not null references public.portal_guests (id) on delete cascade,
    rating          integer not null check (rating between 1 and 5),
    text            text,
    created_at      timestamptz not null default now()
);

create index reviews_property_id_idx on public.reviews (property_id);

create table public.commissions (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants (id) on delete cascade,
    reservation_id uuid not null references public.reservations (id) on delete cascade,
    amount         numeric(12, 2) not null check (amount >= 0),
    rate           numeric(5, 4) not null check (rate >= 0 and rate <= 1),
    status         public.commission_status not null default 'pending',
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index commissions_tenant_id_idx on public.commissions (tenant_id);
