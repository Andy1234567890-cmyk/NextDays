-- 0153_rate_plan_restriction_overrides.sql — CTA/CTD/Max-Stay PRO Rate-Plan
--
-- Analog zu rate_plan_price_overrides (0146) und rate_plan_min_stay_overrides
-- (0150): datumsgenaue Restriktionen je Zimmerkategorie × Rate-Plan, die BISHER
-- nirgends plan-genau lokal lagen. closed_to_arrival/closed_to_departure standen
-- nur property-weit in availability, max_stay wurde gar nicht gespeichert (nur an
-- Channex gepusht). Ohne lokale Ablage konnte die UI gesetzte Restriktionen weder
-- anzeigen noch nachträglich bearbeiten — genau das schließt diese Tabelle.
--
-- Ein Eintrag überschreibt den Default (offen / kein Max-Stay) für DIESEN Tag.
-- Gilt identisch auf allen 3 Vertriebswegen; an Channex als closed_to_arrival/
-- closed_to_departure/max_stay pro Datum gepusht. NULL in einer Spalte = für diese
-- Restriktion kein Override (die anderen Spalten der Zeile gelten weiter).

create table public.rate_plan_restriction_overrides (
    id                   uuid primary key default gen_random_uuid(),
    rate_plan_id         uuid not null references public.rate_plans (id) on delete cascade,
    date                 date not null,
    closed_to_arrival    boolean,
    closed_to_departure  boolean,
    max_stay             integer check (max_stay is null or max_stay >= 0),
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    unique (rate_plan_id, date)
);

create index rate_plan_restriction_overrides_plan_date_idx
    on public.rate_plan_restriction_overrides (rate_plan_id, date);

create trigger set_updated_at before update on public.rate_plan_restriction_overrides
    for each row execute function public.set_updated_at();

-- RLS: über rate_plan -> property -> tenant (Muster wie 0150).
alter table public.rate_plan_restriction_overrides enable row level security;
create policy rate_plan_restriction_overrides_via_property on public.rate_plan_restriction_overrides
  for all using (exists (
    select 1 from public.rate_plans rp
    join public.properties p on p.id = rp.property_id
    where rp.id = rate_plan_restriction_overrides.rate_plan_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.rate_plans rp
    join public.properties p on p.id = rp.property_id
    where rp.id = rate_plan_restriction_overrides.rate_plan_id
      and p.tenant_id = public.current_tenant_id()));

-- Realtime: der Restriktions-Kalender abonniert die Tabelle live.
-- REPLICA IDENTITY FULL, damit DELETE-Events die rate_plan_id tragen (s. 0148).
alter table public.rate_plan_restriction_overrides replica identity full;
alter publication supabase_realtime add table public.rate_plan_restriction_overrides;
