-- 0076_realtime_property_addons.sql — property_addons in die Realtime-Publication
--
-- Nachzügler zu 0074: der Katalog (property_addons) war nicht in
-- supabase_realtime, daher kamen beim Anlegen/Bearbeiten/Löschen einer
-- Zusatzleistung KEINE WebSocket-Events → die Konfig-UI aktualisierte erst nach
-- Reload. reservation_addons (0075) war bereits drin. Projekt-Grundsatz:
-- ALLES läuft über Supabase-Realtime, kein Polling.

alter publication supabase_realtime add table public.property_addons;
