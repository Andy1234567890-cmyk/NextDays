-- 0562_dp_ausbau_hostaway_siteminder.sql — Dynamic Pricing: was Hostaway und
-- SiteMinder haben und uns fehlte (Vergleich vom 05.09.2026).
--
-- WARUM
-- =====
-- Drei Agenten haben Hostaway Dynamic Pricing, SiteMinder Dynamic Revenue Plus
-- und unseren eigenen Bestand nebeneinandergelegt. In der Regel-TIEFE liegen wir
-- vorn (einstellbare Auslastungsstufen, Wochenende, Lücken, Wetter, Markt-Karte,
-- KI-Erklärung, KI-Berater). Was fehlte, sind Bausteine der STEUERUNG:
--
--   1. Min/Max je Zeitraum        (SiteMinder „Floor and ceiling overrides")
--   2. Freigabe nach Vorlauf      (SiteMinder „Enabled for dates within X days")
--   3. Vorjahresanker             (Hostaway „Historical anchoring")
--   4. Basispreis aus dem Markt   (Hostaway „Market-driven base price")
--   5. Feiertage/Ferien-Feed      (SiteMinder Event-Datenbank 365 Tage voraus)
--   6. Verlauf je Datum           (SiteMinder „History": wer, wann, was)
--   7. DP je Ratenplan            (SiteMinder: EIN Ratenplan bekommt Empfehlungen)
--   8. DB-CHECKs fuer Regeln, die bisher nur Pydantic prüfte (Wurzel 6: der
--      DB-Direktpfad umgeht den Server)
--
-- Soll/Ist je Tag, Vorschau vor dem Einschalten und Forecast brauchen keine
-- Migration — sie lesen `channex_ari_shadow`, `preis_kurve` und
-- `dp_pickup_snapshots`.

-- ------------------------------------------------------------ 1. Preisgrenzen
-- Ein globales Min/Max reicht nicht: Hochsaison-Mindestpreis 900 und
-- Nebensaison-Mindestpreis 450 liessen sich bisher nicht abbilden. Die
-- spezifischste Grenze gewinnt (mit Wochentagen vor ohne; kuerzerer Zeitraum
-- vor laengerem); `jaehrlich` wiederholt den Zeitraum in jedem Jahr.
create table if not exists public.dp_preisgrenzen (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  bezeichnung  text not null,
  von          date not null,
  bis          date not null,
  -- 0 = Montag … 6 = Sonntag (wie `rate_rules.match.weekday`). NULL = alle Tage.
  wochentage   smallint[],
  jaehrlich    boolean not null default false,
  min_price    numeric(12, 2),
  max_price    numeric(12, 2),
  created_at   timestamptz not null default now(),
  created_by   uuid,
  constraint dp_preisgrenzen_zeitraum check (bis >= von),
  constraint dp_preisgrenzen_min_pos check (min_price is null or min_price >= 0),
  constraint dp_preisgrenzen_max_pos check (max_price is null or max_price >= 0),
  constraint dp_preisgrenzen_eine_grenze
    check (min_price is not null or max_price is not null),
  constraint dp_preisgrenzen_min_le_max
    check (min_price is null or max_price is null or max_price >= min_price),
  constraint dp_preisgrenzen_wochentage
    check (wochentage is null
           or (array_length(wochentage, 1) between 1 and 7
               and 0 <= all(wochentage) and 6 >= all(wochentage)))
);

comment on table public.dp_preisgrenzen is
  'Mindest-/Hoechstpreis je Zeitraum (SiteMinder „Floor and ceiling overrides"). '
  'Die spezifischste Grenze gewinnt; ohne Treffer gilt dp_settings.min/max_price.';

create index if not exists dp_preisgrenzen_property_idx
  on public.dp_preisgrenzen (property_id, von, bis);

alter table public.dp_preisgrenzen enable row level security;

drop policy if exists dp_preisgrenzen_via_property on public.dp_preisgrenzen;
create policy dp_preisgrenzen_via_property on public.dp_preisgrenzen
  for all
  using (exists (
    select 1 from public.properties p
    where p.id = dp_preisgrenzen.property_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = dp_preisgrenzen.property_id
      and p.tenant_id = public.current_tenant_id()));

-- Wurzel 6: steuert den Verkaufspreis — geschrieben nur ueber die API.
revoke insert, update, delete on public.dp_preisgrenzen from anon, authenticated;
grant select on public.dp_preisgrenzen to anon, authenticated;

-- ---------------------------------------------------------------- 6. Verlauf
-- „Wer hat wann was gesetzt, und wann ging welcher Preis an die Portale?"
-- Zeitraum statt Einzeltag: ein Push ueber 365 Tage ist EINE Handlung, nicht
-- 365. Die Tagesansicht filtert `von <= tag <= bis`.
create table if not exists public.dp_verlauf (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  von          date not null,
  bis          date not null,
  ereignis     text not null,
  details      jsonb not null default '{}'::jsonb,
  -- NULL = Automatik (Cron/Worker), sonst der handelnde Nutzer.
  user_id      uuid,
  created_at   timestamptz not null default now(),
  constraint dp_verlauf_zeitraum check (bis >= von),
  constraint dp_verlauf_ereignis check (ereignis in (
    'tagesmodus', 'freigabe', 'gesendet', 'einstellungen', 'preisgrenze',
    'automatik_an', 'automatik_aus'
  ))
);

comment on table public.dp_verlauf is
  'Verlauf des Dynamic Pricing je Objekt und Zeitraum (SiteMinder „History"): '
  'Tagesmodus, Freigabe, Portal-Push, Einstellungen. user_id NULL = Automatik.';

create index if not exists dp_verlauf_property_zeit_idx
  on public.dp_verlauf (property_id, von, bis);
create index if not exists dp_verlauf_property_created_idx
  on public.dp_verlauf (property_id, created_at desc);

alter table public.dp_verlauf enable row level security;

drop policy if exists dp_verlauf_via_property on public.dp_verlauf;
create policy dp_verlauf_via_property on public.dp_verlauf
  for select
  using (exists (
    select 1 from public.properties p
    where p.id = dp_verlauf.property_id
      and p.tenant_id = public.current_tenant_id()));

revoke insert, update, delete on public.dp_verlauf from anon, authenticated;
grant select on public.dp_verlauf to anon, authenticated;

-- ----------------------------------------------------- 5. Feiertage & Ferien
-- Betriebsuebergreifend wie markt_beobachtung: ein daenischer Feiertag ist fuer
-- alle Objekte in Daenemark derselbe. Bewusst NICHT in `events`/`event_periods`
-- (die sind je Betrieb und von Hand) — sonst zaehlte ein Betrieb, der seinen
-- Feiertag schon selbst eingetragen hat, ihn doppelt.
create table if not exists public.dp_feiertage (
  id           uuid primary key default gen_random_uuid(),
  -- ISO-3166-1 alpha-2 (DK, DE, AT …) wie properties.country.
  land         text not null,
  -- Bundesland/Region (Schulferien sind regional). NULL = landesweit.
  region       text,
  art          text not null,
  name         text not null,
  von          date not null,
  bis          date not null,
  quelle       text not null,
  extern_key   text not null,
  -- UNSERE Uhr (Wurzel 5b): wann WIR geladen haben.
  geladen_am   timestamptz not null default now(),
  constraint dp_feiertage_zeitraum check (bis >= von),
  constraint dp_feiertage_art check (art in ('feiertag', 'schulferien'))
);

-- Idempotenter Upsert des Feeds (Wurzel 2): derselbe Eintrag kommt taeglich.
create unique index if not exists dp_feiertage_eindeutig
  on public.dp_feiertage (land, coalesce(region, ''), art, extern_key);
create index if not exists dp_feiertage_land_zeit_idx
  on public.dp_feiertage (land, von, bis);

alter table public.dp_feiertage enable row level security;

drop policy if exists dp_feiertage_lesen on public.dp_feiertage;
create policy dp_feiertage_lesen
  on public.dp_feiertage for select
  to authenticated
  using (true);

revoke insert, update, delete on public.dp_feiertage from anon, authenticated;
revoke all on public.dp_feiertage from anon;

comment on table public.dp_feiertage is
  'Gesetzliche Feiertage und Schulferien je Land/Region aus oeffentlichen '
  'Quellen (Nager.Date, OpenHolidays API). Taeglicher Job, schreibt nur der Server.';

-- ------------------------------------------------------ dp_settings-Spalten
alter table public.dp_settings
  -- 2. Freigabe nur fuer nahe Tage: NULL = alle Tage (bisheriges Verhalten),
  --    sonst warten nur Tage mit Vorlauf <= X; fernere gehen automatisch.
  add column if not exists freigabe_ab_tagen integer,
  -- 3. Vorjahresanker: bester Nachtpreis derselben Woche im Vorjahr zieht den
  --    Preis nach oben, nie nach unten, hoechstens um anker_max_pct.
  add column if not exists anker_enabled boolean not null default false,
  add column if not exists anker_max_pct numeric(6, 2) not null default 20,
  -- 7. DP wirkt nur auf DIESEN Ratenplan (Hotel: BAR ja, B&B nein). NULL = alle.
  add column if not exists rate_plan_id uuid references public.rate_plans (id)
    on delete set null,
  -- 5. Aufschlaege fuer Feiertage/Schulferien; 0 = aus. Quellmaerkte = Laender,
  --    deren Ferien zusaetzlich zum Objektland zaehlen (Daenemark: DE, NL).
  add column if not exists feiertag_uplift_pct numeric(6, 2) not null default 0,
  add column if not exists ferien_uplift_pct numeric(6, 2) not null default 0,
  add column if not exists quellmaerkte text[] not null default '{}';

-- 4. Basispreis aus dem Markt: dritter Modus neben Grundpreis und manuell.
alter table public.dp_settings drop constraint if exists dp_settings_base_mode_check;
alter table public.dp_settings
  add constraint dp_settings_base_mode_check
  check (base_mode in ('data_driven', 'market', 'manual'));

comment on column public.dp_settings.base_mode is
  'data_driven = Grundpreis des Ratenplans, market = Median der Umgebung '
  '(markt_beobachtung, je Tag; ohne Marktwert Grundpreis), manual = Handwert.';

-- 8. Grenzen, die bisher nur Pydantic kannte — deckungsgleich mit schemas.py.
--    Live geprueft am 05.09.2026: alle Bestandswerte liegen innerhalb.
alter table public.dp_settings
  drop constraint if exists dp_settings_weekend_uplift_pct_check,
  drop constraint if exists dp_settings_orphan_gap_discount_pct_check,
  drop constraint if exists dp_settings_occupancy_sensitivity_check,
  drop constraint if exists dp_settings_market_sensitivity_check,
  drop constraint if exists dp_settings_market_max_adjust_pct_check,
  drop constraint if exists dp_settings_weather_max_adjust_pct_check,
  drop constraint if exists dp_settings_occupancy_discount_cap_pct_check,
  drop constraint if exists dp_settings_occupancy_premium_cap_pct_check,
  drop constraint if exists dp_settings_freigabe_ab_tagen_check,
  drop constraint if exists dp_settings_anker_max_pct_check,
  drop constraint if exists dp_settings_feiertag_uplift_pct_check,
  drop constraint if exists dp_settings_ferien_uplift_pct_check;

alter table public.dp_settings
  add constraint dp_settings_weekend_uplift_pct_check
    check (weekend_uplift_pct between 0 and 200),
  add constraint dp_settings_orphan_gap_discount_pct_check
    check (orphan_gap_discount_pct between 0 and 100),
  add constraint dp_settings_occupancy_sensitivity_check
    check (occupancy_sensitivity between 0 and 100),
  add constraint dp_settings_market_sensitivity_check
    check (market_sensitivity between 0 and 100),
  add constraint dp_settings_market_max_adjust_pct_check
    check (market_max_adjust_pct between 0 and 100),
  add constraint dp_settings_weather_max_adjust_pct_check
    check (weather_max_adjust_pct between 0 and 100),
  add constraint dp_settings_occupancy_discount_cap_pct_check
    check (occupancy_discount_cap_pct between 0 and 100),
  add constraint dp_settings_occupancy_premium_cap_pct_check
    check (occupancy_premium_cap_pct between 0 and 100),
  add constraint dp_settings_freigabe_ab_tagen_check
    check (freigabe_ab_tagen is null or freigabe_ab_tagen between 0 and 730),
  add constraint dp_settings_anker_max_pct_check
    check (anker_max_pct between 0 and 100),
  add constraint dp_settings_feiertag_uplift_pct_check
    check (feiertag_uplift_pct between 0 and 300),
  add constraint dp_settings_ferien_uplift_pct_check
    check (ferien_uplift_pct between 0 and 300);

-- Realtime: der Verlauf und die Grenzen speisen die Detailseite live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'dp_verlauf'
  ) then
    alter publication supabase_realtime add table public.dp_verlauf;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'dp_preisgrenzen'
  ) then
    alter publication supabase_realtime add table public.dp_preisgrenzen;
  end if;
end $$;
