-- 0061_property_photos.sql — Foto-/Galerieverwaltung je Objekt (wie Lodgify)
--
-- Bisher lagen Objekt-Fotos nur als URL-Array in properties.photos (keine
-- Metadaten). Diese Tabelle ist ab jetzt die WAHRHEIT: jede Zeile ein Foto mit
-- Reihenfolge, Cover-Flag und mehrsprachiger Bildunterschrift. properties.photos
-- bleibt ein abgeleiteter Kompat-Spiegel (Cover zuerst, dann sort_order), den die
-- bestehenden Leser (Kalender-Thumbnail, öffentliche Listings, DP-Übersicht,
-- Inbox) unverändert weiter nutzen.

create table public.property_photos (
    id          uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties (id) on delete cascade,
    url         text not null,
    sort_order  integer not null default 0,
    is_cover    boolean not null default false,
    -- Locale → Text, z. B. {"de": "Wohnzimmer", "en": "Living room"}.
    caption     jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index property_photos_property_sort_idx
    on public.property_photos (property_id, sort_order);

-- Genau EIN Cover je Objekt: partieller Unique-Index auf is_cover=true.
create unique index property_photos_one_cover_idx
    on public.property_photos (property_id)
    where is_cover;

create trigger set_updated_at before update on public.property_photos
    for each row execute function public.set_updated_at();

-- RLS: über property -> tenant (Muster wie price_overrides, 0016).
alter table public.property_photos enable row level security;
create policy property_photos_via_property on public.property_photos
  for all using (exists (
    select 1 from public.properties p
    where p.id = property_photos.property_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = property_photos.property_id
      and p.tenant_id = public.current_tenant_id()));

-- Backfill aus dem bestehenden properties.photos-Array: Reihenfolge = sort_order,
-- erstes Element = Cover, leere Captions. with ordinality liefert den Index (1-basiert).
insert into public.property_photos (property_id, url, sort_order, is_cover)
select p.id, elem.url, (elem.ord - 1)::int, (elem.ord = 1)
from public.properties p
cross join lateral unnest(p.photos) with ordinality as elem(url, ord)
where coalesce(array_length(p.photos, 1), 0) > 0;
