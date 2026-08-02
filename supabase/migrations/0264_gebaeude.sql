-- 0264_gebaeude.sql — Gebäude als Träger der Portal-Kennung
--
-- Bisher entschied die BETRIEBSART (tenants.accommodation_type, 0090) darüber,
-- ob sich Objekte eine Portal-Kennung teilen: Hotel = alle Zimmer unter einer
-- Booking-Hotel-ID, Ferienvermietung = jedes Objekt eine eigene. Das ist die
-- falsche Achse. Alltäglicher Gegenbeweis: ein Ferienvermieter mit drei
-- Wohnungen in EINEM Haus, und umgekehrt ein Hotel mit zwei Ferienhäusern im
-- Garten, die eine eigene Kennung brauchen.
--
-- Booking.com sagt zu mehreren Einheiten an derselben Adresse (Partner-Hilfe,
-- „How do I register multiple properties or units?"): „To add two properties of
-- the same type at the same address, choose Home, Hotel, or Alternative places
-- as a property type. You can then choose between listing your full place or
-- individual rooms and add multiple units if needed." Das ist also der
-- vorgesehene Weg — NICHT, dass eine zweite Registrierung abgewiesen würde.
-- Branchenlage (Recherche 02.08.2026): Guesty unterscheidet je Listing
-- (single-unit / multi-unit / complex — „Guesty's equivalent of a hotel"),
-- Lodgify je Objekt beim Anlegen („CondoTel, Hotel or Inn"), Cloudbeds über
-- Zimmertypen mit Einheitenzahl, Beds24 gemischt in einem Konto. Keiner
-- entscheidet das kontoweit.
--
-- Warum eine eigene Tabelle und nicht nur channex_property_map: die Gruppierung
-- STEHT dort bereits (mehrere Objekte auf einer channex_property_id) — aber erst
-- nach dem Verbinden, und sie hat keinen Namen. Der Name der geteilten Property
-- ist das, was bei den Portalen über den Einheiten steht. Ohne eigene Zeile je
-- Haus bliebe dafür nur der Betriebsname — bei einer Agentur mit drei Häusern
-- stünde dann dreimal derselbe Name. Deshalb trägt das Gebäude den Namen.
--
-- Die Betriebsart bleibt, was sie wirklich ist: Sprache, Navigation und
-- Kalenderform — keine Strukturentscheidung.

create table if not exists public.buildings (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    name text not null,
    -- Adresse nur informativ: die Zuordnung macht der Nutzer bewusst, nicht ein
    -- Textvergleich. Zwei Häuser können dieselbe Straße haben, und ein Tippfehler
    -- darf keine Portal-Kennung zusammenlegen.
    address text,
    city text,
    postal_code text,
    country text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.buildings is
    'Gebäude: Klammer um Objekte, die sich EINE Portal-Kennung teilen '
    '(Booking-Hotel-ID, Channex-Property). Objekt ohne Gebäude = eigene Kennung.';

create index if not exists buildings_tenant_idx on public.buildings(tenant_id);

alter table public.properties
    add column if not exists building_id uuid references public.buildings(id) on delete set null;

comment on column public.properties.building_id is
    'Gebäude dieses Objekts. NULL = eigenständig (eigene Portal-Kennung). '
    'Objekte mit demselben Gebäude teilen sich eine Channex-Property.';

create index if not exists properties_building_idx on public.properties(building_id);

alter table public.buildings enable row level security;

create policy buildings_tenant on public.buildings
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Schreiben nur über den Server (service_role): das Gebäude entscheidet, welche
-- Objekte sich eine Portal-Kennung teilen — ein direkter Schreibzugriff per
-- anon-Key könnte fremde Objekte unter eine gemeinsame Kennung ziehen
-- (Wurzel 6: RLS allein schützt nur den Mandanten, nicht die Schreibrichtung).
revoke insert, update, delete on public.buildings from anon, authenticated;

create policy buildings_write_restrict on public.buildings
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Bestand: Gebäude aus der WIRKLICHKEIT ableiten, nicht aus der Betriebsart.
-- Wo sich heute mehrere Objekte eine Channex-Property teilen, IST das bereits
-- ein Gebäude — sonst würden bestehende Verbindungen beim ersten Sync
-- auseinanderfallen (Wurzel 1: der alte Zustand muss mitgepflegt werden).
with geteilt as (
    select m.tenant_id, m.channex_property_id, min(t.name) as tenant_name
      from public.channex_property_map m
      join public.tenants t on t.id = m.tenant_id
     where m.deleted_at is null
     group by m.tenant_id, m.channex_property_id
    having count(*) > 1
), angelegt as (
    insert into public.buildings (tenant_id, name)
    select g.tenant_id, coalesce(g.tenant_name, 'Gebäude')
      from geteilt g
    returning id, tenant_id
)
update public.properties p
   set building_id = a.id
  from angelegt a
  join geteilt g on g.tenant_id = a.tenant_id
  join public.channex_property_map m
       on m.tenant_id = g.tenant_id
      and m.channex_property_id = g.channex_property_id
      and m.deleted_at is null
 where p.id = m.property_id
   and p.building_id is null;

-- Hotels ohne Portal-Verbindung bekommen ebenfalls EIN Gebäude: dort gilt die
-- Regel „alle Zimmer unter einer Kennung" auch dann, wenn noch nichts verbunden
-- ist — sonst würde das erste Verbinden je Zimmer eine eigene Kennung anlegen
-- und damit das Gegenteil des Gewollten tun.
with hotels as (
    select t.id as tenant_id, t.name
      from public.tenants t
     where t.accommodation_type = 'hotel'
       and exists (
           select 1 from public.properties p
            where p.tenant_id = t.id and p.building_id is null
       )
), angelegt as (
    insert into public.buildings (tenant_id, name)
    select h.tenant_id, coalesce(h.name, 'Gebäude') from hotels h
    returning id, tenant_id
)
update public.properties p
   set building_id = a.id
  from angelegt a
 where p.tenant_id = a.tenant_id
   and p.building_id is null;
