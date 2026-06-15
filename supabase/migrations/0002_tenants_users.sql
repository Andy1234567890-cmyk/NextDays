-- 0002_tenants_users.sql — Mandanten und Benutzer
--
-- tenant_id-Auflösung läuft über das JWT app_metadata (siehe 0008_helpers.sql).
-- public.users.id == auth.users.id (1:1-Verknüpfung mit Supabase Auth).

create type public.user_role as enum ('owner', 'staff', 'cleaner');

create table public.tenants (
    id         uuid primary key default gen_random_uuid(),
    name       text not null,
    country    text not null,             -- ISO-3166-1 alpha-2
    currency   text not null,             -- ISO-4217
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.users (
    id         uuid primary key references auth.users (id) on delete cascade,
    tenant_id  uuid not null references public.tenants (id) on delete cascade,
    role       public.user_role not null default 'owner',
    email      text not null,
    full_name  text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index users_tenant_id_idx on public.users (tenant_id);
