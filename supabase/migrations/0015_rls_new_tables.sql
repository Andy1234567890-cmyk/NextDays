-- 0015_rls_new_tables.sql — RLS + updated_at-Trigger für die neuen Tabellen
--
-- Muster wie 0008: direkt tenant-gebundene Tabellen via tenant_id, abgeleitete
-- über ihren Parent. plans ist global (kein tenant_id) -> nur lesbar.

-- === updated_at-Trigger auf neue Tabellen mit der Spalte ===
do $$
declare
  t text;
begin
  foreach t in array array[
    'surcharges', 'season_templates', 'seasons', 'events',
    'task_rules', 'tasks', 'checklist_items', 'inventory_items',
    'leads', 'partners', 'deals',
    'message_templates', 'message_triggers', 'content_blocks',
    'block_requests', 'co_owners', 'dashboard_layouts',
    'plans', 'subscriptions'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end
$$;

-- === Direkt tenant-gebundene Tabellen ===
do $$
declare
  t text;
begin
  foreach t in array array[
    'surcharges',  -- via property; aber hat kein tenant_id -> Sonderfall unten
    'season_templates', 'events', 'task_rules', 'tasks', 'inventory_items',
    'leads', 'partners', 'message_templates', 'message_triggers',
    'content_blocks', 'block_requests', 'meter_readings', 'subscriptions'
  ]
  loop
    null;  -- Platzhalter; konkrete Policies einzeln unten (klarer lesbar)
  end loop;
end
$$;

-- tenant-direkte Policies (tenant_id-Spalte vorhanden)
alter table public.season_templates enable row level security;
create policy season_templates_tenant on public.season_templates
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.events enable row level security;
create policy events_tenant on public.events
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.task_rules enable row level security;
create policy task_rules_tenant on public.task_rules
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.tasks enable row level security;
create policy tasks_tenant on public.tasks
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.inventory_items enable row level security;
create policy inventory_items_tenant on public.inventory_items
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.leads enable row level security;
create policy leads_tenant on public.leads
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.partners enable row level security;
create policy partners_tenant on public.partners
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.message_templates enable row level security;
create policy message_templates_tenant on public.message_templates
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.message_triggers enable row level security;
create policy message_triggers_tenant on public.message_triggers
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.content_blocks enable row level security;
create policy content_blocks_tenant on public.content_blocks
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.block_requests enable row level security;
create policy block_requests_tenant on public.block_requests
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.subscriptions enable row level security;
create policy subscriptions_tenant on public.subscriptions
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- meter_readings: tenant-gebunden, aber APPEND-ONLY (kein Update/Delete).
-- Lesen + Einfügen erlaubt im eigenen Tenant; Update/Delete für niemanden
-- über RLS (nur Service-Role umgeht das, für Admin-Korrekturen).
alter table public.meter_readings enable row level security;
create policy meter_readings_select on public.meter_readings
  for select using (tenant_id = public.current_tenant_id());
create policy meter_readings_insert on public.meter_readings
  for insert with check (tenant_id = public.current_tenant_id());

-- === Über Parent abgeleitete Tabellen ===

-- surcharges, season_assignments, content_assignments, co_owners -> via property
alter table public.surcharges enable row level security;
create policy surcharges_via_property on public.surcharges
  for all using (exists (
    select 1 from public.properties p
    where p.id = surcharges.property_id and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = surcharges.property_id and p.tenant_id = public.current_tenant_id()));

alter table public.season_assignments enable row level security;
create policy season_assignments_via_property on public.season_assignments
  for all using (exists (
    select 1 from public.properties p
    where p.id = season_assignments.property_id and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = season_assignments.property_id and p.tenant_id = public.current_tenant_id()));

alter table public.content_assignments enable row level security;
create policy content_assignments_via_property on public.content_assignments
  for all using (exists (
    select 1 from public.properties p
    where p.id = content_assignments.property_id and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = content_assignments.property_id and p.tenant_id = public.current_tenant_id()));

alter table public.co_owners enable row level security;
create policy co_owners_via_property on public.co_owners
  for all using (exists (
    select 1 from public.properties p
    where p.id = co_owners.property_id and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = co_owners.property_id and p.tenant_id = public.current_tenant_id()));

-- seasons, season_periods -> via season_template -> tenant
alter table public.seasons enable row level security;
create policy seasons_via_template on public.seasons
  for all using (exists (
    select 1 from public.season_templates st
    where st.id = seasons.template_id and st.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.season_templates st
    where st.id = seasons.template_id and st.tenant_id = public.current_tenant_id()));

alter table public.season_periods enable row level security;
create policy season_periods_via_season on public.season_periods
  for all using (exists (
    select 1 from public.seasons s
    join public.season_templates st on st.id = s.template_id
    where s.id = season_periods.season_id and st.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.seasons s
    join public.season_templates st on st.id = s.template_id
    where s.id = season_periods.season_id and st.tenant_id = public.current_tenant_id()));

-- event_periods -> via event -> tenant
alter table public.event_periods enable row level security;
create policy event_periods_via_event on public.event_periods
  for all using (exists (
    select 1 from public.events e
    where e.id = event_periods.event_id and e.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.events e
    where e.id = event_periods.event_id and e.tenant_id = public.current_tenant_id()));

-- task_rule_assignments -> via task_rule -> tenant
alter table public.task_rule_assignments enable row level security;
create policy task_rule_assignments_via_rule on public.task_rule_assignments
  for all using (exists (
    select 1 from public.task_rules r
    where r.id = task_rule_assignments.rule_id and r.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.task_rules r
    where r.id = task_rule_assignments.rule_id and r.tenant_id = public.current_tenant_id()));

-- checklist_items, checklist_photos -> via task -> tenant
alter table public.checklist_items enable row level security;
create policy checklist_items_via_task on public.checklist_items
  for all using (exists (
    select 1 from public.tasks t
    where t.id = checklist_items.task_id and t.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.tasks t
    where t.id = checklist_items.task_id and t.tenant_id = public.current_tenant_id()));

alter table public.checklist_photos enable row level security;
create policy checklist_photos_via_item on public.checklist_photos
  for all using (exists (
    select 1 from public.checklist_items ci
    join public.tasks t on t.id = ci.task_id
    where ci.id = checklist_photos.item_id and t.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.checklist_items ci
    join public.tasks t on t.id = ci.task_id
    where ci.id = checklist_photos.item_id and t.tenant_id = public.current_tenant_id()));

-- deals -> via partner -> tenant
alter table public.deals enable row level security;
create policy deals_via_partner on public.deals
  for all using (exists (
    select 1 from public.partners pa
    where pa.id = deals.partner_id and pa.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.partners pa
    where pa.id = deals.partner_id and pa.tenant_id = public.current_tenant_id()));

-- dashboard_layouts -> via user (eigenes Layout)
alter table public.dashboard_layouts enable row level security;
create policy dashboard_layouts_self on public.dashboard_layouts
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- plans: global, nur lesbar (Preisstufen für alle sichtbar).
alter table public.plans enable row level security;
create policy plans_read_all on public.plans
  for select using (true);
