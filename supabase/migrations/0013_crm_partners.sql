-- 0013_crm_partners.sql — Lastenheft §2.6: Eigentümer-Akquise (CRM) + Partner/Deals

create table public.leads (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants (id) on delete cascade,
    name          text not null,
    address       text,
    phone         text,
    email         text,
    lead_source   text,                       -- Marketing-Attribution (Dropdown)
    object_address text,                       -- potenzielles Objekt
    object_sqm    integer,
    object_max_guests integer,
    notes         text,                        -- Fortschritts-/Gesprächsnotizen
    status        text not null default 'new',
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index leads_tenant_id_idx on public.leads (tenant_id);

create type public.discount_kind as enum ('percent', 'fixed');

create table public.partners (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants (id) on delete cascade,
    name          text not null,              -- z.B. "Fårup Sommerland"
    address       text,
    contact_name  text,
    contact_info  text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index partners_tenant_id_idx on public.partners (tenant_id);

create table public.deals (
    id            uuid primary key default gen_random_uuid(),
    partner_id    uuid not null references public.partners (id) on delete cascade,
    discount_kind public.discount_kind not null,
    discount_value numeric(12, 2) not null check (discount_value >= 0),
    currency      text,                        -- nur bei discount_kind = 'fixed'
    discount_code text,
    qr_code_path  text,                        -- Supabase Storage Key
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index deals_partner_id_idx on public.deals (partner_id);
