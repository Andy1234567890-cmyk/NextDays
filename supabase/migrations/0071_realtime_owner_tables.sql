-- 0071_realtime_owner_tables.sql — Owner-Tabellen für Supabase-Realtime freigeben
--
-- Die Eigentümer-Seite aktualisiert sich vollständig per Realtime (WebSocket,
-- kein Polling): Objekt-Zuweisungen, Provision/Stammdaten, Ausgaben und
-- Abrechnungen sollen ohne Reload sofort durchschlagen. Dafür müssen die
-- speisenden Tabellen in der Publication `supabase_realtime` sein. properties +
-- reservations sind bereits enthalten; hier kommen die Owner-Tabellen dazu.
--
-- add table ist nicht idempotent → vorher prüfen (duplicate_object abfangen).

do $$
begin
  alter publication supabase_realtime add table public.owners;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.owner_properties;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.owner_expenses;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.owner_statements;
exception when duplicate_object then null;
end $$;
