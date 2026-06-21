-- 0028_channex_groups.sql
-- Channel-Manager: je Tenant eine Channex-Group (Whitelabel-Konto-Modell).
--
-- Modell: EIN Whitelabel-Konto (unser API-Key), darin pro Hotel/Tenant eine
-- eigene Group. Properties des Tenants werden dieser Group zugeordnet → saubere
-- Trennung der Hotels innerhalb des einen Kontos. 1:1 Tenant ↔ Group.
--
-- NextDays-Muster: tenant-scoped, RLS via current_tenant_id(), set_updated_at.

create table if not exists public.channex_group_map (
    tenant_id          uuid primary key references public.tenants(id) on delete cascade,
    channex_group_id   text not null,                 -- Group-UUID bei Channex
    title              text,                           -- Anzeigename (Cache)
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create unique index if not exists channex_group_map_channex_uidx
    on public.channex_group_map(channex_group_id);

create trigger trg_channex_group_map_updated
    before update on public.channex_group_map
    for each row execute function public.set_updated_at();

alter table public.channex_group_map enable row level security;

create policy channex_group_map_tenant on public.channex_group_map
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
