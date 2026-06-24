-- 0051_property_pricing_config.sql — strukturierte Pricing-Konfiguration je Objekt
--
-- Eine Preis-Wahrheit: bisher lag die gesamte Pricing-Konfig (Kanal-Markups,
-- Extra-Gast-/Kurzaufenthalts-Aufschlag, längenabhängige Preise, Gebühren,
-- Steuern, Aktionen, Add-ons) als opaker Blob in properties.type_attributes.pricing
-- und wurde von NIEMANDEM gelesen (Kalender/Quote/Channex ignorierten ihn).
--
-- Diese Tabelle überführt den Blob in eine definierte, vom zentralen Preis-
-- Resolver (features/pricing/resolver.py) tatsächlich gelesene Struktur:
--   * Skalare Stellschrauben als typisierte Spalten (basispreis-nahe Logik),
--   * listenförmige Teile (lengthPrices/fees/taxes/promotions/addOns) als jsonb.
--
-- Abgrenzung der Preisquellen (jede genau eine Wahrheit):
--   rate_plans      = Basispreis + min_stay (Channex-Wahrheit). Bleibt.
--   price_overrides = tagesgenauer Preis inkl. Saison. Bleibt DIE Per-Tag-Quelle.
--   property_pricing_config (DIESE Tabelle) = Aufschläge/Gebühren/Steuern/Rabatte,
--     die der Resolver auf die Effektiv-Tagespreise anwendet (quote()).
--
-- tenant_id wird mitgeführt, damit Realtime clientseitig pro Tenant filtern kann
-- (analog reservation_cancellation_log). RLS scoped zusätzlich über die property.

create table public.property_pricing_config (
    property_id        uuid primary key
                       references public.properties (id) on delete cascade,
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    currency           text not null default 'EUR',
    -- Grundpreis pro Wochentag (nur wirksam, wenn custom_by_weekday). Keys:
    -- mon/tue/wed/thu/fri/sat/sun → Preis pro Nacht. Der Resolver nutzt diese
    -- vor dem rate_plans-Basispreis, aber nach einem price_override.
    custom_by_weekday  boolean not null default false,
    weekday_prices     jsonb   not null default '{}'::jsonb,
    -- Aufschläge.
    markup             jsonb   not null default '{}'::jsonb,  -- {airbnb,booking,google}: %
    extra_guest_charge numeric(12, 2) not null default 0,     -- pro Gast/Nacht
    extra_guest_from   integer not null default 1,            -- ab dem wievielten Gast
    short_stay_max_nights integer not null default 0,         -- 0 = aus
    short_stay_surcharge  numeric(12, 2) not null default 0,  -- pro Nacht
    -- Listenförmige Teile (Struktur wie lib/pricing-meta.ts).
    length_prices      jsonb   not null default '[]'::jsonb,
    fees               jsonb   not null default '[]'::jsonb,
    taxes              jsonb   not null default '[]'::jsonb,
    promotions         jsonb   not null default '[]'::jsonb,
    add_ons            jsonb   not null default '[]'::jsonb,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index property_pricing_config_tenant_idx
    on public.property_pricing_config (tenant_id);

create trigger set_updated_at before update on public.property_pricing_config
    for each row execute function public.set_updated_at();

-- RLS: über die property → tenant (Muster wie price_overrides). Die mitgeführte
-- tenant_id muss zur property gehören (with check), damit Realtime-Filter und
-- Eigentum konsistent bleiben.
alter table public.property_pricing_config enable row level security;
create policy property_pricing_config_via_property on public.property_pricing_config
  for all using (exists (
    select 1 from public.properties p
    where p.id = property_pricing_config.property_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = property_pricing_config.property_id
      and p.tenant_id = property_pricing_config.tenant_id
      and p.tenant_id = public.current_tenant_id()));

-- Backfill aus dem bestehenden properties.type_attributes.pricing-Blob (kein
-- Datenverlust). Nur Objekte mit vorhandenem pricing-Objekt. Fehlende Felder
-- bleiben auf den Spalten-Defaults (kein erfundener Wert).
insert into public.property_pricing_config (
    property_id, tenant_id, currency, custom_by_weekday, weekday_prices, markup,
    extra_guest_charge, extra_guest_from, short_stay_max_nights,
    short_stay_surcharge, length_prices, fees, taxes, promotions, add_ons
)
select
    p.id,
    p.tenant_id,
    coalesce(pr->>'currency', 'EUR'),
    coalesce((pr->>'customByWeekday')::boolean, false),
    coalesce(pr->'weekdayPrices', '{}'::jsonb),
    coalesce(pr->'markup', '{}'::jsonb),
    coalesce((pr->>'extraGuestCharge')::numeric, 0),
    coalesce((pr->>'extraGuestFrom')::integer, 1),
    coalesce((pr->>'shortStayMaxNights')::integer, 0),
    coalesce((pr->>'shortStaySurcharge')::numeric, 0),
    coalesce(pr->'lengthPrices', '[]'::jsonb),
    coalesce(pr->'fees', '[]'::jsonb),
    coalesce(pr->'taxes', '[]'::jsonb),
    coalesce(pr->'promotions', '[]'::jsonb),
    coalesce(pr->'addOns', '[]'::jsonb)
from public.properties p
cross join lateral (
    select p.type_attributes->'pricing' as pr
) j
where j.pr is not null and jsonb_typeof(j.pr) = 'object'
on conflict (property_id) do nothing;
