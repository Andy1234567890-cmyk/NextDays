-- 0120_realtime_tasks.sql — tasks in die Realtime-Publication
--
-- Die PM-Buchungsdetailseite (Aufgaben-Box) und der Aufgaben-Reiter abonnieren
-- die tasks-Tabelle per WebSocket. Projekt-Grundsatz: ALLES, was eine Live-UI
-- speist, läuft über Supabase-Realtime, kein Polling. tasks fehlte noch in der
-- Publication → ohne diese Migration kamen keine Events (fremde Änderungen,
-- z. B. ein Kollege hakt eine Aufgabe ab, wurden erst nach Reload sichtbar).
--
-- Idempotent (pg_publication_tables-Guard), damit ein Re-Run nicht fehlschlägt.
-- RLS auf tasks besteht bereits (0015) → der Client empfängt nur Events seines
-- Tenants.

do $$
declare
  t text;
  tables text[] := array['tasks'];
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
