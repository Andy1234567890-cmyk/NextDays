-- 0138_property_seasons.sql — benannte, wiederverwendbare Saisons je Objekt
--
-- Ersetzt das freie „ein Zeitraum + ein Preis"-Formular durch benannte Saison-
-- Kategorien (Hochsaison, Event „DANA CUP" …) mit Farbe und Preisregel: entweder
-- prozentualer Aufschlag/Abschlag auf den Basispreis ODER fester Nachtpreis.
-- Zeiträume werden der Saison zugewiesen (property_season_assignments); daraus
-- berechnet die Anwendung je Tag den effektiven Preis und schreibt ihn nach
-- price_overrides (die eine Preis-Wahrheit, gelesen vom Resolver + an Channex
-- gepusht). Diese Tabellen sind die bearbeitbare Quelle, price_overrides das
-- materialisierte Ergebnis — deshalb KEINE Reaktivierung der 0011-Tabellen
-- (season_templates/seasons/…, per 0053 deprecatet).

create table public.property_seasons (
    id          uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties (id) on delete cascade,
    name        text not null check (char_length(name) between 1 and 80),
    -- Anzeigefarbe (Kalender-Kachel + Legende). Hex #RRGGBB, von der UI gesetzt.
    color       text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
    -- Preisregel: 'percent' = Basispreis * (1 + amount/100); 'fixed' = amount ist
    -- der Nachtpreis. amount ist bei percent vorzeichenbehaftet (+30 / -15).
    mode        text not null check (mode in ('percent', 'fixed')),
    amount      numeric(12, 2) not null check (
                    (mode = 'fixed' and amount >= 0) or mode = 'percent'
                ),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (property_id, name)
);

create index property_seasons_property_idx
    on public.property_seasons (property_id);

create trigger set_updated_at before update on public.property_seasons
    for each row execute function public.set_updated_at();

-- Zuweisung eines Datumsbereichs zu einer Saison. end_date inklusiv. Overlaps
-- sind erlaubt (spätere Zuweisung gewinnt beim Materialisieren nach
-- price_overrides — „last win", wie im Kalender-Übermalen).
create table public.property_season_assignments (
    id          uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties (id) on delete cascade,
    season_id   uuid not null references public.property_seasons (id) on delete cascade,
    start_date  date not null,
    end_date    date not null check (end_date >= start_date),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index property_season_assignments_property_idx
    on public.property_season_assignments (property_id, start_date, end_date);
create index property_season_assignments_season_idx
    on public.property_season_assignments (season_id);

create trigger set_updated_at before update on public.property_season_assignments
    for each row execute function public.set_updated_at();

-- RLS: über property -> tenant (Muster wie price_overrides/availability).
alter table public.property_seasons enable row level security;
create policy property_seasons_via_property on public.property_seasons
  for all using (exists (
    select 1 from public.properties p
    where p.id = property_seasons.property_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = property_seasons.property_id
      and p.tenant_id = public.current_tenant_id()));

alter table public.property_season_assignments enable row level security;
create policy property_season_assignments_via_property
  on public.property_season_assignments
  for all using (exists (
    select 1 from public.properties p
    where p.id = property_season_assignments.property_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = property_season_assignments.property_id
      and p.tenant_id = public.current_tenant_id()));
