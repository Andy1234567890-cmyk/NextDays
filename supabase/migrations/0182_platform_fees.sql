-- 0182_platform_fees.sql — Plattform-Provision (8 %) je Marktplatz-Buchung
--
-- account_type='marketplace' (0180) zahlt platform_fee_bps (Default 800 = 8 %)
-- je Buchung an myNextDays. Die Fee wird beim Gast-Charge SOFORT einbehalten
-- (Stripe application_fee_amount / PayPal platform_fee) — dieses Ledger ist der
-- AUDITIERBARE Gegenbuchungs-Spiegel dazu (eine Zeile je Buchung), nicht ein
-- zweiter Geldfluss. Nötig, weil die Stripe-application_fee allein keine per
-- reservation_id abfragbare, stornierbare Finanzzeile in unserer DB hinterlässt
-- (Statements/Reporting/Storno-Gegenzustand brauchen sie).
--
-- ABGRENZUNG: commission_ledger (0118) = NACHGELAGERTE 1 %-OTA-Provision (Booking/
-- Airbnb, monatlicher Stripe-Invoice). platform_fees = SOFORTIGE 8 %-Marktplatz-
-- Provision auf EIGENE Gast-Zahlungen. Getrennte Tabellen (anderer Einzugsweg,
-- andere Auslöser, andere Semantik) — bewusst NICHT in 0118 gemischt.
--
-- Wurzel 4: bps + Cent-Ganzzahl-Arithmetik, Währung aus der Buchung (kein EUR).
-- Wurzel 6: Finanzdaten → enable rls + restriktive Policy + harter GRANT-Entzug,
--           nur service_role schreibt/liest per-Zeile (kein anon/authenticated curl).

do $$
begin
    if not exists (select 1 from pg_type where typname = 'platform_fee_status') then
        -- pending  = Charge angelegt, noch nicht bestätigt (Intent pending)
        -- charged  = Fee erfolgreich einbehalten (payment_intent.succeeded)
        -- reversed = Buchung storniert/erstattet → Fee (anteilig) zurückgegeben
        -- failed   = Charge fehlgeschlagen (Fee nie geflossen)
        create type public.platform_fee_status as enum
            ('pending', 'charged', 'reversed', 'failed');
    end if;
end $$;

create table if not exists public.platform_fees (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null
                         references public.tenants(id) on delete cascade,
    reservation_id     uuid not null
                         references public.reservations(id) on delete cascade,
    -- Optionaler Bezug zur konkreten Gast-Zahlung (payments.id), aus der die Fee
    -- einbehalten wurde. NULL erlaubt; FK set null, damit ein Payment-Löschen die
    -- Fee-Historie nicht mitreißt.
    payment_id         uuid references public.payments(id) on delete set null,
    -- Satz + Beträge in GANZZAHL. bps = Basispunkte (800 = 8,00 %); Beträge in
    -- Cent (kleinste Einheit) → exakte Arithmetik, keine Float-Rundungsfehler.
    fee_bps            integer not null check (fee_bps between 0 and 10000),
    gross_amount_cents bigint  not null check (gross_amount_cents >= 0),
    fee_amount_cents   bigint  not null check (fee_amount_cents >= 0),
    -- Bereits zurückgegebener Fee-Anteil (Storno/Teil-Refund). Gegenzustand
    -- (Wurzel 1): reversed_amount_cents <= fee_amount_cents (CHECK).
    reversed_amount_cents bigint not null default 0
                         check (reversed_amount_cents >= 0),
    -- Währung MUSS aus der Buchung kommen (reservations.currency), nie EUR
    -- hardcoden (Wurzel 4). Fehlt sie beim Anlegen → 422 im Service, nie Fallback.
    currency           text not null,
    gateway            text not null default 'stripe',   -- stripe | paypal
    -- Referenz auf das Gateway-Fee-Objekt (Stripe application_fee id / PayPal
    -- platform_fee) — für Nachvollziehbarkeit/Reconciliation.
    gateway_fee_ref    text,
    status             public.platform_fee_status not null default 'pending',
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    -- IDEMPOTENZ-BACKSTOP (Wurzel 2): genau EINE Fee-Zeile je Buchung. Webhook-
    -- Redelivery / Doppelklick / Retry erzeugt keine zweite Fee. Der DB-UNIQUE
    -- ist der harte Garant zusätzlich zum status/claim-Guard im Service.
    constraint platform_fees_reservation_uniq unique (reservation_id),
    constraint platform_fees_reversal_le_fee
        check (reversed_amount_cents <= fee_amount_cents)
);

create index platform_fees_tenant_idx on public.platform_fees (tenant_id);
create index platform_fees_tenant_status_idx
    on public.platform_fees (tenant_id, status);

create trigger trg_platform_fees_updated
    before update on public.platform_fees
    for each row execute function public.set_updated_at();

-- =========================================================================
-- Wurzel 6 — RLS + restriktive Policy + harter GRANT-Entzug (Finanzdaten)
-- =========================================================================
alter table public.platform_fees enable row level security;

-- Restriktive Tenant-Policy für ALLE Operationen (nicht nur select), damit der
-- Schreibpfad nie tenant-weit offen ist (Wurzel 6). Backstop, falls doch ein
-- GRANT bestünde.
create policy platform_fees_tenant_isolation on public.platform_fees
    as restrictive
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Harter Entzug: anon/authenticated dürfen die Fee-Tabelle WEDER lesen NOCH
-- schreiben. Ein eingeloggter cleaner mit anon-Key bekommt per
-- `curl /rest/v1/platform_fees` weder Zeilen noch Schreibzugriff. Nur der Server
-- (service_role) verwaltet sie — sonst könnte ein Gastgeber die eigene Provision
-- auf 0 setzen oder fremde Finanzzeilen lesen.
revoke select, insert, update, delete on public.platform_fees from anon;
revoke select, insert, update, delete on public.platform_fees from authenticated;

-- Realtime — speist die Fee-/Abrechnungs-Ansicht im Dashboard (wie 0118).
alter table public.platform_fees replica identity full;
alter publication supabase_realtime add table public.platform_fees;

comment on table public.platform_fees is
  'Plattform-Provision (8 %, platform_fee_bps) je Marktplatz-Buchung — '
  'auditierbarer Spiegel der sofort einbehaltenen Stripe application_fee / '
  'PayPal platform_fee. NICHT commission_ledger (OTA-1 %-Provision). Nur '
  'service_role liest/schreibt (Finanzdaten, Wurzel 6).';
comment on column public.platform_fees.fee_bps is
  'Provision in Basispunkten zum Buchungszeitpunkt (Snapshot aus '
  'tenants.platform_fee_bps, 800 = 8 %). Eingefroren — spätere Fee-Änderung '
  'am Tenant verändert bestehende Buchungen nicht.';
comment on column public.platform_fees.reversed_amount_cents is
  'Bereits zurückgegebener Fee-Anteil bei Storno/Refund (Gegenzustand, Wurzel 1).';
