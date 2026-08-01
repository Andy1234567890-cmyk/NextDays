-- Verkaufsobergrenze: type_attributes.occupancy.rooms und .units entfernen.
--
-- BEFUND (live gegen Channex-Staging gemessen 01.08.2026): count_of_rooms am
-- Room-Type ist nicht "Anzahl Zimmer der Wohnung", sondern die Obergrenze, wie
-- oft das Objekt am selben Tag verkauft werden kann. Ein höherer
-- availability-Push wird darauf gekappt, Channex sagt es wörtlich:
--   "Provided value is greater than max availability (3).
--    Value changes to max availability."
-- Gegengelesen: gepusht 5 → gespeichert 3; gepusht 2 bei count_of_rooms=1 →
-- gespeichert 1.
--
-- Bei "1 property = 1 buchbare Einheit" (CLAUDE.md) ist dieser Wert immer 1.
-- Bisher floss occupancy.rooms hinein, im Objekt-Editor als "Anzahl Zimmer"
-- beschriftet — genau die Verwechslung, vor der auch Lodgify warnt. Eine
-- 3-Zimmer-Wohnung wäre damit dreimal gleichzeitig verkaufbar gewesen, sobald
-- der Push-Pfad nicht mehr binär 0/1 ist. Heute schuetzt nur full_sync.base=1.
--
-- type_attributes.units war ein zweites Feld für dasselbe Konzept, das bei den
-- Portalen nichts bewirkt hat (reiner Anzeigewert) — nach Wurzel 4 ein
-- erfundener Wert, deshalb ersatzlos raus.
--
-- ACHTUNG Namensgleichheit: type_attributes.rooms (Zimmer-Zaehlwerk aus 0244,
-- {privat, gemeinschaftlich}) ist ein ANDERES Feld und bleibt unberührt.
-- Entfernt wird ausschliesslich occupancy -> rooms.

-- 1) occupancy.rooms entfernen, occupancy selbst bleibt (children/infants gehen
--    weiter als occ_children/occ_infants an Channex).
update properties
set type_attributes = jsonb_set(
      type_attributes,
      '{occupancy}',
      (type_attributes -> 'occupancy') - 'rooms'
    )
where jsonb_typeof(type_attributes -> 'occupancy') = 'object'
  and type_attributes -> 'occupancy' ? 'rooms';

-- 2) units entfernen.
update properties
set type_attributes = type_attributes - 'units'
where type_attributes ? 'units';

-- 3) Gegenprobe: danach darf keines der beiden Felder mehr existieren.
do $$
declare
  rest int;
begin
  select count(*) into rest
  from properties
  where type_attributes ? 'units'
     or (jsonb_typeof(type_attributes -> 'occupancy') = 'object'
         and type_attributes -> 'occupancy' ? 'rooms');
  if rest > 0 then
    raise exception '0245: % Objekte tragen weiterhin units/occupancy.rooms', rest;
  end if;
end $$;

-- Gegenzustand bei Channex (Wurzel 1): ein Room-Type, der dort schon mit
-- count_of_rooms > 1 steht, bleibt es, bis er neu gepusst wird — die DB weiss
-- davon nichts. Das erledigt NICHT diese Migration, sondern der Content-Sync:
--   scripts/channex/count_of_rooms_zuruecksetzen.py
-- Er liest die Room-Types der verbundenen Objekte, setzt count_of_rooms auf 1
-- und liest den Wert zur Kontrolle zurueck (ein 200 von Channex ist kein
-- Beweis, dass gespeichert wurde).
