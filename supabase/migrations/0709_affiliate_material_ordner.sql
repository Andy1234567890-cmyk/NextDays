-- 0709 — Ordner für das Werbematerial des Partnerprogramms.
--
-- Mit 0707 kamen die Dateien; drei Einträge passen in eine Liste, dreißig nicht.
-- Das Backoffice bekommt deshalb Ordner als REITER über der Liste („Alle ·
-- Logos · Banner · Presse") und zieht Einträge per Drag-and-drop hinein.
--
-- FLACH, kein `parent_id` — anders als die Baukasten-Mediathek (0460). Ein
-- Reiter ist eine Zeile; sobald Ordner Unterordner tragen, braucht die
-- Oberfläche einen Baum, und den hat hier niemand bestellt. Die Spalte
-- nachzurüsten ist später ein `add column`, eine gebaute und ungenutzte
-- Baumebene wieder loszuwerden ist es nicht.
--
-- KEIN `tenant_id`: das Partnerprogramm gehört der Plattform, nicht einem
-- Betrieb — wie `affiliate_assets` selbst.
create table if not exists public.affiliate_asset_folders (
    id          uuid primary key default gen_random_uuid(),
    name        text not null check (length(btrim(name)) between 1 and 60),
    -- Reihenfolge der Reiter. Gleicher Wert → alphabetisch, das entscheidet
    -- die Abfrage; hier steht nur der Wunsch des Backoffice.
    sort        integer not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- Eindeutig ohne Rücksicht auf Groß-/Kleinschreibung und Randleerzeichen:
-- „Logos" und „logos " nebeneinander wären zwei Reiter, die dasselbe behaupten.
create unique index if not exists affiliate_asset_folders_name
    on public.affiliate_asset_folders (lower(btrim(name)));

comment on table public.affiliate_asset_folders is
    'Ordner des Partner-Werbematerials (0709). Eigene Tabelle statt einer '
    'Textspalte an affiliate_assets, damit ein LEERER Ordner existieren kann '
    'und Umbenennen EINE Zeile ist statt n Aktualisierungen.';

-- `on delete set null` und NICHT cascade: ein gelöschter Ordner darf das
-- Material nicht mitnehmen (Wurzel 1 — der Gegenzustand ist „liegt wieder in
-- keinem Ordner", nicht „ist weg"). Ein versehentlich gelöschter Reiter würde
-- sonst das Logo-Paket vernichten, das dreißig Partner verlinkt haben.
alter table public.affiliate_assets
    add column if not exists folder_id uuid
    references public.affiliate_asset_folders (id) on delete set null;

create index if not exists affiliate_assets_folder_idx
    on public.affiliate_assets (folder_id);

comment on column public.affiliate_assets.folder_id is
    'Ordner im Backoffice. NULL = kein Ordner (Reiter „Ohne Ordner"). Rein '
    'organisatorisch: der Partner sieht weiterhin eine flache Liste.';

-- == RLS + Direktpfad (Wurzel 6) ==============================================
-- Exakt die Form, die 0539 für `affiliate_assets` gesetzt hat — die Reiter
-- stehen in derselben Oberfläche und brauchen dasselbe Realtime. Ein abweichend
-- gesicherter Nachbar wäre die Lücke.
--
-- Prüffrage: Was kann ein eingeloggter `cleaner` mit dem anon-Key per
-- `curl /rest/v1/affiliate_asset_folders`?
--   • SELECT — 0 Zeilen: die restriktive Policy verlangt is_platform_admin().
--   • INSERT/UPDATE/DELETE — nein, doppelt: kein GRANT und `with check (false)`.
alter table public.affiliate_asset_folders enable row level security;
revoke all on public.affiliate_asset_folders from anon, authenticated;

-- Nur LESEN, damit Realtime überhaupt senden darf. Schreiben bleibt
-- ausschließlich service_role über die API.
grant select on public.affiliate_asset_folders to authenticated;

drop policy if exists affiliate_asset_folders_deny_all
    on public.affiliate_asset_folders;
create policy affiliate_asset_folders_deny_all on public.affiliate_asset_folders
    as restrictive
    for all
    using (public.is_platform_admin())
    with check (false);

drop policy if exists affiliate_asset_folders_platform_read
    on public.affiliate_asset_folders;
create policy affiliate_asset_folders_platform_read on public.affiliate_asset_folders
    as permissive
    for select
    using (public.is_platform_admin());

comment on policy affiliate_asset_folders_deny_all on public.affiliate_asset_folders is
    'Restriktiv: LESEN nur für aktive Backoffice-Nutzer (is_platform_admin), '
    'SCHREIBEN über den DB-Direktpfad für niemanden (with check false) — '
    'dieselbe Form wie affiliate_assets_deny_all aus 0539.';

-- Realtime: ohne Mitgliedschaft in der Publikation wäre das Abo eine stumme
-- Attrappe — die Reiter sähen live aus und aktualisierten nie.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and tablename = 'affiliate_asset_folders'
    ) then
        alter publication supabase_realtime add table public.affiliate_asset_folders;
    end if;
end $$;

-- updated_at pflegen — dieselbe Funktion wie die übrigen Partner-Tabellen
-- (0517). Kein zweiter Trigger-Körper, der dasselbe tut.
drop trigger if exists affiliate_asset_folders_touch on public.affiliate_asset_folders;
create trigger affiliate_asset_folders_touch
    before update on public.affiliate_asset_folders
    for each row execute function public.affiliate_touch_updated_at();
