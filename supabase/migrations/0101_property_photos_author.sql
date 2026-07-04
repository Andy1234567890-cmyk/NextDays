-- 0101_property_photos_author.sql — Foto-Urheber (Autor) je Bild
--
-- Channex/die Buchungsportale kennen pro Foto ein `author`-Feld (Fotograf/
-- Urheber). Wir speichern es je Foto und pushen es im Content-Sync mit (live
-- verifiziert: Channex nimmt author an und gibt es zurück). Optional, leer =
-- weggelassen. Idempotent.

alter table public.property_photos
    add column if not exists author text;
