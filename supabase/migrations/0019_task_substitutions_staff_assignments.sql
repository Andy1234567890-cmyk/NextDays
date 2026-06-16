-- 0019_task_substitutions_staff_assignments.sql — Lastenheft §4.3
--
-- Vertretungs-Feature (Mitarbeiter fragt Vertretung für eine Aufgabe an) und
-- feste Objekt-Zuweisung (Admin definiert Stamm-Mitarbeiter pro Haus).

create type public.substitution_status as enum ('requested', 'accepted', 'declined');

-- Vertretungsanfrage zu einer Aufgabe: angefragt vom zugewiesenen Mitarbeiter.
create table public.task_substitutions (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants (id) on delete cascade,
    task_id       uuid not null references public.tasks (id) on delete cascade,
    requested_by  uuid not null references public.users (id) on delete cascade,
    accepted_by   uuid references public.users (id) on delete set null,
    status        public.substitution_status not null default 'requested',
    note          text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index task_substitutions_tenant_id_idx on public.task_substitutions (tenant_id);
create index task_substitutions_task_id_idx on public.task_substitutions (task_id);

-- Stamm-Mitarbeiter: feste Zuweisung eines Mitarbeiters zu einem Haus (§4.3).
create table public.staff_property_assignments (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    user_id     uuid not null references public.users (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    created_at  timestamptz not null default now(),
    unique (user_id, property_id)
);

create index staff_property_assignments_tenant_id_idx
    on public.staff_property_assignments (tenant_id);

-- updated_at-Trigger (nur task_substitutions hat updated_at).
create trigger set_updated_at before update on public.task_substitutions
    for each row execute function public.set_updated_at();

-- RLS (beide tenant-direkt).
alter table public.task_substitutions enable row level security;
create policy task_substitutions_tenant on public.task_substitutions
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.staff_property_assignments enable row level security;
create policy staff_property_assignments_tenant on public.staff_property_assignments
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
