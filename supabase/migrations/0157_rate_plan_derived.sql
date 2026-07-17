-- 0157_rate_plan_derived.sql — abgeleitete Rate-Pläne (SiteMinder-Modell)
--
-- Ein Rate-Plan ist entweder MANUAL (eigener Grundpreis + Datumspreise) oder
-- DERIVED (Preis = parent_effektiv + offset_amount, dann × (1 + offset_percent/100)).
-- Die Ableitung rechnet AUSSCHLIESSLICH lokal im Preis-Resolver; die Channex-
-- Rate-Plans bleiben alle rate_mode=manual (SiteMinder-PMS-Regel: nie doppelt
-- ableiten). Plan: docs/rate-plan-derived-plan.md.
--
-- KEINE Kaskade: der Parent MUSS manual sein (im Service erzwungen). Kind erbt
-- die Parent-Währung. Nur Preise werden abgeleitet — Min-Stay/Restriktionen/
-- Stop-Sell bleiben pro Plan eigenständig (0150/0152/0153).

alter table public.rate_plans
    add column if not exists rate_mode text not null default 'manual',
    add column if not exists derived_from_rate_plan_id uuid,
    add column if not exists offset_amount numeric(10, 2),
    add column if not exists offset_percent numeric(7, 3);

-- Selbstreferenz mit on delete restrict: ein Parent mit Kindern kann nicht
-- gelöscht werden (DB-Backstop; der Service antwortet zusätzlich mit 409).
alter table public.rate_plans
    drop constraint if exists rate_plans_derived_from_fk;
alter table public.rate_plans
    add constraint rate_plans_derived_from_fk
    foreign key (derived_from_rate_plan_id)
    references public.rate_plans(id) on delete restrict;

alter table public.rate_plans
    drop constraint if exists rate_plans_rate_mode_check;
alter table public.rate_plans
    add constraint rate_plans_rate_mode_check
    check (rate_mode in ('manual', 'derived'));

-- Konsistenz: manual → keine derived-Felder; derived → Parent gesetzt, nicht
-- selbst-referenzierend. (Gleiches Objekt + Parent-ist-manual wird im Service
-- geprüft — per CHECK nicht ausdrückbar, da tabellenübergreifend.)
alter table public.rate_plans
    drop constraint if exists rate_plans_derived_consistent;
alter table public.rate_plans
    add constraint rate_plans_derived_consistent check (
        (rate_mode = 'manual'
            and derived_from_rate_plan_id is null
            and offset_amount is null
            and offset_percent is null)
        or
        (rate_mode = 'derived'
            and derived_from_rate_plan_id is not null
            and derived_from_rate_plan_id <> id)
    );

-- Kind-Pläne schnell zu einem Parent finden (Propagations-Enqueue bei
-- Parent-Preisänderung + Lösch-Guard).
create index if not exists rate_plans_derived_from_idx
    on public.rate_plans (derived_from_rate_plan_id)
    where derived_from_rate_plan_id is not null;
