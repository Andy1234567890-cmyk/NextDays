-- 0016_price_overrides.sql — manuelle Tagespreis-Überschreibung (Lastenheft §2.2)
--
-- Überschreibt den Rate-Plan-Preis für einen einzelnen Tag direkt im Kalender.
-- Zurücknehmen = Zeile löschen (oder price NULL). Eine Zeile pro property/date.

create table public.price_overrides (
    id          uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties (id) on delete cascade,
    date        date not null,
    price       numeric(12, 2) check (price is null or price >= 0),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (property_id, date)
);

create index price_overrides_property_date_idx
    on public.price_overrides (property_id, date);

create trigger set_updated_at before update on public.price_overrides
    for each row execute function public.set_updated_at();

-- RLS: über property -> tenant (Muster wie availability).
alter table public.price_overrides enable row level security;
create policy price_overrides_via_property on public.price_overrides
  for all using (exists (
    select 1 from public.properties p
    where p.id = price_overrides.property_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = price_overrides.property_id
      and p.tenant_id = public.current_tenant_id()));
