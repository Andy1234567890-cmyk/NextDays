-- 0034_channex_tax_map.sql — Mapping lokaler Steuern → Channex taxes/tax_sets
--
-- Der Preise-Tab erfasst Steuern (type_attributes.pricing.taxes). Channex
-- modelliert Steuern als eigene `taxes` + ein `tax_set` (per property), das per
-- tax_set_id am Rate-Plan hängt. Dieses Mapping hält die Channex-IDs idempotent,
-- damit wiederholter Sync update statt Duplikat macht.

create table public.channex_tax_map (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    property_id        uuid not null references public.properties (id) on delete cascade,
    local_tax_id       text not null,          -- pricing.taxes[].id (lokale UI-ID)
    channex_tax_id     text not null,
    channex_tax_set_id text,                    -- gesetzt, sobald im Set
    deleted_at         timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    unique (property_id, local_tax_id)
);

create index channex_tax_map_tenant_idx on public.channex_tax_map (tenant_id);
create index channex_tax_map_property_idx on public.channex_tax_map (property_id);
