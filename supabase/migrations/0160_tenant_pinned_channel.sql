-- 0160_tenant_pinned_channel.sql
-- Welche OTA-Kanäle sich ein Tenant in die Channel-Manager-Sidebar geholt hat.
--
-- Die Portal-Liste (52 Kanäle im Channex-Katalog) ist zu lang für eine feste
-- Sidebar. Die 3 wichtigsten (Booking, Airbnb, eigene Plattform) stehen fix;
-- alle weiteren wählt der Tenant über ein Dropdown „Kanal hinzufügen" — der
-- gewählte Kanal wird hier gemerkt und erscheint danach als eigene Zeile.
--
-- Nur der Server (service_role) schreibt (über den channel_manager-Slice); der
-- Client liest tenant-scoped. Sicherheit nach Wurzel 6: RLS + tenant-Policy
-- reicht NICHT allein — zusätzlich das pauschale Schreib-GRANT für anon/
-- authenticated entziehen (sonst schreibt jeder eingeloggte Client direkt per
-- PostgREST). SELECT bleibt tenant-scoped erlaubt (harmlose Sichtbarkeits-Info).

create table if not exists public.tenant_pinned_channel (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants(id) on delete cascade,
    portal_code text not null,                 -- Channex-Channel-Code (z.B. Expedia)
    created_at  timestamptz not null default now()
);

create index if not exists tenant_pinned_channel_tenant_idx
    on public.tenant_pinned_channel(tenant_id);
-- Pro Tenant genau einmal je Kanal (idempotentes Pinnen via on conflict).
create unique index if not exists tenant_pinned_channel_tenant_portal_uidx
    on public.tenant_pinned_channel(tenant_id, portal_code);

alter table public.tenant_pinned_channel enable row level security;

-- Tenant-Isolation (Basis-Policy).
create policy tenant_pinned_channel_tenant on public.tenant_pinned_channel
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: Schreibpfad gehört ausschließlich dem Server. Das pauschale
-- INSERT/UPDATE/DELETE-GRANT für die öffentlichen Rollen entziehen — sonst
-- könnte ein eingeloggter Client per curl /rest/v1/tenant_pinned_channel
-- direkt schreiben (RLS erlaubt es tenant-weit). Lesen bleibt erlaubt.
revoke insert, update, delete on public.tenant_pinned_channel from anon;
revoke insert, update, delete on public.tenant_pinned_channel from authenticated;
