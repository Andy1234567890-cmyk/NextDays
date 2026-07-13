-- 0126_task_photos_bucket.sql — privater Storage-Bucket für Aufgaben-/
-- Buchungsfotos (checklist_photos) + Realtime für das Bilder-Modul.
--
-- Buchungs-/Aufgabenfotos sind Nachweise mit möglichem Gastbezug (Housekeeping-
-- Dokumentation an einer konkreten Reservierung) → PRIVATER Bucket, anders als
-- die public Objektfotos (property-images). Zugriff NUR über das Backend
-- (Service-Role: Upload + signierte Download-URLs, Muster agency-contracts).
-- Der Bucket bleibt für anon/auth dicht → KEINE storage.objects-Policy nötig
-- (fail-closed: ohne Backend-Signatur kein Zugriff).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'task-photos',
    'task-photos',
    false,     -- privat: nur Backend-signierte URLs
    20971520,  -- 20 MB
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- checklist_photos hat bereits RLS (0015: via item→task→tenant). Für das
-- Bilder-Modul (Live-Liste) kommt es in die Realtime-Publication. RLS ist der
-- einzige Backstop (anon hat pauschale Grants) — hier über die Eltern-Kette
-- abgesichert, methoden-unabhängig. Idempotenter Guard wie 0120/0122/0123.
do $$
declare
  t text;
  tables text[] := array['checklist_photos'];
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
