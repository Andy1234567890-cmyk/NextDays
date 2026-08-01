-- Schlafmoeglichkeiten wandern vom Objekt an das Zimmer (Folge von 0246).
--
-- WARUM: Nach 0246 koennten Betten an zwei Orten stehen — objektweit in
-- properties.type_attributes.beds und je Zimmer in property_rooms.betten. Zwei
-- Wahrheiten fuer dieselbe Aussage heisst, dass die UI irgendwann die falsche
-- zeigt. Lodgify kennt nur den Ort am Zimmer (Help-Center 21285360759324:
-- Schlafmoeglichkeiten sind Zusatzangaben von Schlafzimmer, Wohnzimmer und
-- Schlafbereich), und das ist auch die einzige Stelle, an der die Angabe etwas
-- bedeutet.
--
-- REGEL DER UEBERNAHME: Das Betten-Zaehlwerk des Objekts geht vollstaendig in
-- das ERSTE Schlafzimmer (kleinste position). Hat das Objekt kein Schlafzimmer,
-- wird eines angelegt — das Objekt hatte Betten, also gibt es einen Ort zum
-- Schlafen; ihn zu verschweigen waere ein Verlust. Die Summe der Schlafplaetze
-- bleibt exakt gleich; verteilt wird NICHT geraten.
--
-- Das Altfeld bleibt stehen: der Lesepfad readBeds faellt weiter darauf zurueck,
-- solange Objekte ohne gepflegte Zimmer existieren. Aufgeraeumt wird es, wenn
-- nichts mehr darauf liest.

begin;

-- 1) Objekte mit Betten, aber ohne Schlafzimmer: Schlafzimmer anlegen.
insert into public.property_rooms (tenant_id, property_id, raum_typ, privat, position)
select
  p.tenant_id,
  p.id,
  'schlafzimmer',
  true,
  coalesce(
    (select max(r.position) + 1 from public.property_rooms r where r.property_id = p.id),
    0
  )
from public.properties p
where jsonb_typeof(p.type_attributes -> 'beds') = 'object'
  and p.type_attributes -> 'beds' <> '{}'::jsonb
  and not exists (
    select 1 from public.property_rooms r
    where r.property_id = p.id and r.raum_typ = 'schlafzimmer'
  );

-- 2) Zaehlwerk in das erste Schlafzimmer je Objekt uebernehmen. Bereits
--    gepflegte Zimmer-Betten gewinnen (|| haelt den rechten Operanden) — sonst
--    ueberschriebe eine alte Objektangabe eine neuere Zimmerangabe.
update public.property_rooms r
set betten = (p.type_attributes -> 'beds') || r.betten
from public.properties p
where p.id = r.property_id
  and jsonb_typeof(p.type_attributes -> 'beds') = 'object'
  and p.type_attributes -> 'beds' <> '{}'::jsonb
  and r.id = (
    select r2.id from public.property_rooms r2
    where r2.property_id = p.id and r2.raum_typ = 'schlafzimmer'
    order by r2.position, r2.created_at
    limit 1
  );

-- 3) Gegenprobe: jedes Objekt, das Betten hatte, hat sie jetzt auch an einem
--    Zimmer. Schlaegt das fehl, ist die Uebernahme unvollstaendig.
do $$
declare
  offen int;
begin
  select count(*) into offen
  from public.properties p
  where jsonb_typeof(p.type_attributes -> 'beds') = 'object'
    and p.type_attributes -> 'beds' <> '{}'::jsonb
    and not exists (
      select 1 from public.property_rooms r
      where r.property_id = p.id and r.betten <> '{}'::jsonb
    );
  if offen > 0 then
    raise exception '0247: % Objekte haben Betten, aber kein Zimmer traegt sie', offen;
  end if;
end $$;

commit;
