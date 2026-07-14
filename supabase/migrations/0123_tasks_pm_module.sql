-- 0123_tasks_pm_module.sql — PM-Aufgaben-Modul (..-Nachbau, auf Bestand)
--
-- Baut auf dem bestehenden tasks-Slice (0012/0019) auf, ohne die schlanke
-- Struktur zu verwerfen. Ergänzt NUR was für die 7 ..-Unterseiten fehlt:
--   * Inspektions-Workflow (needs_inspection + inspection_state auf tasks)
--   * Herkunft/Priorität/Zeitfenster auf tasks (Kalender-Timeline, Team)
--   * task_status um in_review/reviewed erweitern? NEIN — Inspektion läuft über
--     ein eigenes nullable inspection_state, damit der Status-Lebenszyklus
--     (open/in_progress/done/cancelled) unangetastet bleibt (kein Doppel-Status).
--   * task_rules bekommt die Vorlagen-/Regel-Metadaten, die .. als
--     "Aufgabenvorlagen"/"Planmäßige"/"Regelmäßige" zeigt (kind, active,
--     assignee, priority, needs_inspection). recurrence bleibt jsonb (Bestand).
-- Realtime für die neuen Live-Flächen (checklist_items, task_rules) aktivieren.

-- Herkunft einer Aufgabe (Kalender/Team-Filter, Storno-Cleanup).
create type public.task_source as enum ('manual', 'auto', 'recurring');

-- Art einer Regel/Vorlage (task_rules dient jetzt dreierlei: reine Vorlage,
-- buchungs-getriggerte Auto-Regel, zeitplan-getriggerte Recurring-Regel).
create type public.task_rule_kind as enum ('template', 'auto', 'recurring');

-- --- tasks: Inspektion + PM-Metadaten -------------------------------------

alter table public.tasks
    add column needs_inspection  boolean not null default false,
    -- nur gesetzt, wenn needs_inspection: 'to_review' | 'reviewed'
    add column inspection_state  text,
    add column source            public.task_source not null default 'manual',
    add column priority          integer not null default 0,
    -- Zeitfenster für die Kalender-Timeline (Balken). due_at bleibt als
    -- Fälligkeit bestehen; start_at/end_at sind das Anzeige-Fenster.
    add column start_at          timestamptz,
    add column end_at            timestamptz,
    add column completed_at      timestamptz,
    add column completed_by      uuid references public.users (id) on delete set null;

alter table public.tasks
    add constraint tasks_inspection_state_chk
    check (inspection_state is null or inspection_state in ('to_review', 'reviewed'));

create index tasks_inspection_state_idx
    on public.tasks (tenant_id, inspection_state);
create index tasks_property_start_idx
    on public.tasks (tenant_id, property_id, start_at);
create index tasks_status_idx
    on public.tasks (tenant_id, status);

-- --- task_rules: Vorlage / Auto / Recurring in einer Tabelle ---------------

alter table public.task_rules
    add column kind             public.task_rule_kind not null default 'template',
    add column description      text,
    add column active           boolean not null default true,
    add column priority         integer not null default 0,
    add column assignee_id      uuid references public.users (id) on delete set null,
    add column needs_inspection boolean not null default false,
    -- buchungs-getriggert (kind='auto'): Trigger relativ zu check_in/check_out.
    add column remove_on_cancellation boolean not null default true,
    -- Fortschritt der Recurring-Materialisierung (idempotent pro Tag).
    add column last_materialized_on  date;

create index task_rules_kind_idx on public.task_rules (tenant_id, kind);

-- Checklisten-Vorlage einer Regel (Snapshot beim Materialisieren in
-- checklist_items kopiert). requires_photo erzwingt Foto-Nachweis.
create table public.task_rule_items (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants (id) on delete cascade,
    rule_id      uuid not null references public.task_rules (id) on delete cascade,
    label        text not null,
    room         text,
    requires_photo boolean not null default false,
    sort_order   integer not null default 0,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index task_rule_items_rule_idx
    on public.task_rule_items (tenant_id, rule_id, sort_order);

-- Foto-Pflicht auch auf konkreten Checklist-Items (aus Vorlage übernommen).
alter table public.checklist_items
    add column requires_photo boolean not null default false;

-- --- Trigger + RLS für neue Tabelle ---------------------------------------

create trigger set_updated_at before update on public.task_rule_items
    for each row execute function public.set_updated_at();

alter table public.task_rule_items enable row level security;
create policy task_rule_items_tenant on public.task_rule_items
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- --- Realtime-Publication (idempotenter Guard, wie 0120/0122) --------------

do $$
declare
  t text;
  tables text[] := array['task_rules', 'task_rule_items', 'checklist_items'];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
