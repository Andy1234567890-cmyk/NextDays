-- 0140_hotel_room_types.sql — Hotel-Datenmodell (Teil 1: Schema, rein additiv)
--
-- myNextDays ist EIN System für ZWEI Anbietertypen (accommodation_type auf
-- tenants, 0090): Ferienvermietung (1 property = 1 buchbare Einheit, binäres
-- availability-Modell 0/1) UND Hotel (mehrere Zimmerkategorien je property,
-- mehrere Ratenpläne je Kategorie, Verfügbarkeit als ZAHL freier Zimmer).
--
-- Diese Migration legt NUR das Schema an. Sie ist rein additiv und nullable:
-- solange ein property KEINE room_types-Zeile hat, bleibt das heutige
-- Ferienwohnungs-Verhalten unverändert (der Schalter ist die EXISTENZ von
-- room_types-Zeilen, nicht ein Typ-Flag). Das Verhalten hinter dem Schalter
-- (content_sync/ARI n-fähig, Preise pro Rate-Plan, count-Availability-Lese-
-- pfade, UI) kommt in Folge-Migrationen/PRs — bis dahin ist der Schalter
-- wirkungslos, weil noch keine room_types-Zeile angelegt werden kann.
--
-- Channex-Modell (Doku): property → room_type (n, mit count_of_rooms +
-- occupancy) → rate_plan (n je room_type). Availability liegt auf Room-Type-
-- Ebene als nicht-negativer Integer.

-- ---------------------------------------------------------------------------
-- 1) room_types — lokale Zimmerkategorie eines Hotels (n je property).
--    occ_* + default_occupancy spiegeln die Channex-Pflichtfelder; count_of_rooms
--    = Bestand der Kategorie (Ferienwohnung bräuchte 1, hat aber gar keine Zeile).
-- ---------------------------------------------------------------------------
create table if not exists public.room_types (
    id                uuid primary key default gen_random_uuid(),
    tenant_id         uuid not null references public.tenants(id) on delete cascade,
    property_id       uuid not null references public.properties(id) on delete cascade,
    title             text not null,
    count_of_rooms    integer not null check (count_of_rooms >= 1),
    occ_adults        integer not null check (occ_adults >= 1),
    occ_children      integer not null default 0 check (occ_children >= 0),
    occ_infants       integer not null default 0 check (occ_infants >= 0),
    default_occupancy integer not null check (default_occupancy >= 1),
    position          integer not null default 0,   -- Sortierung im Editor
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    -- Channex: default_occupancy darf occ_adults nicht übersteigen.
    check (default_occupancy <= occ_adults)
);
create index if not exists room_types_property_idx
    on public.room_types(property_id);
create index if not exists room_types_tenant_idx
    on public.room_types(tenant_id);

-- ---------------------------------------------------------------------------
-- 2) room_type_availability — freie Zimmer je Kategorie je Tag als ZAHL.
--    booked_count wird atomar geführt (Folge-PR: RPC-Guard analog 0104);
--    frei = room_types.count_of_rooms − booked_count. Getrennt von der binären
--    availability-Tabelle (0004), damit das Ferienwohnungs-Modell unberührt
--    bleibt — die Lesepfade verzweigen anhand der room_types-Existenz.
-- ---------------------------------------------------------------------------
create table if not exists public.room_type_availability (
    id              uuid primary key default gen_random_uuid(),
    room_type_id    uuid not null references public.room_types(id) on delete cascade,
    date            date not null,
    booked_count    integer not null default 0 check (booked_count >= 0),
    -- CTA/CTD/stop_sell liegen bei Hotels pro Rate-Plan (Channex restrictions),
    -- nicht hier — diese Tabelle trägt nur den Bestandszähler.
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (room_type_id, date)
);
create index if not exists room_type_availability_date_idx
    on public.room_type_availability(room_type_id, date);

-- ---------------------------------------------------------------------------
-- 3) FK-Spalten (nullable) — welcher Room-Type/Rate-Plan gebucht bzw. bepreist
--    wird. Nullable = Ferienwohnungen (kein Room-Type) bleiben gültig.
-- ---------------------------------------------------------------------------
alter table public.reservations
    add column if not exists room_type_id uuid references public.room_types(id);
alter table public.rate_plans
    add column if not exists room_type_id uuid references public.room_types(id);
create index if not exists reservations_room_type_idx
    on public.reservations(room_type_id) where room_type_id is not null;
create index if not exists rate_plans_room_type_idx
    on public.rate_plans(room_type_id) where room_type_id is not null;

-- ---------------------------------------------------------------------------
-- 4) RLS. Jede neue public-Tabelle bekommt RLS (anon hat pauschale Grants).
--    room_types: property_id → via-property-Muster (0008).
--    room_type_availability: kein property_id → 2-Hop über room_types.
-- ---------------------------------------------------------------------------
alter table public.room_types enable row level security;
create policy room_types_via_property on public.room_types
  for all
  using (exists (
    select 1 from public.properties p
    where p.id = room_types.property_id
      and p.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.properties p
    where p.id = room_types.property_id
      and p.tenant_id = public.current_tenant_id()
  ));

alter table public.room_type_availability enable row level security;
create policy room_type_availability_via_property on public.room_type_availability
  for all
  using (exists (
    select 1 from public.room_types rt
    join public.properties p on p.id = rt.property_id
    where rt.id = room_type_availability.room_type_id
      and p.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.room_types rt
    join public.properties p on p.id = rt.property_id
    where rt.id = room_type_availability.room_type_id
      and p.tenant_id = public.current_tenant_id()
  ));

-- ---------------------------------------------------------------------------
-- 5) Owner-/Staff-Scope (restrictive SELECT). Die statischen Tabellen-Arrays
--    in 0059/0136 erfassen neue Tabellen NICHT automatisch → hier explizit,
--    sonst sehen owner/staff/cleaner Live-Events ALLER Objekte (0136 filtert
--    Realtime ausschließlich per RLS). room_types nutzt property_id direkt,
--    room_type_availability den 2-Hop.
-- ---------------------------------------------------------------------------
drop policy if exists room_types_owner_scope on public.room_types;
create policy room_types_owner_scope on public.room_types
  as restrictive for select
  using (public.owner_can_see_property(property_id));
drop policy if exists room_types_staff_scope on public.room_types;
create policy room_types_staff_scope on public.room_types
  as restrictive for select
  using (public.staff_can_see_property(property_id));

drop policy if exists room_type_availability_owner_scope on public.room_type_availability;
create policy room_type_availability_owner_scope on public.room_type_availability
  as restrictive for select
  using (public.owner_can_see_property(
    (select rt.property_id from public.room_types rt
     where rt.id = room_type_availability.room_type_id)
  ));
drop policy if exists room_type_availability_staff_scope on public.room_type_availability;
create policy room_type_availability_staff_scope on public.room_type_availability
  as restrictive for select
  using (public.staff_can_see_property(
    (select rt.property_id from public.room_types rt
     where rt.id = room_type_availability.room_type_id)
  ));

-- ---------------------------------------------------------------------------
-- 6) Realtime: beide neuen Tabellen in die Publication (Muster 0048), damit
--    die Kalender-/Objekt-UI die Bestände live abonnieren kann.
-- ---------------------------------------------------------------------------
alter table public.room_types replica identity full;
alter table public.room_type_availability replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'room_types'
  ) then
    alter publication supabase_realtime add table public.room_types;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'room_type_availability'
  ) then
    alter publication supabase_realtime add table public.room_type_availability;
  end if;
end
$$;
