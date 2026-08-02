-- 0265_property_units.sql — Einheiten unter dem Objekt (Phase 1, unsichtbar)
--
-- Bisher war ein Objekt genau EINE buchbare Einheit, und Verfügbarkeit ging als
-- 0/1 an die Portale. Das bildet den häufigsten Fall der Branche nicht ab: einen
-- Typ mit mehreren identischen Einheiten (fünf gleiche Studios, zehn gleiche
-- Doppelzimmer). Belegt:
--
--   Booking.com (Extranet-Hilfe, Kalender-Status): „No inventory – you entered 0
--   for the number of rooms available to sell" / „Sold out – you sold all the
--   rooms or units OF THIS TYPE that you have loaded" → die Stückzahl hängt am
--   Typ.
--   SiteMinder (Entwickler-Doku): Verfügbarkeit ist `AvailStatusMessage
--   @BookingLimit` je `@InvTypeCode`; „All rate plans under the same room type
--   share the same availability pool."
--   Hostaway: „if you have 10 identical rooms in a hotel, you would list them as
--   one multi-unit listing with 10 sub-units."
--
-- Diese Migration legt NUR das Modell an und ändert nichts am Verhalten: jedes
-- bestehende Objekt bekommt GENAU EINE Einheit, jede bestehende Reservierung
-- wird ihr zugeordnet. Mit einer Einheit ist „Zahl der freien Einheiten"
-- rechnerisch identisch mit dem heutigen 0/1.

create table if not exists public.property_units (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    property_id uuid not null references public.properties(id) on delete cascade,
    -- Anzeigename der Einheit („Wohnung 1", „Zimmer 101"). Bei einem Objekt mit
    -- nur einer Einheit taucht er nirgends auf; er wird erst beim Aufteilen
    -- sichtbar (Phase 2).
    name text not null,
    position integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.property_units is
    'Einheiten eines Objekts (0265). Das Objekt ist der TYP, hier hängen seine '
    'identischen Einheiten. Verfügbarkeit an die Portale = Zahl der freien.';

create index if not exists property_units_property_idx
    on public.property_units(property_id, position);
create index if not exists property_units_tenant_idx
    on public.property_units(tenant_id);

alter table public.property_units enable row level security;

create policy property_units_tenant on public.property_units
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Nur der Server schreibt: die Zahl der Einheiten bestimmt, wie viel bei den
-- Portalen verkauft wird. Ein Schreibzugriff per anon-Key könnte Kapazität
-- erfinden (Wurzel 6 — RLS allein schützt nur den Mandanten).
revoke insert, update, delete on public.property_units from anon, authenticated;

create policy property_units_write_restrict on public.property_units
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Reservierung → Einheit. NULL heißt „noch nicht zugewiesen"; bei einem Objekt
-- mit einer Einheit ist das gleichbedeutend mit ihr. Beim Löschen einer Einheit
-- bleibt die Reservierung bestehen und wird zuweisungslos (nie stillschweigend
-- verschwinden lassen).
alter table public.reservations
    add column if not exists unit_id uuid
        references public.property_units(id) on delete set null;

create index if not exists reservations_unit_idx on public.reservations(unit_id);

comment on column public.reservations.unit_id is
    'Zugewiesene Einheit (0265). NULL = nicht zugewiesen.';

-- Bestand: je Objekt genau eine Einheit, benannt wie das Objekt.
insert into public.property_units (tenant_id, property_id, name, position)
select p.tenant_id, p.id, coalesce(nullif(btrim(p.title), ''), 'Einheit 1'), 0
  from public.properties p
 where not exists (
     select 1 from public.property_units u where u.property_id = p.id
 );

-- Bestehende Reservierungen dieser einen Einheit zuordnen.
update public.reservations r
   set unit_id = u.id
  from public.property_units u
 where u.property_id = r.property_id
   and r.unit_id is null;
