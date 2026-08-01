-- Schlafgelegenheiten: type_attributes.beds wird vom Auswahl-Array zum Zählwerk.
--
-- Vorher lagen in der Spalte zwei Altformate nebeneinander (live geprüft):
--   * string[] aus der alten Mehrfachauswahl:   ["Doppelbett", "Einzelbett"]
--   * eine blanke Zahl aus einer früheren Wizard-Version:  1
-- Neu ist durchgängig ein Objekt {slug: anzahl}, weil ein Objekt mehrere gleiche
-- Betten hat (2 Einzelbetten) — das trägt eine reine Auswahlliste nicht.
--
-- Wurzel 1 (Gegenzustand): die alten Werte werden nicht daneben stehen gelassen,
-- sondern in einem Zug überführt; der Lesepfad im Frontend (readBeds) versteht
-- die Altformate weiterhin, damit ein Rollback der App nichts verliert.

-- 1) Array-Form → Zählwerk. Gleiche Labels werden aufaddiert, unbekannte Labels
--    bleiben als kleingeschriebener Slug erhalten (nichts wird verworfen).
update properties p
set type_attributes = p.type_attributes || jsonb_build_object('beds', z.zaehlwerk)
from (
  select
    p2.id,
    jsonb_object_agg(m.slug, m.anzahl) as zaehlwerk
  from properties p2
  cross join lateral (
    select
      case lower(btrim(bett.wert))
        when 'doppelbett'               then 'doppelbett'
        when 'einzelbett'               then 'einzelbett'
        when 'breites doppelbett'       then 'breites_doppelbett'
        when 'extrabreites doppelbett'  then 'extrabreites_doppelbett'
        when 'kingsize-bett'            then 'kingsize'
        when 'kingsize'                 then 'kingsize'
        when 'etagenbett'               then 'etagenbett'
        when 'hochbett'                 then 'hochbett'
        when 'schlafsofa'               then 'schlafsofa'
        when 'schrankbett'              then 'schrankbett'
        when 'ausziehbett'              then 'ausziehbett'
        when 'futon'                    then 'futon'
        when 'wasserbett'               then 'wasserbett'
        when 'kinderbett'               then 'kinderbett'
        when 'babybett'                 then 'babybett'
        else regexp_replace(lower(btrim(bett.wert)), '\s+', '_', 'g')
      end as slug,
      count(*)::int as anzahl
    from jsonb_array_elements_text(p2.type_attributes -> 'beds') as bett(wert)
    where btrim(bett.wert) <> ''
    group by 1
  ) m
  where jsonb_typeof(p2.type_attributes -> 'beds') = 'array'
  group by p2.id
) z
where p.id = z.id;

-- 2) Leeres Array → leeres Zählwerk (sonst bliebe [] als Fremdkörper stehen).
update properties
set type_attributes = type_attributes || jsonb_build_object('beds', '{}'::jsonb)
where jsonb_typeof(type_attributes -> 'beds') = 'array'
  and jsonb_array_length(type_attributes -> 'beds') = 0;

-- 3) Blanke Zahl → Einzelbetten. Die Zahl sagte nur "so viele Betten", ohne Typ.
--    Als Doppelbett zu deuten wäre geraten und würde die Schlafplätze verdoppeln;
--    Einzelbett ist die kleinste Aussage, die die Kapazität nicht überzeichnet.
update properties
set type_attributes = type_attributes || jsonb_build_object(
      'beds', jsonb_build_object('einzelbett', (type_attributes ->> 'beds')::int)
    )
where jsonb_typeof(type_attributes -> 'beds') = 'number'
  and (type_attributes ->> 'beds')::int > 0;

-- 4) Zahl 0 / negativ → leeres Zählwerk.
update properties
set type_attributes = type_attributes || jsonb_build_object('beds', '{}'::jsonb)
where jsonb_typeof(type_attributes -> 'beds') = 'number'
  and (type_attributes ->> 'beds')::int <= 0;

-- Gegenprobe: nach dieser Migration darf beds nur noch object oder gar nicht sein.
do $$
declare
  rest int;
begin
  select count(*) into rest
  from properties
  where type_attributes ? 'beds'
    and jsonb_typeof(type_attributes -> 'beds') <> 'object';
  if rest > 0 then
    raise exception 'Migration 0242: % Zeile(n) mit beds im Altformat übrig', rest;
  end if;
end $$;
