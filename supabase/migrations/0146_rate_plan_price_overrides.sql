-- 0146_rate_plan_price_overrides.sql — datumsgenaue Preise PRO Rate-Plan (Hotel)
--
-- Bisher hängt der Tagespreis nur an (property_id, date) in price_overrides und
-- wird beim Channex-Push an ALLE Rate-Plans der Property gespiegelt. Ein Hotel
-- braucht aber je Zimmerkategorie × Rate-Plan (z. B. Twin/BAR ≠ Double/B&B) einen
-- eigenen Preis pro Datum. Diese Tabelle ergänzt price_overrides additiv:
-- Priorität im Resolver = rate_plan_override > property_override > dynamic > base.
-- Ein Preis gilt identisch auf allen 3 Vertriebswegen (Plattform/Rezeption/OTA) —
-- Preise werden NICHT pro Kanal getrennt (das betrifft nur Sperren, s. 0145).

create table public.rate_plan_price_overrides (
    id           uuid primary key default gen_random_uuid(),
    rate_plan_id uuid not null references public.rate_plans (id) on delete cascade,
    date         date not null,
    price        numeric(12, 2) check (price is null or price >= 0),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    unique (rate_plan_id, date)
);

create index rate_plan_price_overrides_plan_date_idx
    on public.rate_plan_price_overrides (rate_plan_id, date);

create trigger set_updated_at before update on public.rate_plan_price_overrides
    for each row execute function public.set_updated_at();

-- RLS: über rate_plan -> property -> tenant (Muster wie price_overrides, eine
-- Join-Ebene tiefer). anon hat pauschale Grants → RLS ist der einzige Backstop.
alter table public.rate_plan_price_overrides enable row level security;
create policy rate_plan_price_overrides_via_property on public.rate_plan_price_overrides
  for all using (exists (
    select 1 from public.rate_plans rp
    join public.properties p on p.id = rp.property_id
    where rp.id = rate_plan_price_overrides.rate_plan_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.rate_plans rp
    join public.properties p on p.id = rp.property_id
    where rp.id = rate_plan_price_overrides.rate_plan_id
      and p.tenant_id = public.current_tenant_id()));
