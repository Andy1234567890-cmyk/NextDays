-- 0267_availability_schluesseltausch.sql — alter Kalender-Schlüssel fällt
--
-- Seit 0266 trägt jede availability-Zeile ihre Einheit, und es gibt den Index
-- (property_id, unit_id, date). Die ALTE Bedingung (property_id, date) stand
-- bewusst noch daneben, damit die auf dem Server laufende Vorversion (die mit
-- `on_conflict=property_id,date` schreibt) nicht bricht.
--
-- Jetzt fällt sie. Ab hier kann ein Objekt mehrere Einheiten am selben Tag
-- führen — vorher scheiterte die zweite Einheit an genau dieser Bedingung.
--
-- REIHENFOLGE (wichtig): Diese Migration läuft NACH dem Ausrollen des neuen
-- Stands, nicht davor. Der neue Code schreibt mit dem Tripel-Konfliktziel und
-- funktioniert auch, solange die alte Bedingung noch existiert — umgekehrt
-- bräche der alte Code sofort, wenn sie zuerst verschwände.

alter table public.availability
    drop constraint if exists availability_property_id_date_key;
