-- 0029_tenant_onboarding.sql
-- Onboarding-Fortschritt pro Tenant (Hotel). Das Dashboard zeigt den Setup-
-- Assistenten so lange, bis 'completed' true ist.
--
-- NextDays-Muster: 1:1 zu tenants, RLS via current_tenant_id(), set_updated_at.

create table if not exists public.tenant_onboarding (
    tenant_id          uuid primary key references public.tenants(id) on delete cascade,
    -- Schritt-Flags (true = erledigt):
    has_ota            boolean,                        -- null=ungefragt, true/false=Antwort
    selected_portals   jsonb not null default '[]'::jsonb,  -- ["BookingCom", ...]
    object_created     boolean not null default false,
    price_set          boolean not null default false,
    channels_done      boolean not null default false,
    completed          boolean not null default false,
    completed_at       timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create trigger trg_tenant_onboarding_updated
    before update on public.tenant_onboarding
    for each row execute function public.set_updated_at();

alter table public.tenant_onboarding enable row level security;

create policy tenant_onboarding_tenant on public.tenant_onboarding
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
