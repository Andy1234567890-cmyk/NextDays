-- 0014_messaging_content_misc.sql — Lastenheft §2.4/§4/§5/§7
-- Messaging-Trigger, dreisprachige Standardtexte, Sperrungs-Workflow,
-- Zählerstände, Miteigentümer, Dashboard-Layouts, Abos (Preismodell).

-- === Messaging (Lastenheft §2.4) ===
create table public.message_templates (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenants (id) on delete cascade,
    name       text not null,
    -- dreisprachige Inhalte (ADR-0004): { "de": "...", "da": "...", "en": "..." }
    body_i18n  jsonb not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index message_templates_tenant_id_idx on public.message_templates (tenant_id);

create table public.message_triggers (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    template_id uuid not null references public.message_templates (id) on delete cascade,
    -- Trigger-Definition (z.B. "5 Min nach Buchung", "Anreisetag 06:45",
    -- "Check-in-Formular ausgefüllt") als jsonb.
    trigger_spec jsonb not null default '{}',
    -- Versandkanäle: ["email","sms","ota"] (Multi-Channel).
    channels    text[] not null default '{}',
    enabled     boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index message_triggers_tenant_id_idx on public.message_triggers (tenant_id);

-- === Zentralisierte Standardtexte (Lastenheft §5) ===
create table public.content_blocks (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenants (id) on delete cascade,
    kind       text not null,                 -- house_rules, checkin, guide, ...
    body_i18n  jsonb not null default '{}',   -- DE/DK/EN
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index content_blocks_tenant_id_idx on public.content_blocks (tenant_id);

create table public.content_assignments (
    id          uuid primary key default gen_random_uuid(),
    block_id    uuid not null references public.content_blocks (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    unique (block_id, property_id)
);

-- === Sperrungs-Workflow (Lastenheft §4.2) ===
create type public.block_request_status as enum ('pending', 'approved', 'rejected');

create table public.block_requests (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    requested_by uuid not null references public.users (id) on delete cascade,
    start_date  date not null,
    end_date    date not null,
    status      public.block_request_status not null default 'pending',
    decided_by  uuid references public.users (id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    check (end_date >= start_date)
);

create index block_requests_tenant_id_idx on public.block_requests (tenant_id);

-- === Zählerstände (Lastenheft §4.2, append-only via RLS) ===
create table public.meter_readings (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    meter_kind  text not null,                -- strom, wasser, gas, ...
    value       numeric(14, 3) not null,
    read_at      date not null,
    created_by  uuid references public.users (id) on delete set null,
    created_at  timestamptz not null default now()
);

create index meter_readings_property_id_idx on public.meter_readings (property_id);

-- === Miteigentümer (Lastenheft §6) ===
create table public.co_owners (
    id          uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties (id) on delete cascade,
    name        text not null,
    email       text,
    phone       text,
    share_percent numeric(5, 2),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index co_owners_property_id_idx on public.co_owners (property_id);

-- === Dashboard-Personalisierung (Lastenheft §2.1) ===
create table public.dashboard_layouts (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.users (id) on delete cascade,
    -- Kachel-Layout (Position, Größe, Sichtbarkeit) als jsonb.
    layout     jsonb not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id)
);

-- === Preismodell (ADR-0006): unit-basierte Abos ===
create table public.plans (
    id         uuid primary key default gen_random_uuid(),
    name       text not null,                 -- z.B. "1-5 Häuser"
    min_units  integer not null default 1,
    max_units  integer,                        -- null = unbegrenzt
    price      numeric(12, 2) not null check (price >= 0),
    currency   text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.subscriptions (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants (id) on delete cascade,
    plan_id      uuid not null references public.plans (id) on delete restrict,
    active_units integer not null default 0 check (active_units >= 0),
    status       text not null default 'active',
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index subscriptions_tenant_id_idx on public.subscriptions (tenant_id);
