-- 0059_owner_property_rls.sql — Eigentümer-Portal: RLS-Objektfilter (Lastenheft §4.2)
--
-- Setzt die Objekt-Einschränkung aus 0058 durch: ein eingeloggter EIGENTÜMER
-- (Rolle 'owner') sieht nur Zeilen SEINER Objekte; die Agentur (admin/co_admin/
-- staff/cleaner) sieht wie bisher den ganzen Tenant.
--
-- Mechanismus: RESTRICTIVE SELECT-Policies. Diese werden mit den bestehenden
-- (permissiven) tenant-Policies UND-verknüpft — sie können also nur weiter
-- einschränken, niemals zusätzlichen Zugriff geben. owner_can_see_property()
-- liefert für Nicht-owner immer true, sodass die Agentur-Sicht unverändert bleibt;
-- für owner nur true bei zugeordnetem Objekt (owner_property_assignments).
--
-- READ-ONLY-Stufe (Lastenheft §4.2): nur SELECT wird gefiltert. Schreibrechte
-- des owners sind ohnehin über die Capability-Matrix ausgeschlossen; eine
-- spätere Stufe kann bei Bedarf WRITE-Policies analog ergänzen.
--
-- Der Service-Role-Key (System-Jobs, Recompute, register-Flow) umgeht RLS
-- generell und ist davon unberührt.

-- properties selbst: direkter property_id-Bezug ist die id-Spalte.
create policy properties_owner_scope
  on public.properties
  as restrictive
  for select
  using (public.owner_can_see_property(id));

-- Alle objektgebundenen Tabellen (property_id). Generiert über einen Loop, damit
-- keine Tabelle vergessen wird; `if not exists`-Semantik via Drop-vor-Create für
-- Wiederholbarkeit. staff_property_assignments ist Mitarbeiter-Verwaltung der
-- Agentur — für einen owner ohnehin via tenant-Policy nicht relevant, wird aber
-- der Vollständigkeit halber ebenfalls auf seinen Objekt-Scope begrenzt.
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
    execute format(
      'drop policy if exists %I on public.%I',
      t || '_owner_scope', t
    );
    execute format(
      'create policy %I on public.%I
         as restrictive for select
         using (public.owner_can_see_property(property_id))',
      t || '_owner_scope', t
    );
  end loop;
end
$$;
