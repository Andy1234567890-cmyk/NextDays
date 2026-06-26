-- Eigenplattform-Beschreibung: ein optionaler Beschreibungstext NUR für die
-- eigene Buchungsstrecke (myNextDays/booking_engine), getrennt von der
-- kanonischen `description`, die uniform an Channex → alle OTAs verteilt wird.
--
-- Channex unterstützt nur EINE Property-Beschreibung pro Objekt (kein Text pro
-- OTA). Daher bleibt `description` die Wahrheit für OTAs; `platform_description`
-- überschreibt sie ausschließlich auf der eigenen Plattform.
--
-- NULL = kein Override → die eigene Plattform fällt auf `description` zurück
-- (kein erfundener Wert, keine Backfill-Kopie).

alter table public.properties
    add column if not exists platform_description text;
