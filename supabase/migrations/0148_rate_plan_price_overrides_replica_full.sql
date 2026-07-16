-- 0148_rate_plan_price_overrides_replica_full.sql — DELETE-Events mit rate_plan_id
--
-- Nachzügler zu 0147: die Tabelle war zwar in der Realtime-Publication, stand
-- aber auf REPLICA IDENTITY DEFAULT (nur Primary Key). Bei DELETE sendet Supabase-
-- Realtime dann nur die id in old_record — NICHT rate_plan_id. Das WebSocket-Abo
-- filtert aber auf rate_plan_id=eq.<id>, also matchten DELETE-Events nicht und der
-- Preis-Kalender aktualisierte beim Löschen nicht (nur beim Setzen). price_overrides
-- und stop_sell stehen aus demselben Grund bereits auf FULL.

alter table public.rate_plan_price_overrides replica identity full;
