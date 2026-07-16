-- 0149_rate_plan_sync_state.sql — Sync-Status pro Rate-Plan (DB ↔ Channex)
--
-- Der Desired-State-Reconciler (ari_push.reconcile_rate_plan_prices) vergleicht
-- die datumsgenauen DB-Preise gegen den autoritativen Channex-Zustand. Sein
-- Ergebnis pro Rate-Plan wird hier festgehalten, damit das Frontend sichtbar
-- machen kann, ob die Preise eines Plans wirklich bei den Portalen sind
-- ('an Portale übertragen' vs. 'Übertragung ausstehend'). Eine Zeile je Rate-Plan.

create table public.rate_plan_sync_state (
    rate_plan_id uuid primary key references public.rate_plans (id) on delete cascade,
    -- true = DB-Datumspreise stimmen mit dem letzten Channex-Ist überein.
    in_sync      boolean not null default true,
    -- Anzahl abweichender (Tag×Preis)-Positionen beim letzten Abgleich.
    drift_count  integer not null default 0,
    checked_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create trigger set_updated_at before update on public.rate_plan_sync_state
    for each row execute function public.set_updated_at();

-- RLS: über rate_plan -> property -> tenant (Muster wie rate_plan_price_overrides).
alter table public.rate_plan_sync_state enable row level security;
create policy rate_plan_sync_state_via_property on public.rate_plan_sync_state
  for all using (exists (
    select 1 from public.rate_plans rp
    join public.properties p on p.id = rp.property_id
    where rp.id = rate_plan_sync_state.rate_plan_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.rate_plans rp
    join public.properties p on p.id = rp.property_id
    where rp.id = rate_plan_sync_state.rate_plan_id
      and p.tenant_id = public.current_tenant_id()));

-- Realtime: das Frontend abonniert den Sync-Status live pro Rate-Plan.
-- REPLICA IDENTITY FULL, damit auch UPDATE/DELETE-Events die rate_plan_id tragen
-- (das Abo filtert auf rate_plan_id, s. 0148 für dieselbe Begründung).
alter table public.rate_plan_sync_state replica identity full;
alter publication supabase_realtime add table public.rate_plan_sync_state;
