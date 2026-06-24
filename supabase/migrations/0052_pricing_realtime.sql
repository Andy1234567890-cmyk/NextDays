-- 0052_pricing_realtime.sql — Preisänderungen live in alle Tabs propagieren
--
-- Symptom vorher: ein im Objekt geänderter Basispreis (rate_plans) oder eine
-- geänderte Pricing-Konfig (property_pricing_config) erschien NICHT ohne Reload
-- im Kalender/anderen Tabs — beide Tabellen fehlten in der Realtime-Publication
-- (0048 listet nur reservations/availability/price_overrides/stop_sell).
--
-- Diese Migration nimmt rate_plans + property_pricing_config in die
-- supabase_realtime-Publication auf. RLS gilt weiter (current_tenant_id());
-- rate_plans hat keine eigene tenant_id, wird aber über die property gescoped.
-- Muster wie 0048_calendar_realtime.sql (idempotent, replica identity full).

-- REPLICA IDENTITY FULL: UPDATE/DELETE liefern die alten Zeilenwerte mit,
-- nötig fürs korrekte clientseitige Filtern.
alter table public.rate_plans              replica identity full;
alter table public.property_pricing_config replica identity full;

-- Idempotent zur Publication hinzufügen (ADD TABLE schlägt bei Doppel-
-- Ausführung sonst fehl).
do $$
declare
  t text;
  tables text[] := array['rate_plans', 'property_pricing_config'];
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
