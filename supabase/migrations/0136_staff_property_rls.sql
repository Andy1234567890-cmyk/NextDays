-- 0136_staff_property_rls.sql — Mitarbeiter/Dienstleister: RLS-Objektfilter (§4.3)
--
-- Befund (Rollen-Review): staff/cleaner sahen den GESAMTEN Objektbestand des
-- Mandanten. Der Owner-Scope (0058/0059) filtert per RLS auf zugeordnete
-- Objekte — ein analoger STAFF-Scope fehlte komplett. Folgen:
--   * properties.list zeigte staff/cleaner alle Objekte inkl. Adressen (§4.3-
--     Verstoß), da der Service den Staff-Scope nirgends erzwang.
--   * Supabase-Realtime (postgres_changes) liefert Zeilen ausschließlich nach
--     RLS — ohne Staff-Scope empfingen staff/cleaner Live-Events ALLER Objekte
--     (fremde Reservierungen/Aufgaben) am API-Masking vorbei.
--
-- Diese Migration schließt BEIDES an der Wurzel: eine DB-Policy, die für JEDEN
-- Zugriff (API-anon-Pfad UND Realtime) gilt — kein Service kann den Scope je
-- wieder vergessen. Mechanik 1:1 wie 0059 (RESTRICTIVE SELECT, UND-verknüpft
-- mit den permissiven tenant-Policies → kann nur einschränken, nie öffnen).
--
-- Der Service-Role-Key (System-Jobs, Recompute, register) umgeht RLS generell;
-- der Backend-API-Pfad läuft mit service-role und trägt den Staff-Scope daher
-- ZUSÄTZLICH im Service (properties/service.py) als defense-in-depth.

-- == Helper: Darf der aktuelle Nutzer (staff/cleaner) dieses Objekt sehen? ===
-- Vorbild: owner_can_see_property() (0058).
--   * Nicht-staff/cleaner (admin/co_admin/owner) → immer true; deren Sicht
--     regeln die tenant- bzw. owner-Policies unverändert weiter.
--   * staff/cleaner → nur true, wenn ihm das Objekt in
--     staff_property_assignments zugeordnet ist (Tenant + user_id gebunden).
-- security definer, damit die Policy die Zuordnungstabelle lesen darf, ohne
-- deren eigene RLS rekursiv auszulösen. stable; leerer search_path.
create or replace function public.staff_can_see_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when public.current_user_role() is null
        or public.current_user_role() not in ('staff', 'cleaner')
        then true
      else exists (
        select 1
        from public.staff_property_assignments a
        where a.property_id = p_property_id
          and a.user_id = auth.uid()
          and a.tenant_id = public.current_tenant_id()
      )
    end
$$;

alter function public.staff_can_see_property(uuid) set search_path = '';

-- properties selbst: der property_id-Bezug ist die id-Spalte.
drop policy if exists properties_staff_scope on public.properties;
create policy properties_staff_scope
  on public.properties
  as restrictive
  for select
  using (public.staff_can_see_property(id));

-- Alle objektgebundenen Tabellen (property_id) — identische Liste wie 0059,
-- damit Owner- und Staff-Scope deckungsgleich greifen und keine Tabelle
-- vergessen wird. Drop-vor-Create für Wiederholbarkeit.
do $$
declare
  t text;
  tables text[] := array[
    'ari_outbox', 'availability', 'block_requests',
    'channex_channel_connection', 'channex_property_map', 'channex_tax_map',
    'co_owners', 'content_assignments', 'dp_settings', 'dynamic_prices',
    'inventory_items', 'meter_readings', 'price_overrides',
    'property_pricing_config', 'rate_plans', 'reservations', 'reviews',
    'season_assignments', 'staff_property_assignments', 'stop_sell',
    'surcharges', 'task_rule_assignments', 'tasks'
  ];
begin
  foreach t in array tables loop
    -- Nur, wenn die Tabelle existiert (Migrationsstände können abweichen).
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format(
      'drop policy if exists %I on public.%I',
      t || '_staff_scope', t
    );
    execute format(
      'create policy %I on public.%I
         as restrictive for select
         using (public.staff_can_see_property(property_id))',
      t || '_staff_scope', t
    );
  end loop;
end
$$;
