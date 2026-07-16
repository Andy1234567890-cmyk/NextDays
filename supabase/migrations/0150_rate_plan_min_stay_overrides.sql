-- 0150_rate_plan_min_stay_overrides.sql — datumsgenauer Mindestaufenthalt PRO Rate-Plan
--
-- Analog zu rate_plan_price_overrides (0146), aber für den Mindestaufenthalt: ein
-- Hotel braucht je Zimmerkategorie × Rate-Plan an bestimmten Tagen einen eigenen
-- min_stay (z. B. Twin/BAR am 23.11. = 3 Nächte, Double/B&B am 15.11. = 5). Bisher
-- gab es nur den property-weiten Rate-Plan-Default über 365 Tage. Diese Tabelle
-- ergänzt ihn additiv: ein Datum-Eintrag überschreibt den Default für diesen Tag.
-- Gilt identisch auf allen 3 Vertriebswegen (Plattform/Rezeption/OTA) — der
-- Mindestaufenthalt wird bei Channex als min_stay_arrival/min_stay_through gepusht.

create table public.rate_plan_min_stay_overrides (
    id           uuid primary key default gen_random_uuid(),
    rate_plan_id uuid not null references public.rate_plans (id) on delete cascade,
    date         date not null,
    min_stay     integer check (min_stay is null or min_stay >= 1),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    unique (rate_plan_id, date)
);

create index rate_plan_min_stay_overrides_plan_date_idx
    on public.rate_plan_min_stay_overrides (rate_plan_id, date);

create trigger set_updated_at before update on public.rate_plan_min_stay_overrides
    for each row execute function public.set_updated_at();

-- RLS: über rate_plan -> property -> tenant (Muster wie rate_plan_price_overrides).
alter table public.rate_plan_min_stay_overrides enable row level security;
create policy rate_plan_min_stay_overrides_via_property on public.rate_plan_min_stay_overrides
  for all using (exists (
    select 1 from public.rate_plans rp
    join public.properties p on p.id = rp.property_id
    where rp.id = rate_plan_min_stay_overrides.rate_plan_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.rate_plans rp
    join public.properties p on p.id = rp.property_id
    where rp.id = rate_plan_min_stay_overrides.rate_plan_id
      and p.tenant_id = public.current_tenant_id()));

-- Realtime: der Min-Stay-Kalender im Editor abonniert die Tabelle live.
-- REPLICA IDENTITY FULL, damit DELETE-Events die rate_plan_id tragen (s. 0148).
alter table public.rate_plan_min_stay_overrides replica identity full;
alter publication supabase_realtime add table public.rate_plan_min_stay_overrides;
