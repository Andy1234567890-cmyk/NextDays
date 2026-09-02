-- 0522 — Verbundkonto (Stripe Connect) als EINZIGER Auszahlungsweg des
-- Partnerprogramms. Ersetzt die Sammel-CSV (Wise/SEPA/PayPal) aus 0517.
--
-- WARUM ÜBERHAUPT: Stufe 1 war Handarbeit — CSV ziehen, bei der Bank hochladen,
-- Referenz zurücktragen. Bei zweistelligen Partnerzahlen ist das ein Fehlerherd
-- (Zahlendreher in der IBAN, doppelt hochgeladene Batches, vergessene
-- Rückmeldung). Mit einem Verbundkonto je Partner löst der Auszahlungslauf einen
-- `transfer` aus und Stripe meldet Erfolg/Fehlschlag per Webhook zurück.
--
-- WARUM `full` UND NICHT `recipient`: gemessen an Stripes Anforderungs-API für
-- Plattformland DK am 02.09.2026 — für ALLE 43 möglichen Kontoländer ist
-- `tos_types = ['full']`. Der `recipient`-Weg, den 0517 noch als „Stripe Connect
-- kommt später" vorsah, existiert für eine dänische Plattform nicht; er ist
-- US/UK-only und schlösse grenzüberschreitende Auszahlungen ausdrücklich aus
-- ("You can't make cross-border payouts to connected accounts under a recipient
-- service agreement"). `full` ist zugleich das Richtige: EWR→EWR-Transfers sind
-- erlaubt und die 0,25-%-Cross-Border-Gebühr entfällt innerhalb des EWR.
--
-- WURZEL 1 (Gegenzustand): `payout_method` und `payout_details` werden NICHT
-- gelöscht. Schon gelaufene Auszahlungen tragen ihren `method`-Wert als
-- historische Tatsache — sie nachträglich auf 'stripe' umzuschreiben wäre eine
-- Falschaussage über eine Überweisung, die real per SEPA lief (Wurzel 5b in der
-- Sache: unsere heutige Umstellung ist nicht der Zeitpunkt der alten Zahlung).
-- Der CHECK auf `affiliate_payouts.method` wird deshalb ERWEITERT, nicht ersetzt.
-- Neu angelegt wird ab jetzt ausschließlich 'stripe'.
--
-- WURZEL 6: `affiliates` und `affiliate_payouts` haben schon deny-all + RLS aus
-- 0517; die neuen Spalten erben das. Es kommen KEINE Grants dazu — die Connect-
-- Daten (Kontostatus, Requirements) liest der Partner ausschließlich über
-- /affiliates/me mit service_role, nie per anon-Key direkt.

-- --- 1. Verbundkonto am Partner ---------------------------------------------
alter table public.affiliates
    add column if not exists stripe_account_id text,
    -- Gespiegelte Freischalt-Flags. Quelle der Wahrheit ist Stripe; hier steht
    -- die letzte bekannte Antwort, damit der Auszahlungslauf nicht für jeden
    -- Partner einen API-Call braucht. Der account.updated-Webhook UND jeder
    -- Status-Abruf schreiben gegen (Muster tenant_billing_profile, 0023).
    add column if not exists stripe_payouts_enabled boolean not null default false,
    add column if not exists stripe_details_submitted boolean not null default false,
    -- Offene Anforderungen als Text-Array, damit Dashboard und Backoffice
    -- zeigen können, WORAN es hängt, statt nur „noch nicht bereit".
    add column if not exists stripe_requirements text[] not null default '{}'::text[],
    add column if not exists stripe_disabled_reason text,
    add column if not exists stripe_synced_at timestamptz;

-- Ein Stripe-Konto gehört zu genau EINEM Partner. Ohne diesen Backstop könnte
-- ein doppelt angelegtes Konto Geld an den falschen Partner leiten (Wurzel 2).
create unique index if not exists affiliates_stripe_account_uq
    on public.affiliates (stripe_account_id)
    where stripe_account_id is not null;

create index if not exists affiliates_stripe_bereit_idx
    on public.affiliates (stripe_payouts_enabled)
    where stripe_account_id is not null;

comment on column public.affiliates.stripe_account_id is
    'Connected Account (acct_…) des Partners, Custom + full service agreement, '
    'nur capability `transfers` (der Partner nimmt keine Zahlungen an). '
    'Einziger Auszahlungsweg ab 0522.';
comment on column public.affiliates.stripe_payouts_enabled is
    'Gespiegelt aus Stripe. Gate des Auszahlungslaufs: ohne true wird nichts '
    'angelegt. Quelle der Wahrheit bleibt Stripe, hier nur die letzte Antwort.';
comment on column public.affiliates.stripe_requirements is
    'Offene currently_due-Felder aus Stripe — damit Partner und Backoffice '
    'sehen, woran die Freischaltung hängt, statt nur dass sie fehlt.';

-- --- 2. Auszahlungsweg 'stripe' ---------------------------------------------
-- payout_method: 'stripe' kommt DAZU. Die alten Werte bleiben gültig, weil
-- Bestandspartner sie tragen; neue Bewerbungen setzen den Wert nicht mehr.
alter table public.affiliates
    drop constraint if exists affiliates_payout_method_check;

alter table public.affiliates
    add constraint affiliates_payout_method_check
    check (payout_method is null
           or payout_method in ('wise', 'sepa', 'paypal', 'stripe'));

comment on column public.affiliates.payout_method is
    'Ab 0522 nur noch ''stripe'' (Verbundkonto). Die Werte wise/sepa/paypal '
    'bleiben erlaubt, weil Bestandspartner sie tragen und alte Auszahlungen '
    'darauf verweisen — sie werden nicht mehr neu vergeben.';

-- affiliate_payouts.method: dieselbe Erweiterung, damit der Lauf 'stripe'
-- schreiben kann, ohne die Historie umzudeuten.
alter table public.affiliate_payouts
    drop constraint if exists affiliate_payouts_method_check;

alter table public.affiliate_payouts
    add constraint affiliate_payouts_method_check
    check (method in ('wise', 'sepa', 'paypal', 'stripe'));

-- Stripe-Transfer-Referenz. `external_ref` trug bisher eine händisch getippte
-- Überweisungsreferenz; die Transfer-Id gehört in eine eigene Spalte, weil an
-- ihr die Idempotenz hängt (Wurzel 2) und sie maschinell zurückkommt.
alter table public.affiliate_payouts
    add column if not exists stripe_transfer_id text;

create unique index if not exists affiliate_payouts_transfer_uq
    on public.affiliate_payouts (stripe_transfer_id)
    where stripe_transfer_id is not null;

comment on column public.affiliate_payouts.stripe_transfer_id is
    'tr_… des ausgelösten Transfers. UNIQUE als Backstop gegen einen zweiten '
    'Transfer für dieselbe Auszahlung (Doppelklick, Retry, Webhook-Redelivery).';

-- --- 3. Protokoll der Connect-Ereignisse ------------------------------------
-- Warum eigene Tabelle: der Weg vom „Konto angelegt" bis „auszahlbar" hat
-- mehrere Stationen (Daten gesendet, ToS akzeptiert, Bank hinterlegt, Stripe
-- verifiziert, gesperrt). Ohne Protokoll steht im Backoffice nur der aktuelle
-- Status und niemand kann sagen, warum ein Partner seit drei Wochen hängt.
create table if not exists public.affiliate_stripe_events (
    id             uuid primary key default gen_random_uuid(),
    affiliate_id   uuid not null references public.affiliates (id) on delete cascade,
    -- 'account_created', 'account_updated', 'tos_accepted', 'bank_set',
    -- 'payouts_enabled', 'payouts_disabled', 'transfer_created',
    -- 'transfer_failed'. Freitext statt Enum: das sind Protokollzeilen, keine
    -- Steuerdaten — ein neuer Ereignisname darf keine Migration erzwingen.
    event          text not null,
    stripe_id      text,
    detail         jsonb not null default '{}'::jsonb,
    created_at     timestamptz not null default now()
);

create index if not exists affiliate_stripe_events_partner_idx
    on public.affiliate_stripe_events (affiliate_id, created_at desc);

comment on table public.affiliate_stripe_events is
    'Protokoll des Verbundkonto-Wegs je Partner (angelegt, aktualisiert, ToS, '
    'Bank, freigeschaltet, gesperrt, Transfer). Nur service_role.';

-- --- 4. RLS + Grants (Wurzel 6) ---------------------------------------------
alter table public.affiliate_stripe_events enable row level security;

-- Kein Grant an anon/authenticated: die Protokollzeilen enthalten Stripe-
-- Requirements und Sperrgründe — nichts, was ein Client direkt lesen darf.
-- Der Partner sieht seinen Stand aufbereitet über /affiliates/me.
revoke all on public.affiliate_stripe_events from anon, authenticated;

drop policy if exists affiliate_stripe_events_deny on public.affiliate_stripe_events;
create policy affiliate_stripe_events_deny on public.affiliate_stripe_events
    as restrictive for all
    to anon, authenticated
    using (false)
    with check (false);
