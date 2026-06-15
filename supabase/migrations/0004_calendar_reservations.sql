-- 0004_calendar_reservations.sql — Multi-Kalender, Gäste, Buchungen
--
-- availability ist die EINE Wahrheit pro Tag/Objekt → unique(property_id, date)
-- verhindert Double-Bookings über alle Kanäle.

create type public.availability_status as enum ('open', 'booked', 'blocked');
create type public.availability_source as enum (
    'direct', 'portal', 'booking', 'airbnb', 'vrbo', 'manual'
);
create type public.reservation_channel as enum (
    'direct', 'portal', 'booking', 'airbnb', 'vrbo'
);
create type public.reservation_status as enum (
    'pending', 'confirmed', 'cancelled', 'completed'
);

create table public.guests (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenants (id) on delete cascade,
    name       text not null,
    email      text,
    phone      text,
    history    jsonb not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index guests_tenant_id_idx on public.guests (tenant_id);

create table public.availability (
    id          uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties (id) on delete cascade,
    date        date not null,
    status      public.availability_status not null default 'open',
    source      public.availability_source not null default 'manual',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (property_id, date)
);

create index availability_property_date_idx on public.availability (property_id, date);

create table public.reservations (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants (id) on delete cascade,
    property_id  uuid not null references public.properties (id) on delete restrict,
    guest_id     uuid references public.guests (id) on delete set null,
    channel      public.reservation_channel not null,
    check_in     date not null,
    check_out    date not null,
    status       public.reservation_status not null default 'pending',
    total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
    currency     text not null,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    check (check_out > check_in)
);

create index reservations_tenant_id_idx on public.reservations (tenant_id);
create index reservations_property_id_idx on public.reservations (property_id);
