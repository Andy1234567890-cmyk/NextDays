-- 0048_calendar_realtime.sql
-- Echtes Realtime für den Multikalender: die kalenderrelevanten Tabellen in die
-- supabase_realtime-Publication aufnehmen, damit das Board per WebSocket sofort
-- auf Buchungen, Belegung, Preise und Verkaufsstopps reagiert (kein Polling).
-- RLS gilt weiter: der Client empfängt nur Zeilen seines Tenants
-- (current_tenant_id() aus dem JWT). Analog zu 0042_inbox_realtime.sql.
--
-- Ohne diese Publication liefert Supabase KEINE Events für diese Tabellen →
-- der Kalender-useRealtime-Hook bliebe wirkungslos (Bug: "geht nicht realtime").

-- REPLICA IDENTITY FULL: UPDATE/DELETE liefern die alten Zeilenwerte mit
-- (sonst nur Primary Key) — nötig fürs korrekte Client-seitige Filtern.
alter table public.reservations    replica identity full;
alter table public.availability    replica identity full;
alter table public.price_overrides replica identity full;
alter table public.stop_sell       replica identity full;

-- Idempotent zur Publication hinzufügen (ADD TABLE schlägt bei Doppel-
-- Ausführung sonst fehl).
do $$
declare
  t text;
  tables text[] := array[
    'reservations', 'availability', 'price_overrides', 'stop_sell'
  ];
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
