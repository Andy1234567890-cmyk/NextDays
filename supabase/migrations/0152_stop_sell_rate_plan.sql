-- 0152_stop_sell_rate_plan.sql — Stop-Sell pro Rate-Plan (Hotel)
--
-- Ein Hotel sperrt nicht das Objekt, sondern eine Zimmerkategorie×Rate-Plan-
-- Kombination (Twin/BAR am 14.11. ≠ Double/B&B am 20.11. — Channex-Zert Test 6).
-- rate_plan_id = null bleibt die Objekt-Ebene (Ferienwohnung, bestehende Daten):
-- ein solcher Stopp gilt weiterhin für ALLE Pläne des Objekts.
--
-- unique(property_id, date) trug nur einen Stopp pro Tag; für plan-genaue Stops
-- braucht der Tag mehrere Zeilen (eine je Plan). UNIQUE NULLS NOT DISTINCT
-- (PG 15) hält dabei die Objekt-Ebene dedupliziert (zwei NULL-Zeilen pro Tag
-- wären sonst erlaubt) UND trägt die PostgREST-Upserts (partielle Indexe können
-- kein ON CONFLICT-Arbiter sein).
--
-- RLS (0084) und REPLICA IDENTITY FULL (0048) bestehen bereits — nur Spalte,
-- Constraint-Tausch und Plan-Index.

alter table public.stop_sell
    add column if not exists rate_plan_id uuid
        references public.rate_plans (id) on delete cascade;

alter table public.stop_sell
    drop constraint if exists stop_sell_property_id_date_key;

alter table public.stop_sell
    add constraint stop_sell_property_date_plan_key
        unique nulls not distinct (property_id, date, rate_plan_id);

create index if not exists stop_sell_rate_plan_idx
    on public.stop_sell (rate_plan_id) where rate_plan_id is not null;
