-- 0011_seasons_events.sql — Lastenheft §2.3: taggenaue Saisons + Events
--
-- Ersetzt die starre KW-Logik durch taggenaue Zeiträume + globale Templates.

create table public.season_templates (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenants (id) on delete cascade,
    name       text not null,                 -- z.B. "Standard", "Skagen"
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index season_templates_tenant_id_idx on public.season_templates (tenant_id);

-- Einzelne Saison einer Vorlage: Kategorie (A..G), Farbe, Prozentaufschlag.
create table public.seasons (
    id          uuid primary key default gen_random_uuid(),
    template_id uuid not null references public.season_templates (id) on delete cascade,
    category    text not null,                -- "A".."G" (frei erweiterbar)
    label       text not null,
    color       text not null,                -- Hex, frei definierbar (Legende)
    percent     numeric(6, 2) not null default 0,  -- Preisaufschlag in %
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index seasons_template_id_idx on public.seasons (template_id);

-- Taggenaue Zeiträume einer Saison (Von-Bis). Mehrere Perioden je Saison möglich.
create table public.season_periods (
    id         uuid primary key default gen_random_uuid(),
    season_id  uuid not null references public.seasons (id) on delete cascade,
    start_date date not null,
    end_date   date not null,
    created_at timestamptz not null default now(),
    check (end_date >= start_date)
);

create index season_periods_season_id_idx on public.season_periods (season_id);

-- Zuweisung von Templates an Unterkünfte (per Checkbox, Lastenheft §2.3).
create table public.season_assignments (
    id          uuid primary key default gen_random_uuid(),
    template_id uuid not null references public.season_templates (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    created_at  timestamptz not null default now(),
    unique (template_id, property_id)
);

-- Sonder-Events: ein Name, mehrere (auch unterbrochene) Zeiträume.
create table public.events (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenants (id) on delete cascade,
    name       text not null,
    percent    numeric(6, 2) not null default 0,
    color      text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index events_tenant_id_idx on public.events (tenant_id);

create table public.event_periods (
    id         uuid primary key default gen_random_uuid(),
    event_id   uuid not null references public.events (id) on delete cascade,
    start_date date not null,
    end_date   date not null,
    created_at timestamptz not null default now(),
    check (end_date >= start_date)
);

create index event_periods_event_id_idx on public.event_periods (event_id);
