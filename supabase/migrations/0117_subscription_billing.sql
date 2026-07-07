-- 0117_subscription_billing.sql — Abo-Billing (myNextDays kassiert vom Tenant)
--
-- ABGRENZUNG: Das ist NICHT der Gast->Vermieter-Geldfluss (features/payments,
-- Stripe Connect). Hier zahlt der TENANT an myNextDays: Grundgebuehr +
-- Objekt-Staffel (graduated) + Zusatzmodule. Preise liegen in Stripe
-- (seed_stripe_prices.py). Diese Tabellen sind nur der lokale Spiegel/Klebstoff.
--
-- Zwei Tabellen:
--   * tenant_subscription        — 1:1 pro Tenant, Stripe-Customer/Subscription,
--                                  Status, Periodenende, aktuelle Objektzahl.
--   * tenant_module_entitlement  — welches Zusatzmodul (3/4/5/6) fuer welchen
--                                  Tenant aktiv ist (steuert Feature-Gates).
--
-- RLS Pflicht (jede neue public-Tabelle) — Backstop gegen die pauschalen
-- anon-Grants. Realtime Pflicht — beide speisen die /konto-Billing-UI.

-- =========================================================================
-- 1. Abo-Status-Enum (spiegelt Stripe-Subscription-Status)
-- =========================================================================
do $$
begin
  create type public.subscription_status as enum (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete',
    'incomplete_expired', 'paused'
  );
exception when duplicate_object then null;
end $$;

-- =========================================================================
-- 2. tenant_subscription — ein Abo pro Tenant
-- =========================================================================
create table if not exists public.tenant_subscription (
    tenant_id               uuid primary key
                              references public.tenants(id) on delete cascade,
    stripe_customer_id      text unique,       -- cus_...
    stripe_subscription_id  text unique,       -- sub_... (NULL bis aktiviert)
    status                  public.subscription_status,  -- NULL = noch kein Abo
    -- Objektzahl, die zuletzt als graduated-quantity an Stripe gemeldet wurde.
    -- Quelle: COUNT(properties WHERE status='active'). Gegenzustand pflegen
    -- (Wurzel 1): Objekt aktiv/inaktiv -> quantity nachziehen.
    reported_property_count integer not null default 0
                              check (reported_property_count >= 0),
    current_period_end      timestamptz,
    cancel_at_period_end    boolean not null default false,
    -- Provisions-Staffel wird aus der Objektzahl abgeleitet, NICHT hier
    -- hardgecodet (Wurzel 4). Nur der zuletzt berechnete Satz als Cache/Audit.
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create trigger trg_tenant_subscription_updated
    before update on public.tenant_subscription
    for each row execute function public.set_updated_at();

-- =========================================================================
-- 3. tenant_module_entitlement — gebuchte Zusatzmodule pro Tenant
-- =========================================================================
-- module_key: stabiler interner Schluessel, deckt sich mit seed_stripe_prices.py
--   ('modul3_buchhaltung' | 'modul4_mitarbeiter' | 'modul5_jobmarkt' |
--    'modul6_hotel'). Bewusst text + CHECK statt enum, damit neue Module ohne
--   Enum-Migration dazukommen koennen.
create table if not exists public.tenant_module_entitlement (
    id                     uuid primary key default gen_random_uuid(),
    tenant_id              uuid not null
                             references public.tenants(id) on delete cascade,
    module_key             text not null check (module_key in (
                             'modul3_buchhaltung', 'modul4_mitarbeiter',
                             'modul5_jobmarkt', 'modul6_hotel')),
    -- Welcher Stripe-Subscription-Item diesen Zugang traegt (fuer Kuendigung).
    stripe_subscription_item_id text,
    -- Aktiv-Fenster: active_until NULL = laeuft; gesetzt = bis dahin gueltig
    -- (gekuendigt, aber Periode laeuft noch). So bleibt der Zugang bis
    -- Periodenende erhalten (Gegenzustand, Wurzel 1).
    active                 boolean not null default true,
    active_until           timestamptz,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now(),
    -- Ein Modul nur EINMAL pro Tenant (Idempotenz-Backstop, Wurzel 2).
    unique (tenant_id, module_key)
);

create index tenant_module_entitlement_tenant_idx
    on public.tenant_module_entitlement (tenant_id);

create trigger trg_tenant_module_entitlement_updated
    before update on public.tenant_module_entitlement
    for each row execute function public.set_updated_at();

-- =========================================================================
-- 4. RLS — tenant-scoped (Backstop gegen anon-Grants)
-- =========================================================================
alter table public.tenant_subscription        enable row level security;
alter table public.tenant_module_entitlement  enable row level security;

-- Lesen: nur der eigene Tenant. Schreiben passiert serverseitig ueber die
-- service_role (umgeht RLS) im subscriptions-Service — die API scopet dort
-- explizit auf den Tenant (Wurzel 3). Fuer normale Nutzer NUR SELECT des
-- eigenen Tenants; kein direktes Schreiben (Abo-Aenderung laeuft ueber Stripe).
create policy tenant_subscription_select on public.tenant_subscription
    for select
    using (tenant_id = public.current_tenant_id());

create policy tenant_module_entitlement_select on public.tenant_module_entitlement
    for select
    using (tenant_id = public.current_tenant_id());

-- =========================================================================
-- 5. Realtime — beide Tabellen speisen die /konto-Billing-UI
-- =========================================================================
alter table public.tenant_subscription        replica identity full;
alter table public.tenant_module_entitlement  replica identity full;
alter publication supabase_realtime add table public.tenant_subscription;
alter publication supabase_realtime add table public.tenant_module_entitlement;

comment on table public.tenant_subscription is
  'Abo eines Tenants bei myNextDays (Stripe Subscription-Spiegel). Grundgebuehr '
  '+ graduated Objekt-Staffel. NICHT der Gast->Vermieter-Zahlfluss.';
comment on column public.tenant_subscription.reported_property_count is
  'Zuletzt an Stripe gemeldete quantity = COUNT(properties status=active).';
comment on table public.tenant_module_entitlement is
  'Gebuchte Zusatzmodule (3/4/5/6) pro Tenant; steuert Feature-Gates serverseitig.';
