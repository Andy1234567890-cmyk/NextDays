-- 0098_hotel_room_types.sql — Hotel-Zimmertypen im property_type-Enum
--
-- Betriebsart 'hotel' (0090): Objekte sind ZIMMER, nicht Ferienobjekte. Die
-- bisherigen Typen (ferienhaus, appartement, glamping, …) passen dort nicht —
-- Typ-Filter und Objekt-Anlage zeigen je Betriebsart die passende Liste
-- (UI-Logik in lib/property-meta.ts, typeOptionsFor). Die Enum-Werte sind
-- additiv; Bestandsdaten bleiben gültig.
--
-- Hinweis: Der Runner wrappt jede Migration in begin/commit
-- (apply-migrations.sh). ALTER TYPE … ADD VALUE ist ab PG 12 in einer
-- Transaktion erlaubt, SOLANGE der neue Wert nicht in derselben Transaktion
-- verwendet wird (sonst „unsafe use of new value"). Deshalb NIE Enum-Wert
-- anlegen UND im selben Migrations-File nutzen — dafür ein Folge-File.

alter type public.property_type add value if not exists 'einzelzimmer';
alter type public.property_type add value if not exists 'doppelzimmer';
alter type public.property_type add value if not exists 'zweibettzimmer';
alter type public.property_type add value if not exists 'familienzimmer';
alter type public.property_type add value if not exists 'junior_suite';
alter type public.property_type add value if not exists 'suite';
