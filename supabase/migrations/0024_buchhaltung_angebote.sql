-- 0024_buchhaltung_angebote.sql
-- Angebote (quotes) + Positionen, tenant-vereinheitlicht (aus Taskilo).
-- Struktur analog invoices; Konvertierung zu Rechnung via converted_invoice_id.

create table if not exists public.quotes (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants(id) on delete cascade,
    customer_id        uuid references public.customers(id) on delete set null,
    quote_number       text,
    quote_prefix       text,
    quote_sequence     integer,
    quote_year         integer,
    status             text not null default 'draft',   -- draft|sent|accepted|rejected|expired|converted
    issue_date         date,
    valid_until        date,
    currency           text not null default 'EUR',
    net_amount         numeric(12,2) not null default 0,
    tax_amount         numeric(12,2) not null default 0,
    gross_amount       numeric(12,2) not null default 0,
    tax_rule           text,
    head_text          text,
    footer_text        text,
    notes              text,
    converted_invoice_id uuid references public.invoices(id) on delete set null,
    pdf_url            text,
    deleted_at         timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists quotes_tenant_idx on public.quotes(tenant_id);
create index if not exists quotes_customer_idx on public.quotes(customer_id);
create index if not exists quotes_converted_idx on public.quotes(converted_invoice_id);

create table if not exists public.quote_line_items (
    id                 uuid primary key default gen_random_uuid(),
    quote_id           uuid not null references public.quotes(id) on delete cascade,
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
create index if not exists quote_line_items_quote_idx on public.quote_line_items(quote_id);

create trigger trg_quotes_updated
    before update on public.quotes
    for each row execute function public.set_updated_at();

alter table public.quotes            enable row level security;
alter table public.quote_line_items  enable row level security;

create policy quotes_tenant on public.quotes
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy quote_line_items_tenant on public.quote_line_items
    for all using (exists (
        select 1 from public.quotes q
        where q.id = quote_line_items.quote_id
          and q.tenant_id = public.current_tenant_id()))
    with check (exists (
        select 1 from public.quotes q
        where q.id = quote_line_items.quote_id
          and q.tenant_id = public.current_tenant_id()));
