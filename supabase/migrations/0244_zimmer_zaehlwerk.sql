-- Zimmer: type_attributes.rooms wird vom Auswahl-Array zum Zählwerk mit zwei
-- Ebenen (privat / gemeinschaftlich).
--
-- Vorher lag dort ein string[] mit deutschen Labels: ["Badezimmer", "Küche"].
-- Das trägt zwei Dinge nicht, die für Gäste wesentlich sind:
--   * die ANZAHL — eine Wohnung hat 2 Schlafzimmer, nicht "Schlafzimmer ja/nein"
--   * die EBENE — in einer Anlage ist ein Gemeinschaftsbad etwas anderes als
--     ein eigenes Bad
-- Neu: {"privat": {slug: anzahl}, "gemeinschaftlich": {slug: anzahl}}.
--
-- Wurzel 1 (Gegenzustand): das Altformat wird nicht danebenstehen gelassen,
-- sondern überführt; der Lesepfad im Frontend (readZimmer) versteht es weiter,
-- damit ein Rollback der App nichts verliert.

update properties p
set type_attributes = p.type_attributes
  || jsonb_build_object('rooms', jsonb_build_object(
       'privat', z.zaehlwerk,
       'gemeinschaftlich', '{}'::jsonb
     ))
from (
  select
    p2.id,
    jsonb_object_agg(m.slug, m.anzahl) as zaehlwerk
  from properties p2
  cross join lateral (
    select
      case lower(btrim(raum.wert))
        when 'balkon'        then 'balkon'
        when 'badezimmer'    then 'badezimmer'
        when 'schlafzimmer'  then 'schlafzimmer'
        when 'esszimmer'     then 'esszimmer'
        when 'küche'         then 'kueche'
        when 'kueche'        then 'kueche'
        when 'wohnzimmer'    then 'wohnzimmer'
        when 'spielzimmer'   then 'spielzimmer'
        when 'terrasse'      then 'terrasse'
        when 'wc'            then 'wc'
        -- Altbestand kannte nur "Gäste-WC"; der neue Katalog führt "WC".
        when 'gäste-wc'      then 'wc'
        when 'gaeste-wc'     then 'wc'
        when 'arbeitszimmer' then 'arbeitszimmer'
        else regexp_replace(lower(btrim(raum.wert)), '\s+', '_', 'g')
      end as slug,
      count(*)::int as anzahl
    from jsonb_array_elements_text(p2.type_attributes -> 'rooms') as raum(wert)
    where btrim(raum.wert) <> ''
    group by 1
  ) m
  where jsonb_typeof(p2.type_attributes -> 'rooms') = 'array'
  group by p2.id
) z
where p.id = z.id;

-- Leeres Array → leeres Zählwerk (sonst bliebe [] als Fremdkörper stehen).
update properties
set type_attributes = type_attributes
  || jsonb_build_object('rooms', jsonb_build_object(
       'privat', '{}'::jsonb, 'gemeinschaftlich', '{}'::jsonb
     ))
where jsonb_typeof(type_attributes -> 'rooms') = 'array'
  and jsonb_array_length(type_attributes -> 'rooms') = 0;

-- Gegenprobe: nach dieser Migration darf rooms nur noch object oder gar nicht sein.
do $$
declare
  rest int;
begin
  select count(*) into rest
  from properties
  where type_attributes ? 'rooms'
    and jsonb_typeof(type_attributes -> 'rooms') <> 'object';
  if rest > 0 then
    raise exception 'Migration 0244: % Zeile(n) mit rooms im Altformat übrig', rest;
  end if;
end $$;
