-- 0003_properties_rates.sql — Unterkünfte und Preispläne

create type public.property_status as enum ('draft', 'active', 'inactive');

create table public.properties (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    title       text not null,
    description text,
    address     text,
    lat         double precision,
    lng         double precision,
    amenities   text[] not null default '{}',
    max_guests  integer not null default 1 check (max_guests > 0),
    photos      text[] not null default '{}',
    status      public.property_status not null default 'draft',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index properties_tenant_id_idx on public.properties (tenant_id);

create table public.rate_plans (
    id                uuid primary key default gen_random_uuid(),
    property_id       uuid not null references public.properties (id) on delete cascade,
    name              text not null,
    base_price        numeric(12, 2) not null check (base_price >= 0),
    currency          text not null,
    min_stay          integer not null default 1 check (min_stay >= 1),
    season_rules      jsonb not null default '{}',
    weekend_surcharge numeric(12, 2) not null default 0 check (weekend_surcharge >= 0),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index rate_plans_property_id_idx on public.rate_plans (property_id);
