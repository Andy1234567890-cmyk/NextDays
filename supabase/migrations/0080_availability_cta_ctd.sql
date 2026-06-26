-- 0080_availability_cta_ctd.sql
-- CTA/CTD-Restriktionen pro Tag: Closed-to-Arrival (keine Anreise an diesem Tag)
-- und Closed-to-Departure (keine Abreise an diesem Tag). Liegen auf der
-- bestehenden availability-Tabelle (eine Zeile pro property_id/date) — sie wird
-- wie bei Preis/Block per Upsert auch für sonst offene Tage angelegt.
--
-- availability ist bereits replica identity full + in der supabase_realtime-
-- Publication (0048_calendar_realtime.sql) -> keine zusaetzliche Realtime-Aufnahme
-- noetig; CTA/CTD-Aenderungen kommen ueber denselben availability-Channel live an.

alter table public.availability
    add column if not exists closed_to_arrival   boolean not null default false,
    add column if not exists closed_to_departure boolean not null default false;
