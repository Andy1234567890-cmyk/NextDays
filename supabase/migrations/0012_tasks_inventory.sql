-- 0012_tasks_inventory.sql — Lastenheft §2.5: Aufgaben, Checklisten, Inventar

create type public.task_status as enum (
    'open', 'in_progress', 'done', 'cancelled'
);

-- Wiederkehrende/automatische Regeln, aus denen konkrete Aufgaben entstehen.
create table public.task_rules (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    name        text not null,
    -- Frequenz-Regelwerk (alle X Tage/Wochen/Monate, jährlich, saisonal) als jsonb.
    recurrence  jsonb not null default '{}',
    -- optionale saisonale Eingrenzung
    season_from date,
    season_to   date,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index task_rules_tenant_id_idx on public.task_rules (tenant_id);

-- Zuweisung einer Regel an Unterkünfte (global = keine Zeile/own flag im Service).
create table public.task_rule_assignments (
    id          uuid primary key default gen_random_uuid(),
    rule_id     uuid not null references public.task_rules (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    unique (rule_id, property_id)
);

-- Konkrete Aufgabe (manuell, aus Regel, oder buchungsgetriggert).
create table public.tasks (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants (id) on delete cascade,
    property_id    uuid references public.properties (id) on delete set null,
    rule_id        uuid references public.task_rules (id) on delete set null,
    reservation_id uuid references public.reservations (id) on delete set null,
    assignee_id    uuid references public.users (id) on delete set null,
    title          text not null,
    status         public.task_status not null default 'open',
    -- dynamische Fälligkeit: Trigger-basiert (jsonb) oder feste Zeit.
    due_spec       jsonb not null default '{}',
    due_at         timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index tasks_tenant_id_idx on public.tasks (tenant_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);

-- Checkliste pro Aufgabe; Items mit Foto-Nachweisen (Lastenheft §2.5).
create table public.checklist_items (
    id         uuid primary key default gen_random_uuid(),
    task_id    uuid not null references public.tasks (id) on delete cascade,
    label      text not null,
    room       text,
    done       boolean not null default false,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index checklist_items_task_id_idx on public.checklist_items (task_id);

create table public.checklist_photos (
    id         uuid primary key default gen_random_uuid(),
    item_id    uuid not null references public.checklist_items (id) on delete cascade,
    storage_path text not null,               -- Supabase Storage Key
    created_at timestamptz not null default now()
);

create index checklist_photos_item_id_idx on public.checklist_photos (item_id);

-- Inventar: kann unterkunftsgebunden ODER unterkunftslos sein (zentraler Pool).
create table public.inventory_items (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    property_id uuid references public.properties (id) on delete set null,
    name        text not null,
    quantity    integer not null default 0 check (quantity >= 0),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index inventory_items_tenant_id_idx on public.inventory_items (tenant_id);
