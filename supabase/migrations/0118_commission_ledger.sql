-- 0118_commission_ledger.sql — Provisions-Ledger für externe OTA-Buchungen
--
-- Preisliste Abschnitt 2: für Buchungen über EXTERNE Kanäle (Booking/Airbnb/Vrbo)
-- berechnet myNextDays 1 % (0,5 % ab 101 Objekten) vom Buchungsumsatz. Da wir bei
-- OTA-Buchungen den Gast NICHT kassieren (die OTA zahlt den Vermieter direkt),
-- läuft diese Provision NACHGELAGERT: pro OTA-Buchung eine Ledger-Zeile, am
-- Monatsende als EIN Stripe-Invoice-Item auf das Tenant-Abo gebucht.
--
-- ABGRENZUNG: Die Portal-Provision (8 %) wird SOFORT beim Gast-Charge einbehalten
-- (payments.application_fee) und kommt NICHT hier rein. Die bestehende
-- commissions-Tabelle (0006, ungenutzt, Jobmarkt-Gerüst) ist zu dünn (kein Typ/
-- Kanal/Periode) → eigene Tabelle.

-- =========================================================================
-- commission_ledger — eine Zeile pro provisionspflichtiger OTA-Buchung
-- =========================================================================
create table if not exists public.commission_ledger (
    id                     uuid primary key default gen_random_uuid(),
    tenant_id              uuid not null
                             references public.tenants(id) on delete cascade,
    reservation_id         uuid not null
                             references public.reservations(id) on delete cascade,
    channel                text not null,        -- booking|airbnb|vrbo
    -- Buchungsumsatz + Satz + errechnete Provision, alles in der Buchungswährung.
    -- Währung MUSS aus der Buchung kommen (nie EUR hardcoden, Wurzel 4).
    currency               text not null,
    gross_amount           numeric(12, 2) not null check (gross_amount >= 0),
    rate                   numeric(5, 4) not null check (rate >= 0 and rate <= 1),
    commission_amount      numeric(12, 2) not null check (commission_amount >= 0),
    status                 public.commission_status not null default 'pending',
    -- Abrechnungsperiode (YYYY-MM), gesetzt beim Fakturieren; NULL solange pending.
    period                 text,
    stripe_invoice_item_id text,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now(),
    -- Genau EINE Provisionszeile pro Buchung — Idempotenz-Backstop (Wurzel 2):
    -- Webhook-Redelivery / OTA-Resync erzeugt keine zweite Zeile.
    unique (reservation_id)
);

create index commission_ledger_tenant_idx
    on public.commission_ledger (tenant_id);
-- Der Monats-Worker sucht die offenen Zeilen eines Tenants → gezielter Index.
create index commission_ledger_tenant_status_idx
    on public.commission_ledger (tenant_id, status);

create trigger trg_commission_ledger_updated
    before update on public.commission_ledger
    for each row execute function public.set_updated_at();

-- =========================================================================
-- RLS — tenant-scoped Lesezugriff (Schreiben nur serverseitig via service_role)
-- =========================================================================
alter table public.commission_ledger enable row level security;

create policy commission_ledger_select on public.commission_ledger
    for select
    using (tenant_id = public.current_tenant_id());

-- =========================================================================
-- Realtime — speist die Provisions-/Abrechnungs-Ansicht im Dashboard
-- =========================================================================
alter table public.commission_ledger replica identity full;
alter publication supabase_realtime add table public.commission_ledger;

comment on table public.commission_ledger is
  'Provisions-Ledger für externe OTA-Buchungen (1 %/0,5 %). Nachgelagerte '
  'Monatsabrechnung als Stripe-Invoice-Item aufs Tenant-Abo. NICHT die '
  'Portal-Provision (die läuft sofort über payments.application_fee).';
comment on column public.commission_ledger.rate is
  '0.01 = 1 %% (bis 100 Objekte), 0.005 = 0,5 %% (ab 101 Objekten).';
