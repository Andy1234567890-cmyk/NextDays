-- 0060_dynamic_pricing_pickup.sql — Dynamic Pricing Roadmap: Pickup + Phase-1-Felder
--
-- Zwei Teile:
-- (1) dp_settings: neue Engine-Parameter aus der Wettbewerbs-Recherche
--     (asymmetrische Auslastungs-Caps + Vorlauf-Buckets). Rein additiv, Defaults
--     bilden die Best Practice ab (Rabatt-Cap 20 %, Aufschlag-Cap 15 %).
-- (2) dp_pickup_snapshots: tägliche Momentaufnahme der gebuchten Nächte je
--     (Objekt, Aufenthaltsdatum). Daraus leitet der Recompute die Pickup-
--     Geschwindigkeit ab (antizipatives Signal, Beyond/Wheelhouse) UND es ist das
--     Lern-Fundament fürs spätere KI-Modell (Pickup-Kurven). Erfassung läuft ab
--     Tag 1 mit, damit Historie entsteht.

-- == (1) dp_settings: Phase-1-Engine-Parameter ==============================
alter table public.dp_settings
    -- Asymmetrische Deckelung des Auslastungs-/Pickup-Faktors (Prozent).
    add column if not exists occupancy_discount_cap_pct numeric(6, 2) not null default 20
        check (occupancy_discount_cap_pct >= 0),
    add column if not exists occupancy_premium_cap_pct  numeric(6, 2) not null default 15
        check (occupancy_premium_cap_pct >= 0),
    -- Vorlauf-Buckets als JSON: [{"max_days_before": 15, "weight": 1.0}, ...].
    -- Leer = keine Bucket-Dämpfung (Verhalten wie zuvor).
    add column if not exists occupancy_lead_buckets jsonb not null default '[]'::jsonb,
    -- RateBoard-Autopilot: berechnete Preise automatisch an die OTAs pushen.
    -- false = nur Empfehlung (sichtbar, aber kein externer Push).
    add column if not exists autopilot_enabled boolean not null default false,
    -- Wetter als externer Nachfrage-Faktor (DWD/Bright Sky). Opt-in + symmetrischer
    -- Cap der Wirkung in Prozent.
    add column if not exists weather_enabled boolean not null default false,
    add column if not exists weather_max_adjust_pct numeric(6, 2) not null default 10
        check (weather_max_adjust_pct >= 0),
    -- Rate Rules: manuelle Zusatzregeln (KI + Fachwissen) als JSON-Liste
    -- [{"match": {...}, "adjust_pct": 5}, ...]. Leer = keine.
    add column if not exists rate_rules jsonb not null default '[]'::jsonb;

-- == (2) dp_pickup_snapshots: tägliche Belegungs-Momentaufnahme =============
create table if not exists public.dp_pickup_snapshots (
    id            uuid primary key default gen_random_uuid(),
    property_id   uuid not null references public.properties (id) on delete cascade,
    -- Aufenthaltsdatum (die Nacht), für die der Stand erfasst wird.
    stay_date     date not null,
    -- Tag, an dem der Snapshot gezogen wurde (= „heute" zum Erfassungszeitpunkt).
    snapshot_date date not null,
    -- Tage zwischen Snapshot und Aufenthalt (Vorlauf-Position auf der Kurve).
    days_before   integer not null,
    -- Belegt an diesem Tag? (aus availability/reservations abgeleitet.)
    booked        boolean not null,
    created_at    timestamptz not null default now(),
    -- Ein Snapshot je (Objekt, Aufenthaltsdatum, Erfassungstag).
    unique (property_id, stay_date, snapshot_date)
);

create index if not exists dp_pickup_snapshots_lookup_idx
    on public.dp_pickup_snapshots (property_id, stay_date, snapshot_date);
create index if not exists dp_pickup_snapshots_stay_idx
    on public.dp_pickup_snapshots (property_id, stay_date);

-- RLS: über die Property (wie dp_settings/dynamic_prices). Service-Role (Cron)
-- umgeht RLS und schreibt die Snapshots.
alter table public.dp_pickup_snapshots enable row level security;
create policy dp_pickup_snapshots_via_property
  on public.dp_pickup_snapshots
  for all
  using (
    exists (
      select 1 from public.properties p
      where p.id = dp_pickup_snapshots.property_id
        and p.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.properties p
      where p.id = dp_pickup_snapshots.property_id
        and p.tenant_id = public.current_tenant_id()
    )
  );

-- Eigentümer-Scope (Lastenheft §4.2, analog 0059): owner sieht nur eigene.
create policy dp_pickup_snapshots_owner_scope
  on public.dp_pickup_snapshots
  as restrictive
  for select
  using (public.owner_can_see_property(property_id));
