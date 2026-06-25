-- 0064_owner_statements.sql — Owner-Statements (Auszahlungsabrechnung) + Expenses
--
-- Spiegelt die Hostaway-„Owner Statements": je Eigentümer + Zeitraum eine
-- Abrechnung mit Snapshot der Property-Manager- und Owner-Stammdaten, den
-- Summen (Total Price/Payout, Owner-/PM-Payout) und einem Status (draft/finalized).
-- Dazu Expenses & Extras: Konzept/Datum/Kategorie, zuweisbar an Listing UND/ODER
-- Reservierung UND/ODER Owner, Betrag (±), Anhang, aus Owner-Sicht ausblendbar.
--
-- Auszahlungsformel (Teil B, serverseitig in Decimal):
--   Total Price   = Σ reservations.total_amount (im Zeitraum, gefiltert)
--   Total Payout  = Σ (total_amount − channel_fee)        [channel_fee aus 0063]
--   Owner Payout  = (Total Payout − owner-zugeordnete Expenses) × (1 − commission)
--   PM Payout     = Total Payout − Owner Payout
--   Grand total   = Rental Revenue − Expenses, „Deduct percentage" = Provision.

create table public.owner_statements (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants (id) on delete cascade,
    owner_id        uuid not null references public.owners (id) on delete cascade,
    period_from     date not null,
    period_to       date not null,
    -- Basis der Zeitraum-Filterung: nach Check-in oder Check-out.
    basis           text not null default 'check_in'
        check (basis in ('check_in', 'check_out')),
    -- Einbezogene Reservierungs-Status (Mehrfach, Hostaway-Filter).
    reservation_statuses text[] not null default '{}',
    status          text not null default 'draft'
        check (status in ('draft', 'finalized')),
    -- Snapshot Property-Manager (Statement-Kopf links).
    pm_name         text,
    pm_email        text,
    pm_phone        text,
    pm_address      text,
    pm_tax_id       text,
    pm_logo_url     text,
    -- Snapshot Property-Owner (Statement-Kopf rechts).
    owner_name      text,
    owner_email     text,
    owner_phone     text,
    owner_address   text,
    owner_tax_id    text,
    invoice_number  text,
    notes           text,
    -- Provision (Deduct percentage) zum Zeitpunkt der Erstellung.
    commission_pct  numeric(5, 2) not null default 0
        check (commission_pct >= 0 and commission_pct <= 100),
    -- Summen-Snapshot (bei Finalisierung eingefroren; Decimal-Genauigkeit).
    total_price     numeric(14, 2) not null default 0,
    total_payout    numeric(14, 2) not null default 0,
    expenses_total  numeric(14, 2) not null default 0,
    owner_payout    numeric(14, 2) not null default 0,
    pm_payout       numeric(14, 2) not null default 0,
    currency        text not null default 'EUR',
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    check (period_to >= period_from)
);

create index owner_statements_tenant_idx on public.owner_statements (tenant_id);
create index owner_statements_owner_idx on public.owner_statements (owner_id);
create index owner_statements_period_idx
    on public.owner_statements (owner_id, period_from, period_to);

create trigger set_updated_at before update on public.owner_statements
    for each row execute function public.set_updated_at();

create table public.owner_expenses (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants (id) on delete cascade,
    -- Optional an ein konkretes Statement gebunden; sonst frei/auto-zuordenbar.
    statement_id    uuid references public.owner_statements (id) on delete set null,
    concept         text not null,
    date            date not null,
    category        text,
    -- Zuweisung an Listing UND/ODER Reservierung UND/ODER Owner (alle optional).
    listing_id      uuid references public.properties (id) on delete set null,
    reservation_id  uuid references public.reservations (id) on delete set null,
    owner_id        uuid references public.owners (id) on delete set null,
    -- Betrag mit Vorzeichen (negativ = Ausgabe, positiv = Extra/Gutschrift).
    amount          numeric(14, 2) not null,
    attachment_url  text,
    -- Interne Zeile aus Owner-Sicht ausblenden (Portal/Statement-Owner-View).
    hidden_from_owner boolean not null default false,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index owner_expenses_tenant_idx on public.owner_expenses (tenant_id);
create index owner_expenses_statement_idx on public.owner_expenses (statement_id);
create index owner_expenses_owner_idx on public.owner_expenses (owner_id);
create index owner_expenses_listing_idx on public.owner_expenses (listing_id);
create index owner_expenses_date_idx on public.owner_expenses (date);

create trigger set_updated_at before update on public.owner_expenses
    for each row execute function public.set_updated_at();

-- == RLS: beide tenant-direkt (Agentur verwaltet; Owner-Sicht läuft über die
--    maskierte Portal-API, nicht über direkte Tabellen-Reads). ================
alter table public.owner_statements enable row level security;
create policy owner_statements_tenant on public.owner_statements
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.owner_expenses enable row level security;
create policy owner_expenses_tenant on public.owner_expenses
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
