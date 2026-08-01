-- Wohnfläche: type_attributes.size_m2 geht in die echten Spalten size_value /
-- size_unit (0197) auf.
--
-- WARUM: Die Fläche stand an zwei Orten. Die Spalten sind validiert (0 < x ≤
-- 100000, Einheit nur sqm/sqft), das jsonb-Feld war es nicht — und die Oberfläche
-- las mal das eine, mal das andere. Zwei Wahrheiten über dieselbe Zahl heißt,
-- dass irgendwann die falsche angezeigt wird.
--
-- REGEL: Die echte Spalte gewinnt, wenn sie gesetzt ist; sonst wird der jsonb-
-- Wert übernommen. Die Einheit dazu ist Quadratmeter — das war die einzige
-- Bedeutung, die size_m2 je hatte (der Name sagt es). Umgerechnet wird nichts.

begin;

update public.properties
set size_value = (type_attributes ->> 'size_m2')::numeric,
    size_unit = coalesce(size_unit, 'sqm')
where size_value is null
  and jsonb_typeof(type_attributes -> 'size_m2') = 'number'
  and (type_attributes ->> 'size_m2')::numeric > 0;

-- Einheit nachziehen, wo eine Fläche steht, aber keine Einheit. Ohne sie wäre
-- die Zahl nicht lesbar; sqm ist keine Erfindung, sondern die Bedeutung, unter
-- der der Wert erfasst wurde.
update public.properties
set size_unit = 'sqm'
where size_value is not null and size_unit is null;

-- Altfeld entfernen: es hat jetzt keinen Leser mehr.
update public.properties
set type_attributes = type_attributes - 'size_m2'
where type_attributes ? 'size_m2';

-- Die kurzlebige Zwischenform (Einheit im jsonb) ebenfalls, damit sie nicht als
-- dritte Wahrheit liegen bleibt.
update public.properties
set type_attributes = type_attributes - 'size_unit'
where type_attributes ? 'size_unit';

do $$
declare
  rest int;
begin
  select count(*) into rest
  from public.properties
  where type_attributes ? 'size_m2' or type_attributes ? 'size_unit';
  if rest > 0 then
    raise exception '0249: % Objekte tragen die Fläche weiterhin im jsonb', rest;
  end if;
end $$;

commit;
