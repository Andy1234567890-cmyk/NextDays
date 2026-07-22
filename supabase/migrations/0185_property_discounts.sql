-- 0185_property_discounts.sql — Rabatt-/Deal-Engine (Booking/Airbnb-Modell)
--
-- Pro Objekt konfigurierbare Rabatte, die deterministisch im PricingResolver.
-- quote() als eigene Rabattzeile eingehen. Geld/Prozente in Basispunkten
-- (Ganzzahl, exakt) statt Float — discount_bps 100 = 1,00 %.
--
-- STACKING (Produktentscheidung): pro Buchung greift NUR der BESTE Einzelrabatt
-- (höchste effektive Ersparnis), kein Aufaddieren mehrerer Regeln — Booking/
-- Airbnb-Standard, verhindert versehentliche 60-%-Rabatte. Die Auswahl passiert
-- im Resolver.
--
-- Wurzel 6: RLS + harter GRANT-Entzug. Preis-/Rabattregeln sind Vertriebsdaten
-- (staff/cleaner/owner dürfen sie laut Daten-Split NICHT frei lesen/schreiben).
-- Nur service_role (FastAPI) verwaltet die Tabelle; RLS-Tenant-Policy als Backstop.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'discount_type') then
    create type public.discount_type as enum
      ('length_of_stay', 'early_booker', 'last_minute', 'custom');
  end if;
end $$;

create table if not exists public.property_discounts (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants(id) on delete cascade,
    property_id   uuid not null references public.properties(id) on delete cascade,
    discount_type public.discount_type not null,
    -- Rabatthöhe in Basispunkten (100 = 1,00 %). 1..10000 (0 % wäre no-op,
    -- >100 % wäre Geldschaden). Kein Fantasie-Default.
    discount_bps  integer not null check (discount_bps between 1 and 10000),
    active        boolean not null default true,
    -- length_of_stay: ab X Nächten. NUR für discount_type='length_of_stay'.
    min_nights    integer check (min_nights is null or min_nights >= 1),
    -- early_booker: Buchung >= X Tage vor Anreise. last_minute: <= X Tage.
    -- NUR für die jeweiligen Typen gesetzt.
    days_before   integer check (days_before is null or days_before >= 0),
    -- custom: Anreise in [starts_on, ends_on] (inklusiv). NUR für 'custom'.
    starts_on     date,
    ends_on       date,
    -- Anzeigename für die Rabattzeile im Quote (Gast sieht ihn). i18n-jsonb
    -- konsistent zu property_addons.name (Sprache -> Text). Leer erlaubt ->
    -- Resolver nutzt Typ-Default-Label.
    name          jsonb not null default '{}'::jsonb,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),

    -- Wurzel 5/4: Constraint erzwingt die je-Typ passenden Pflichtfelder, sodass
    -- eine sinnlose Regel (LOS ohne min_nights, custom ohne Zeitraum) gar nicht
    -- persistiert werden kann. Kein stiller Fallback im Code nötig.
    constraint property_discounts_fields_by_type check (
        (discount_type = 'length_of_stay'
            and min_nights is not null
            and days_before is null and starts_on is null and ends_on is null)
     or (discount_type = 'early_booker'
            and days_before is not null and days_before >= 1
            and min_nights is null and starts_on is null and ends_on is null)
     or (discount_type = 'last_minute'
            and days_before is not null
            and min_nights is null and starts_on is null and ends_on is null)
     or (discount_type = 'custom'
            and starts_on is not null and ends_on is not null
            and starts_on <= ends_on
            and min_nights is null and days_before is null)
    )
);

create index property_discounts_property_idx
    on public.property_discounts (property_id) where active;
create index property_discounts_tenant_idx
    on public.property_discounts (tenant_id);

-- Wurzel 1/2 (Idempotenz-Backstop): pro Objekt höchstens EINE AKTIVE Regel je
-- Nicht-custom-Typ (LOS/early/last_minute sind je genau eine Kurve). custom darf
-- mehrfach existieren (verschiedene Zeitfenster). Partieller UNIQUE-Index fängt
-- Doppelklick/Retry ab, bevor ein Duplikat den Quote doppelt rabattiert.
create unique index property_discounts_one_active_singleton
    on public.property_discounts (property_id, discount_type)
    where active and discount_type <> 'custom';

create trigger trg_property_discounts_updated
    before update on public.property_discounts
    for each row execute function public.set_updated_at();

-- Realtime — speist die Rabatt-Konfigurationsliste im Dashboard.
alter table public.property_discounts replica identity full;
alter publication supabase_realtime add table public.property_discounts;

-- ===================== Wurzel 6: RLS + REVOKE =====================
alter table public.property_discounts enable row level security;

-- Restriktive Tenant-Isolation für ALLE Operationen (nicht nur select), damit
-- der Schreibpfad nicht tenant-weit offen ist.
create policy property_discounts_tenant_isolation on public.property_discounts
    as restrictive
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Harter GRANT-Entzug: kein anon/authenticated liest ODER schreibt direkt per
-- /rest/v1/property_discounts. Rabatt-/Vertriebsregeln verlassen die DB nur
-- über den Server (service_role). Ein eingeloggter cleaner mit anon-Key kann
-- damit weder Rabatte lesen noch (viel schlimmer) discount_bps=10000 schreiben.
revoke select, insert, update, delete on public.property_discounts from anon;
revoke select, insert, update, delete on public.property_discounts from authenticated;

comment on table public.property_discounts is
  'Pro-Objekt Rabatt-/Deal-Regeln (LOS/early_booker/last_minute/custom), in bps. '
  'Deterministisch im PricingResolver.quote() angewandt (bester Einzelrabatt, '
  'kein Stacking). Nur service_role (Wurzel 6).';
