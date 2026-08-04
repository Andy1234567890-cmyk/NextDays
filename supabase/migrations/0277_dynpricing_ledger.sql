-- 0277 — Ledger für das Modul „Dynamische Preise" (0,5 % vom Buchungsumsatz).
--
-- WARUM EIN LEDGER UND KEIN STRIPE-BILLING-METER:
-- Ein Meter ist eine währungslose Zahl. Er summiert stumpf, was gemeldet wird —
-- eine 400-EUR- und eine 3.000-DKK-Buchung ergäben eine sinnlose Gesamtsumme
-- mit implizitem Kurs 1:1. myNextDays verkauft in 24 Ländern, Buchungen fallen
-- real in EUR/DKK/GBP/USD an (heute schon drei Währungen in `reservations`).
-- Die Währung muss deshalb JE BUCHUNG mitgeführt werden (Wurzel 4: nie ein
-- erfundener Kurs, nie ein plausibler Ersatzwert).
--
-- Gleiches Muster wie `commission_ledger` (OTA-Provision): eine Zeile je
-- Buchung, monatlich als Stripe-Invoice-Item fakturiert — EIN Weg für alle
-- variablen Posten statt zwei nebeneinander.

create table if not exists public.dynpricing_ledger (
    id                     uuid primary key default gen_random_uuid(),
    tenant_id              uuid not null references public.tenants(id) on delete cascade,
    -- Buchung, die die Gebühr auslöst. UNIQUE = Idempotenz-Backstop (Wurzel 2):
    -- OTA-Resync, Retry und Doppelklick erzeugen keine zweite Zeile.
    reservation_id         uuid not null unique
                               references public.reservations(id) on delete cascade,
    -- Währung der BUCHUNG (nicht des Abos). Ohne sie ist der Betrag wertlos.
    currency               text not null,
    gross_amount           numeric(12,2) not null check (gross_amount >= 0),
    -- Satz als Faktor (0.005 = 0,5 %), damit eine spätere Staffel je Tenant
    -- möglich ist, ohne den historischen Betrag neu zu interpretieren.
    rate                   numeric(5,4) not null check (rate >= 0 and rate <= 1),
    fee_amount             numeric(12,2) not null check (fee_amount >= 0),
    status                 public.commission_status not null default 'pending',
    period                 text,
    stripe_invoice_item_id text,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);

create index if not exists dynpricing_ledger_tenant_idx
    on public.dynpricing_ledger (tenant_id);
create index if not exists dynpricing_ledger_tenant_status_idx
    on public.dynpricing_ledger (tenant_id, status);
-- Der Monatslauf gruppiert je Tenant nach Währung — genau dieser Zugriff.
create index if not exists dynpricing_ledger_billing_idx
    on public.dynpricing_ledger (tenant_id, status, currency);

alter table public.dynpricing_ledger enable row level security;

-- Wurzel 6: `enable rls` + Tenant-Policy allein reicht bei Finanzdaten NICHT.
-- Ein Client mit gültigem JWT + anon-Key spricht PostgREST direkt an und umgeht
-- FastAPI komplett. Schreiben/Lesen darf hier ausschließlich der Server
-- (service_role) — identisch zu commission_ledger.
revoke all on public.dynpricing_ledger from anon, authenticated;

-- Lesen nur im eigenen Mandanten (greift für service_role-Wege mit gesetztem
-- Tenant-Kontext); zusätzlich restriktiv für ALLE Kommandos, damit auch der
-- Schreibpfad nicht tenant-weit offen steht.
create policy dynpricing_ledger_select on public.dynpricing_ledger
    for select using (tenant_id = public.current_tenant_id());
create policy dynpricing_ledger_tenant_restrict on public.dynpricing_ledger
    as restrictive for all using (tenant_id = public.current_tenant_id());

-- BEWUSST NICHT in der Publikation `supabase_realtime`: ein Realtime-Abo
-- funktioniert nur mit `select` für `authenticated` — genau das entzieht das
-- revoke oben (Finanzdaten, Wurzel 6). Ein Abo hier wäre eine stumme Attrappe.
-- Die UI hört auf `reservations` (erlaubte Quelle) und lädt die Gebühren dazu.

comment on table public.dynpricing_ledger is
    'Modul „Dynamische Preise": 0,5 % vom Buchungsumsatz je Buchung, Währung je '
    'Zeile (24 Länder). Monatlich als Invoice-Item je Währung fakturiert. '
    'Kein Stripe-Meter — der kennt keine Währung.';
comment on column public.dynpricing_ledger.currency is
    'Währung der Buchung, NICHT des Abos. Gemischte Währungen werden je Währung '
    'getrennt fakturiert (Stripe: eine Rechnung = eine Währung).';
