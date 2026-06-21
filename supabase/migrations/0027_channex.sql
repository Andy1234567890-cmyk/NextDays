-- 0027_channex.sql
-- Channex-Integration (Channel-Manager / OTA-Distribution).
--
-- Channex ist der externe Channel-Manager (Verteilung zu Booking.com, Airbnb,
-- Expedia …). Diese Migration legt die Mapping-Tabellen an, die unsere lokalen
-- Entitäten (properties, Einheiten, Preispläne) mit den Channex-IDs verknüpfen,
-- plus eine Tabelle für eingehende Buchungen aus Channex.
--
-- NextDays-Muster: tenant-scoped, RLS via current_tenant_id(), set_updated_at-
-- Trigger, Soft-Delete via deleted_at, gen_random_uuid()-PKs.

-- ---------------------------------------------------------------------------
-- 1) channex_property_map — 1:1 lokale property ↔ Channex-Property.
-- ---------------------------------------------------------------------------
create table if not exists public.channex_property_map (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants(id) on delete cascade,
    property_id        uuid not null references public.properties(id) on delete cascade,
    channex_property_id text not null,                 -- UUID bei Channex
    sync_enabled       boolean not null default true,
    last_sync_at       timestamptz,
    last_sync_status   text,                           -- ok|error
    last_sync_error    text,
    deleted_at         timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists channex_property_map_tenant_idx
    on public.channex_property_map(tenant_id);
create unique index if not exists channex_property_map_property_uidx
    on public.channex_property_map(property_id) where deleted_at is null;
create unique index if not exists channex_property_map_channex_uidx
    on public.channex_property_map(channex_property_id);

-- ---------------------------------------------------------------------------
-- 2) channex_room_type_map — lokale Einheit/Zimmer ↔ Channex-Room-Type.
--    NextDays modelliert Einheiten nicht über eine eigene room_types-Tabelle;
--    daher referenzieren wir die property + eine lokale Logik-Kennung
--    (local_unit_ref, z.B. Einheiten-Id/Slug aus dem property-content).
-- ---------------------------------------------------------------------------
create table if not exists public.channex_room_type_map (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    property_map_id     uuid not null references public.channex_property_map(id) on delete cascade,
    local_unit_ref      text not null,                 -- lokale Einheiten-Kennung
    title               text,                          -- Anzeigename (Cache)
    channex_room_type_id text not null,                -- UUID bei Channex
    deleted_at          timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index if not exists channex_room_type_map_tenant_idx
    on public.channex_room_type_map(tenant_id);
create index if not exists channex_room_type_map_property_idx
    on public.channex_room_type_map(property_map_id);
create unique index if not exists channex_room_type_map_channex_uidx
    on public.channex_room_type_map(channex_room_type_id);

-- ---------------------------------------------------------------------------
-- 3) channex_rate_plan_map — lokaler Preisplan ↔ Channex-Rate-Plan.
--    rate_plans existiert bereits (0003); local_rate_plan_id verweist darauf.
-- ---------------------------------------------------------------------------
create table if not exists public.channex_rate_plan_map (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    room_type_map_id    uuid not null references public.channex_room_type_map(id) on delete cascade,
    local_rate_plan_id  uuid references public.rate_plans(id) on delete set null,
    title               text,                          -- Anzeigename (Cache)
    channex_rate_plan_id text not null,                -- UUID bei Channex
    deleted_at          timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index if not exists channex_rate_plan_map_tenant_idx
    on public.channex_rate_plan_map(tenant_id);
create index if not exists channex_rate_plan_map_room_type_idx
    on public.channex_rate_plan_map(room_type_map_id);
create unique index if not exists channex_rate_plan_map_channex_uidx
    on public.channex_rate_plan_map(channex_rate_plan_id);

-- ---------------------------------------------------------------------------
-- 4) channex_booking — eingehende Buchungen aus Channex (OTA-Reservierungen).
--    revision_id + system_id zur Duplikat-Erkennung; raw = volle Payload.
-- ---------------------------------------------------------------------------
create table if not exists public.channex_booking (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    property_map_id     uuid references public.channex_property_map(id) on delete set null,
    channex_booking_id  text not null,                 -- Channex Booking-UUID
    revision_id         text,                          -- letzte verarbeitete Revision
    system_id           text,                          -- OTA-Message-Id (Dedup)
    ota_name            text,                          -- Booking.com|Airbnb|…
    ota_reservation_code text,
    status              text not null default 'new',   -- new|modified|cancelled
    arrival_date        date,
    departure_date      date,
    amount_cents        integer,                       -- Gesamtbetrag in Cent
    currency            text,
    customer            jsonb not null default '{}'::jsonb,
    raw                 jsonb not null default '{}'::jsonb,
    acknowledged_at     timestamptz,                   -- wann an Channex ge-ackt
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index if not exists channex_booking_tenant_idx
    on public.channex_booking(tenant_id);
create index if not exists channex_booking_property_idx
    on public.channex_booking(property_map_id);
create unique index if not exists channex_booking_channex_uidx
    on public.channex_booking(channex_booking_id);

-- ---------------------------------------------------------------------------
-- 5) updated_at-Trigger (NextDays-Konvention: set_updated_at).
-- ---------------------------------------------------------------------------
create trigger trg_channex_property_map_updated
    before update on public.channex_property_map
    for each row execute function public.set_updated_at();
create trigger trg_channex_room_type_map_updated
    before update on public.channex_room_type_map
    for each row execute function public.set_updated_at();
create trigger trg_channex_rate_plan_map_updated
    before update on public.channex_rate_plan_map
    for each row execute function public.set_updated_at();
create trigger trg_channex_booking_updated
    before update on public.channex_booking
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6) RLS — tenant-Isolation (tenant_id = current_tenant_id()).
-- ---------------------------------------------------------------------------
alter table public.channex_property_map  enable row level security;
alter table public.channex_room_type_map enable row level security;
alter table public.channex_rate_plan_map enable row level security;
alter table public.channex_booking       enable row level security;

create policy channex_property_map_tenant on public.channex_property_map
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy channex_room_type_map_tenant on public.channex_room_type_map
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy channex_rate_plan_map_tenant on public.channex_rate_plan_map
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy channex_booking_tenant on public.channex_booking
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
