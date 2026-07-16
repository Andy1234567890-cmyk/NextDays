-- 0147_realtime_rate_plan_price_overrides.sql — rate_plan_price_overrides in die
-- Realtime-Publication
--
-- Nachzügler zu 0146: die neue Tabelle für datumsgenaue Preise pro Rate-Plan war
-- nicht in supabase_realtime, daher kamen beim Setzen/Zurücknehmen eines
-- Datumspreises KEINE WebSocket-Events → der Preis-Kalender im Rate-Plan-Editor
-- aktualisierte erst nach Reload. Projekt-Grundsatz: ALLES über Supabase-Realtime,
-- kein Polling (jede neue speisende Tabelle MUSS in die Publication).

alter publication supabase_realtime add table public.rate_plan_price_overrides;
