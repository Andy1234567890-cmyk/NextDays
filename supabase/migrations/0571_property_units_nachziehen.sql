-- 0571_property_units_nachziehen.sql — jedes Objekt bekommt seine Einheit
--
-- ANLASS (06.09.2026): 0265 hat den DAMALIGEN Bestand mit je einer Einheit
-- versorgt, aber kein Anlegepfad legte danach eine an. Jedes seither erzeugte
-- Objekt hat null Einheiten — und damit scheitert JEDER Sperr-, Freigabe- und
-- Zuweisungspfad, weil `availability.unit_id` NOT NULL ist. Sichtbar wurde es
-- im neuen Gastgeber-Multikalender: „Geblockt" antwortete mit einem rohen 500
-- (`APIError` in calendar/service.py beim availability-Upsert), also war kein
-- einziger Tag sperrbar.
--
-- Warum ein TRIGGER und nicht eine Zeile im Properties-Service: das Objekt
-- entsteht auf mehreren Wegen (Dashboard, Gastgeber-Wizard, Airbnb-Übernahme,
-- Import, Seed). Eine Regel, die das Datenmodell trägt („1 property = 1 Typ
-- mit n ≥ 1 Einheiten"), gehört an die Tabelle — genau wie
-- `properties_marktplatz_pflicht` für den Pflichtkanal (Wurzel 6: auch der
-- DB-Direktpfad muss sie einhalten).

begin;

-- 1) Bestand nachziehen (idempotent, gleiche Namensregel wie 0265).
insert into public.property_units (tenant_id, property_id, name, position)
select p.tenant_id, p.id, coalesce(nullif(btrim(p.title), ''), 'Einheit 1'), 0
  from public.properties p
 where not exists (
     select 1 from public.property_units u where u.property_id = p.id
 );

-- Reservierungen dieser Objekte der neuen Einheit zuordnen (wie 0265).
update public.reservations r
   set unit_id = u.id
  from public.property_units u
 where u.property_id = r.property_id
   and r.unit_id is null;

-- 2) Ab jetzt automatisch bei jedem neuen Objekt.
create or replace function public.properties_ersteinheit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- `if not exists` statt blind einzufügen: der Trigger darf einem Anlegepfad,
  -- der seine Einheiten selbst mitbringt (Multi-Unit-Import), keine
  -- überzählige „Einheit 1" danebenstellen.
  if not exists (
      select 1 from public.property_units u where u.property_id = new.id
  ) then
    insert into public.property_units (tenant_id, property_id, name, position)
    values (
      new.tenant_id,
      new.id,
      coalesce(nullif(btrim(new.title), ''), 'Einheit 1'),
      0
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.properties_ersteinheit() from anon, authenticated;

drop trigger if exists properties_ersteinheit_anlegen on public.properties;
create trigger properties_ersteinheit_anlegen
  after insert on public.properties
  for each row execute function public.properties_ersteinheit();

comment on function public.properties_ersteinheit() is
    'Legt zu jedem neuen Objekt die erste Einheit an (Datenmodell 0265). '
    'Ohne sie ist das Objekt im Kalender nicht sperrbar.';

commit;
