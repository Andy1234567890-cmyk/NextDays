-- 0165_booking_conditions.sql — Buchungs-Konditionen (Zahlungsplan/Storno/Kaution)
--
-- Neues Einstellungen-Tab „Konditionen" (Lodgify-Modell): wiederverwendbare
-- Vorlagen, die pro Rate-Plan zugewiesen werden (Fallback: Standard-Kondition des
-- Tenants). Eine Kondition bündelt drei Dinge:
--   1. Zahlungsplan  — Voll / Anzahlung+Rest / 3 Raten (%, Fälligkeit)
--   2. Stornierung   — nicht erstattbar / voll / teilweise (gestaffelte Regeln)
--   3. Kaution       — optional, per Karten-Vorautorisierung (Stripe manual hold)
--
-- SENSIBLE FINANZDATEN (Wurzel 6): NUR der Server (service_role) darf lesen/
-- schreiben. Zusätzlich zu RLS werden die pauschalen anon/authenticated-GRANTs
-- entzogen — sonst wäre der PostgREST-Direktpfad offen. Betrag/Währung IMMER aus
-- den Daten (properties.currency), NIE „EUR" hardcoden (Wurzel 4).

-- ============================================================================
-- booking_conditions — eine Vorlage je Zeile (tenant-scoped)
-- ============================================================================
create table if not exists public.booking_conditions (
    id                          uuid primary key default gen_random_uuid(),
    tenant_id                   uuid not null
                                  references public.tenants(id) on delete cascade,
    internal_name               text not null,
    -- Genau EINE Standard-Kondition je Tenant (partieller Unique-Index unten).
    is_default                  boolean not null default false,

    -- --- Zahlungsplan -------------------------------------------------------
    -- 1 = eine Zahlung (voll), 2 = Anzahlung + Rest, 3 = drei Raten.
    installments                smallint not null default 1
                                  check (installments between 1 and 3),
    -- Erste Zahlung: Prozent vom Buchungsbetrag + Fälligkeit.
    first_payment_percent       numeric(5, 2)
                                  check (first_payment_percent is null
                                         or (first_payment_percent >= 0
                                             and first_payment_percent <= 100)),
    -- 'on_booking' = am Buchungstag; 'days_before_arrival' = X Tage vor Anreise.
    first_payment_timing        text not null default 'on_booking'
                                  check (first_payment_timing in
                                         ('on_booking', 'days_before_arrival')),
    first_payment_days          smallint
                                  check (first_payment_days is null
                                         or first_payment_days >= 0),
    -- Restbetrag (2 Raten): X Tage vor Anreise fällig.
    balance_days_before_arrival smallint
                                  check (balance_days_before_arrival is null
                                         or balance_days_before_arrival >= 0),
    -- Dritte Rate (3 Raten): Prozent + X Tage vor Anreise fällig.
    third_payment_percent       numeric(5, 2)
                                  check (third_payment_percent is null
                                         or (third_payment_percent >= 0
                                             and third_payment_percent <= 100)),
    third_payment_days_before   smallint
                                  check (third_payment_days_before is null
                                         or third_payment_days_before >= 0),

    -- --- Stornierung --------------------------------------------------------
    -- non_refundable | refundable (voll) | partial (gestaffelte refund_rules).
    cancellation_mode           text not null default 'non_refundable'
                                  check (cancellation_mode in
                                         ('non_refundable', 'refundable', 'partial')),

    -- --- Kaution (optional) -------------------------------------------------
    deposit_required            boolean not null default false,
    -- Aktuell nur 'preauth' (Karten-Vorautorisierung, Stripe manual capture).
    deposit_method              text not null default 'preauth'
                                  check (deposit_method in ('preauth')),
    -- Betrag in der Objektwährung (kein €-Default, Wurzel 4). NULL solange
    -- keine Kaution verlangt wird.
    deposit_amount              numeric(12, 2)
                                  check (deposit_amount is null or deposit_amount >= 0),
    -- Währung wird beim Anwenden aus dem Objekt gelesen; hier optional als
    -- Anzeige-Vorgabe der Vorlage (kein hartes „EUR").
    deposit_currency            text,
    -- Vorautorisieren ab X Tagen vor Anreise; freigeben X Tage nach Abreise.
    preauth_days_before_arrival smallint
                                  check (preauth_days_before_arrival is null
                                         or preauth_days_before_arrival >= 0),
    release_days_after_departure smallint
                                  check (release_days_after_departure is null
                                         or release_days_after_departure >= 0),

    -- --- Angebots-Gültigkeit ------------------------------------------------
    -- Stunden, die ein Angebot im Status „ausstehend/unbezahlt" gültig bleibt.
    quote_validity_hours        smallint
                                  check (quote_validity_hours is null
                                         or quote_validity_hours >= 0),

    created_at                  timestamptz not null default now(),
    updated_at                  timestamptz not null default now()
);

create index booking_conditions_tenant_idx
    on public.booking_conditions (tenant_id);
-- Genau EINE Standard-Kondition je Tenant.
create unique index booking_conditions_one_default_per_tenant
    on public.booking_conditions (tenant_id)
    where is_default;

create trigger trg_booking_conditions_updated
    before update on public.booking_conditions
    for each row execute function public.set_updated_at();

-- ============================================================================
-- booking_condition_refund_rules — gestaffelte Storno-Regeln (nur bei 'partial')
-- ============================================================================
create table if not exists public.booking_condition_refund_rules (
    id                  uuid primary key default gen_random_uuid(),
    condition_id        uuid not null
                          references public.booking_conditions(id) on delete cascade,
    -- Prozent der gezahlten Anzahlung, der bei Storno erstattet wird.
    refund_percent      numeric(5, 2) not null
                          check (refund_percent >= 0 and refund_percent <= 100),
    -- Regel greift, wenn X oder mehr Tage vor Anreise storniert wird.
    days_before_arrival smallint not null check (days_before_arrival >= 0),
    created_at          timestamptz not null default now()
);

create index booking_condition_refund_rules_condition_idx
    on public.booking_condition_refund_rules (condition_id);

-- ============================================================================
-- Rate-Plan-Zuweisung — eine Kondition je Rate-Plan (Fallback: Tenant-Default)
-- ============================================================================
alter table public.rate_plans
    add column if not exists booking_condition_id uuid
        references public.booking_conditions(id) on delete set null;

create index if not exists rate_plans_booking_condition_idx
    on public.rate_plans (booking_condition_id)
    where booking_condition_id is not null;

-- ============================================================================
-- RLS — tenant-scoped (Schreiben/Lesen nur serverseitig via service_role)
-- ============================================================================
alter table public.booking_conditions enable row level security;
drop policy if exists booking_conditions_tenant on public.booking_conditions;
create policy booking_conditions_tenant on public.booking_conditions
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

alter table public.booking_condition_refund_rules enable row level security;
drop policy if exists booking_condition_refund_rules_tenant
    on public.booking_condition_refund_rules;
-- Tenant über die Parent-Kondition ableiten (Regeln haben keine tenant_id).
create policy booking_condition_refund_rules_tenant
    on public.booking_condition_refund_rules
    for all
    using (
        exists (
            select 1 from public.booking_conditions c
            where c.id = booking_condition_refund_rules.condition_id
              and c.tenant_id = public.current_tenant_id()
        )
    )
    with check (
        exists (
            select 1 from public.booking_conditions c
            where c.id = booking_condition_refund_rules.condition_id
              and c.tenant_id = public.current_tenant_id()
        )
    );

-- ============================================================================
-- Wurzel 6 — pauschale anon/authenticated-GRANTs entziehen. Konditionen sind
-- Finanzbedingungen (Preise, Kautionen, Storno) → NUR service_role. RLS allein
-- reicht NICHT; ohne revoke bliebe der PostgREST-Direktpfad (curl /rest/v1/…)
-- offen. Prüffrage: was kann ein eingeloggter Nutzer per anon-Key hier lesen/
-- schreiben? Antwort nach diesem revoke: nichts.
-- ============================================================================
revoke all on public.booking_conditions from anon, authenticated;
revoke all on public.booking_condition_refund_rules from anon, authenticated;

-- ============================================================================
-- Realtime — speist die Konditionen-Liste im Einstellungen-Tab (Realtime-Pflicht)
-- ============================================================================
alter table public.booking_conditions replica identity full;
alter table public.booking_condition_refund_rules replica identity full;
alter publication supabase_realtime add table public.booking_conditions;
alter publication supabase_realtime add table public.booking_condition_refund_rules;

comment on table public.booking_conditions is
  'Buchungs-Konditionen (Zahlungsplan/Storno/Kaution/Angebots-Gültigkeit) als '
  'wiederverwendbare Vorlagen. Pro Rate-Plan zuweisbar (rate_plans.'
  'booking_condition_id), Fallback = Tenant-Standard (is_default). Sensibel: '
  'nur service_role (revoke + RLS).';
