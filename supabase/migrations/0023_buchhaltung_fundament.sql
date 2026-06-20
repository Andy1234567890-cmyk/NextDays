-- 0023_buchhaltung_fundament.sql
-- Buchhaltungs-Fundament (aus Taskilo übernommen, auf NextDays-Mandanten
-- vereinheitlicht: company_id → tenant_id, RLS via current_tenant_id()).
-- Schritt 1: Billing-Profil am Tenant + Kunden + Rechnungen + Positionen.
-- Weitere Module (Steuer, E-Rechnung, DATEV, GoBD, Bank) folgen in 0024+.

-- ---------------------------------------------------------------------------
-- 1) Tenant-Billing-Profil (1:1 zu tenants) — firmenspezifische Stammdaten,
--    die Taskilo an `companies` hängt (USt-IdNr., IBAN, Kleinunternehmer …).
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_billing_profile (
    tenant_id          uuid primary key references public.tenants(id) on delete cascade,
    legal_name         text,
    tax_number         text,                       -- Steuernummer
    vat_id             text,                       -- USt-IdNr.
    is_kleinunternehmer boolean not null default false,  -- §19 UStG
    default_tax_rate   numeric(5,2) not null default 19.00,
    iban               text,
    bic                text,
    bank_name          text,
    account_holder     text,
    e_invoice_format   text not null default 'none',  -- none|zugferd|xrechnung
    leitweg_id         text,                       -- für Behörden (XRechnung)
    default_payment_days integer not null default 14,
    default_payment_text text,
    skonto_enabled     boolean not null default false,
    skonto_percent     numeric(5,2),
    skonto_days        integer,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) Kunden/Lieferanten (Debitoren/Kreditoren) — tenant-scoped.
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants(id) on delete cascade,
    customer_number    text,
    name               text not null,
    email              text,
    phone              text,
    vat_id             text,
    tax_number         text,
    is_supplier        boolean not null default false,
    customer_type      text not null default 'business',  -- private|business
    address            jsonb not null default '{}'::jsonb,
    default_payment_days integer,
    credit_limit       numeric(12,2),
    notes              text,
    deleted_at         timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists customers_tenant_idx on public.customers(tenant_id);

-- ---------------------------------------------------------------------------
-- 3) Rechnungen — tenant-scoped. GoBD-Felder (Lock) + E-Rechnung-Felder
--    vorbereitet; Storno via Selbstreferenz.
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants(id) on delete cascade,
    customer_id        uuid references public.customers(id) on delete set null,
    invoice_number     text,
    invoice_prefix     text,
    invoice_sequence   integer,
    invoice_year       integer,
    invoice_type       text not null default 'invoice',   -- invoice|credit_note|storno
    status             text not null default 'draft',     -- draft|sent|paid|overdue|cancelled
    issue_date         date,
    due_date           date,
    currency           text not null default 'EUR',
    net_amount         numeric(12,2) not null default 0,
    tax_amount         numeric(12,2) not null default 0,
    gross_amount       numeric(12,2) not null default 0,
    paid_amount        numeric(12,2) not null default 0,
    paid_at            timestamptz,
    tax_rate           numeric(5,2),
    tax_rule           text,                              -- DE_TAXABLE, EU_REVERSE_18B …
    is_kleinunternehmer boolean not null default false,
    kleinunternehmer_text text,
    head_text          text,
    footer_text        text,
    notes              text,
    -- E-Rechnung
    e_invoice_format   text,                              -- zugferd|xrechnung
    e_invoice_xml      text,
    leitweg_id         text,
    -- Storno
    original_invoice_id uuid references public.invoices(id) on delete set null,
    storno_reason      text,
    -- GoBD
    gobd_status        text not null default 'open',      -- open|locked
    is_locked          boolean not null default false,
    locked_at          timestamptz,
    locked_by          uuid,
    pdf_url            text,
    deleted_at         timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists invoices_tenant_idx on public.invoices(tenant_id);
create index if not exists invoices_customer_idx on public.invoices(customer_id);

-- ---------------------------------------------------------------------------
-- 4) Rechnungspositionen.
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_line_items (
    id                 uuid primary key default gen_random_uuid(),
    invoice_id         uuid not null references public.invoices(id) on delete cascade,
    position           integer not null default 1,
    description        text not null,
    quantity           numeric(12,3) not null default 1,
    unit               text,
    unit_price         numeric(12,2) not null default 0,
    tax_rate           numeric(5,2) not null default 19.00,
    discount_percent   numeric(5,2) not null default 0,
    net_amount         numeric(12,2) not null default 0,
    tax_amount         numeric(12,2) not null default 0,
    gross_amount       numeric(12,2) not null default 0,
    sku                text,
    created_at         timestamptz not null default now()
);
create index if not exists invoice_line_items_invoice_idx on public.invoice_line_items(invoice_id);

-- ---------------------------------------------------------------------------
-- 5) updated_at-Trigger (NextDays-Konvention: set_updated_at).
-- ---------------------------------------------------------------------------
create trigger trg_tenant_billing_profile_updated
    before update on public.tenant_billing_profile
    for each row execute function public.set_updated_at();
create trigger trg_customers_updated
    before update on public.customers
    for each row execute function public.set_updated_at();
create trigger trg_invoices_updated
    before update on public.invoices
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6) RLS — tenant-Isolation (NextDays-Muster: tenant_id = current_tenant_id()).
--    invoice_line_items über die Rechnung abgesichert.
-- ---------------------------------------------------------------------------
alter table public.tenant_billing_profile enable row level security;
alter table public.customers              enable row level security;
alter table public.invoices               enable row level security;
alter table public.invoice_line_items     enable row level security;

create policy tenant_billing_profile_tenant on public.tenant_billing_profile
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy customers_tenant on public.customers
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy invoices_tenant on public.invoices
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy invoice_line_items_tenant on public.invoice_line_items
    for all
    using (exists (
        select 1 from public.invoices i
        where i.id = invoice_line_items.invoice_id
          and i.tenant_id = public.current_tenant_id()
    ))
    with check (exists (
        select 1 from public.invoices i
        where i.id = invoice_line_items.invoice_id
          and i.tenant_id = public.current_tenant_id()
    ));
