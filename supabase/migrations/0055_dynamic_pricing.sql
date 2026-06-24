-- 0055_dynamic_pricing.sql — Dynamic Pricing Phase 1 (regelbasiert)
--
-- Zwei neue Tabellen:
--   dynamic_prices  — je (Objekt, Tag) der von der Regel-Engine berechnete Preis
--                     + optionaler dynamischer Min-Stay. DP schreibt NUR hierhin,
--                     NIEMALS in price_overrides (das bleibt die MANUELLE
--                     Host-Überschreibung). Resolver-Priorität:
--                     manueller override > dynamic_price > weekday > base.
--   dp_settings     — Dynamic-Pricing-Konfiguration je Objekt (opt-in, default AUS).
--
-- RLS analog price_overrides (0016): über die property → tenant. Beide Tabellen
-- werden durch 0054 (Realtime: alle RLS-Tabellen) automatisch live propagiert,
-- sobald sie RLS haben — daher RLS hier sofort aktivieren.

-- == dynamic_prices ==========================================================
create table public.dynamic_prices (
    id          uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties (id) on delete cascade,
    date        date not null,
    price       numeric(12, 2) not null check (price >= 0),
    min_stay    integer check (min_stay is null or min_stay >= 1),
    computed_at timestamptz not null default now(),
    unique (property_id, date)
);

create index dynamic_prices_property_date_idx
    on public.dynamic_prices (property_id, date);

alter table public.dynamic_prices enable row level security;
create policy dynamic_prices_via_property on public.dynamic_prices
  for all using (exists (
    select 1 from public.properties p
    where p.id = dynamic_prices.property_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = dynamic_prices.property_id
      and p.tenant_id = public.current_tenant_id()));

-- == dp_settings =============================================================
-- Dynamic Pricing ist OPT-IN: enabled default false → der Vermieter aktiviert es
-- pro Objekt. Sinnvolle Defaults für die Regel-Engine; min_price/max_price
-- optional (None = keine Grenze, dann kein Clamp auf dieser Seite).
create table public.dp_settings (
    property_id           uuid primary key
                          references public.properties (id) on delete cascade,
    enabled               boolean not null default false,
    min_price             numeric(12, 2) check (min_price is null or min_price >= 0),
    max_price             numeric(12, 2) check (max_price is null or max_price >= 0),
    weekend_uplift_pct    numeric(6, 2) not null default 15,   -- Fr/Sa-Aufschlag %
    -- Last-Minute-Regeln: [{days_before, discount_pct}], absteigend angewandt.
    last_minute           jsonb not null default
                          '[{"days_before": 7, "discount_pct": 10},'
                          ' {"days_before": 3, "discount_pct": 20}]'::jsonb,
    orphan_gap_discount_pct numeric(6, 2) not null default 15, -- 1–2-Nächte-Lücken
    occupancy_sensitivity numeric(6, 2) not null default 30,   -- max Auf/Abschlag %
    min_stay_min          integer not null default 1 check (min_stay_min >= 1),
    min_stay_max          integer not null default 7 check (min_stay_max >= 1),
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create trigger set_updated_at before update on public.dp_settings
    for each row execute function public.set_updated_at();

alter table public.dp_settings enable row level security;
create policy dp_settings_via_property on public.dp_settings
  for all using (exists (
    select 1 from public.properties p
    where p.id = dp_settings.property_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = dp_settings.property_id
      and p.tenant_id = public.current_tenant_id()));

-- Realtime: beide Tabellen haben RLS → in die supabase_realtime-Publication
-- aufnehmen (Muster wie 0054, idempotent), damit Kalender-Badges live folgen.
alter table public.dynamic_prices replica identity full;
alter table public.dp_settings    replica identity full;
do $$
declare
  t text;
  tables text[] := array['dynamic_prices', 'dp_settings'];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
