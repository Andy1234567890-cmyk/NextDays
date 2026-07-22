-- 0180_tenant_account_type.sql — Zwei Betriebsmodelle: PMS/CM-Abo vs. Plattform-Fee
--
-- myNextDays hat ZWEI Wege, wie ein Anbieter Objekte einstellt:
--   • PMS/CM (apps/web): voller Channel-Manager + Dashboard, ABO-Preis.
--   • Plattform (plattform/): schlanker Marktplatz-Zugang, KEIN Abo — stattdessen
--     eine PROVISION je Buchung (Standard 8 %), die an myNextDays geht.
--
-- Damit die Abrechnung weiß, welches Modell gilt, bekommt jeder Tenant einen
-- account_type. Der Plattform-Gastgeber registriert sich über den eigenen Flow
-- auf plattform/ (setzt account_type='marketplace'); der PMS-Betrieb bleibt 'pms'.
--
-- Die Fee ist tenant-genau überschreibbar (Sonderkonditionen), Default 800 bps
-- (= 8,00 %). bps statt Prozent-Float → exakte Ganzzahl-Arithmetik bei Geld.

do $$
begin
    if not exists (select 1 from pg_type where typname = 'account_type') then
        create type public.account_type as enum ('pms', 'marketplace');
    end if;
end $$;

alter table public.tenants
    add column if not exists account_type public.account_type not null default 'pms';

-- Plattform-Provision in Basispunkten (800 = 8,00 %). Nur relevant für
-- account_type='marketplace'; für 'pms' ignoriert (dort greift das Abo).
-- CHECK: 0..10000 bps (0–100 %), kein Fantasie-Wert.
alter table public.tenants
    add column if not exists platform_fee_bps integer not null default 800
        check (platform_fee_bps between 0 and 10000);

comment on column public.tenants.account_type is
  'pms = Channel-Manager/Dashboard-Abo (apps/web); marketplace = Plattform-'
  'Gastgeber ohne Abo, zahlt platform_fee_bps je Buchung (plattform/).';
comment on column public.tenants.platform_fee_bps is
  'Plattform-Provision in Basispunkten (800 = 8 %). Nur für account_type=marketplace.';

-- tenants ist bereits RLS-geschützt (0002/spätere Härtung); account_type/fee sind
-- keine Secrets, aber Schreibrecht bleibt serverseitig (service_role) — der Fee-
-- Satz darf NICHT vom Client änderbar sein (sonst setzt sich ein Gastgeber die
-- Provision auf 0). Kein zusätzliches GRANT hier: das bestehende tenants-Regime
-- (nur service_role schreibt account-relevante Felder) gilt weiter.
