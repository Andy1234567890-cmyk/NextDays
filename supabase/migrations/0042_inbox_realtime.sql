-- 0042_inbox_realtime.sql
-- Echtes Realtime für den Posteingang: relevante Tabellen in die
-- supabase_realtime-Publication aufnehmen, damit Clients per WebSocket
-- INSERT/UPDATE/DELETE sofort empfangen (kein Polling). RLS gilt weiter:
-- der Client sieht nur Zeilen seines Tenants (current_tenant_id()).

-- REPLICA IDENTITY FULL: damit UPDATE/DELETE die alten Zeilenwerte mitliefern
-- (sonst nur Primary Key) — nötig für korrektes Client-seitiges Mergen/Filtern.
alter table public.channex_booking        replica identity full;
alter table public.sandbox_message        replica identity full;
alter table public.whatsapp_conversation  replica identity full;
alter table public.whatsapp_message       replica identity full;
alter table public.inbox_thread_note      replica identity full;
alter table public.inbox_scheduled_message replica identity full;

-- Tabellen zur Realtime-Publication hinzufügen (idempotent via DO-Block,
-- da ADD TABLE bei Doppel-Ausführung sonst fehlschlägt).
do $$
declare
  t text;
  tables text[] := array[
    'channex_booking', 'sandbox_message', 'whatsapp_conversation',
    'whatsapp_message', 'inbox_thread_note', 'inbox_scheduled_message'
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
