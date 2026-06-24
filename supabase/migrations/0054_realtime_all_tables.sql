-- 0054_realtime_all_tables.sql — projektweites Realtime: alle Tabellen live
--
-- Ziel: das gesamte Dashboard reagiert live auf DB-Änderungen — nicht mehr nur
-- Kalender/Preise/Posteingang (0042/0048/0052), sondern jede RLS-geschützte
-- public-Tabelle (Objekte, Buchhaltung, Gäste, Aufgaben, CRM, Channex-Mappings,
-- …). So zeigt die UI Status/Stammdaten sofort, egal ob die Änderung lokal oder
-- extern (z. B. Channex-Import, anderer Nutzer) kam.
--
-- Vorgehen (idempotent, Muster wie 0048/0052):
--   * REPLICA IDENTITY FULL (UPDATE/DELETE liefern die alten Zeilenwerte mit —
--     nötig fürs korrekte clientseitige Filtern).
--   * Jede noch nicht enthaltene Tabelle in die supabase_realtime-Publication.
--
-- RLS gilt unverändert weiter: der Realtime-Client empfängt NUR Zeilen, die er
-- per Policy (current_tenant_id() aus dem JWT) lesen darf.
--
-- WICHTIG — nur RLS-geschützte Tabellen werden aufgenommen: eine Tabelle OHNE
-- RLS würde ihre Änderungen an ALLE verbundenen Clients broadcasten (kein
-- Mandanten-Filter). Solche Tabellen werden hier übersprungen. Im NextDays-
-- Schema sind das interne Sync-/Mapping-Tabellen (ari_outbox, channex_tax_map),
-- die ohnehin kein Dashboard-Live-Update brauchen. Bereits enthaltene Tabellen
-- bleiben drin (Bestandsschutz, z. B. stop_sell aus 0048).
--
-- Bewusst AUSGENOMMEN: die Supabase-internen realtime.*-Tabellen liegen im
-- Schema "realtime", nicht "public" — sie sind hier nicht betroffen.

do $$
declare
  rec record;
begin
  for rec in
    select c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    -- Tabellen OHNE RLS NICHT aufnehmen (würden ungefiltert global broadcasten),
    -- es sei denn, sie sind bereits Teil der Publication (nicht still entfernen).
    if not rec.relrowsecurity and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = rec.relname
    ) then
      continue;
    end if;

    -- REPLICA IDENTITY FULL (idempotent — mehrfaches Setzen ist unschädlich).
    execute format('alter table public.%I replica identity full', rec.relname);

    -- Nur hinzufügen, wenn noch nicht in der Publication (ADD TABLE schlägt
    -- bei Doppel-Eintrag sonst fehl).
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = rec.relname
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I', rec.relname
      );
    end if;
  end loop;
end $$;
