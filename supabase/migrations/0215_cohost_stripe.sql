-- Stripe-Anbindung der Co-Gastgeber (Ergänzung zu 0214).
--
-- WARUM NÖTIG: Der bisherige Zahlungspfad ist eine Destination Charge — eine
-- Zahlung, ein verbundenes Konto. Laut Stripe (docs.stripe.com/connect/charges,
-- abgerufen 2026-07-26) gilt: „Each transaction relates to a single connected
-- account and a single customer." Ein zweiter Empfänger ist damit unmöglich,
-- und nachträglich umleiten geht auch nicht: Das Geld liegt dann beim
-- Gastgeber, nicht bei der Plattform.
--
-- Deshalb der Umbau auf Separate Charges + Transfers:
--     Gast zahlt      → Plattform-Konto (wir halten den Betrag kurz)
--     Transfer 1      → Gastgeber (Rest)
--     Transfer 2..n   → Co-Gastgeber (vereinbarte Beteiligung)
--     einbehalten     → unsere feste Plattform-Gebühr
-- Zusammengehalten über transfer_group = die Reservierungs-ID.
--
-- FOLGE, die bewusst so entschieden wurde: Die Plattform hält das Geld
-- zwischenzeitlich und haftet laut Stripe für negative Salden verbundener
-- Konten. Das ist eine geschäftliche/regulatorische Änderung gegenüber der
-- reinen Vermittlung — steuerlich und rechtlich zu prüfen, nicht durch diese
-- Migration abgedeckt.
--
-- Jeder Co-Gastgeber braucht ein eigenes Stripe-Konto, BEVOR er eine Einladung
-- annehmen kann (Entscheidung des Betreibers) — sonst entstünden Beteiligungen,
-- die niemand auszahlen kann.

-- --- Stripe-Konto je Co-Gastgeber ------------------------------------------
-- Eigene Tabelle statt einer Spalte an property_cohosts: Eine Person kann für
-- MEHRERE Objekte Co-Gastgeber sein, hat aber nur EIN Stripe-Konto. Am
-- Zuordnungs-Eintrag läge es mehrfach und könnte auseinanderlaufen.
create table public.cohost_stripe_accounts (
    -- Der Co-Gastgeber. Kein tenant_id: Er ist tenant-fremd (siehe 0213).
    user_id uuid primary key references auth.users(id) on delete cascade,
    stripe_account_id text not null unique,
    -- Spiegel des Stripe-Status. Nur Stripe ist die Wahrheit; diese Felder
    -- ersparen einen API-Aufruf bei jeder Anzeige und werden per Webhook
    -- aktualisiert.
    payouts_enabled boolean not null default false,
    charges_enabled boolean not null default false,
    -- Offene KYC-Anforderungen (Stripe requirements.currently_due). Damit die
    -- Oberfläche sagen kann, WAS noch fehlt, statt nur „nicht bereit".
    requirements_due jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.cohost_stripe_accounts is
    'Stripe-Connect-Konto eines Co-Gastgebers. Pflicht vor der Annahme einer '
    'Einladung — ohne Konto kann keine Beteiligung ausgezahlt werden. Eine '
    'Person = ein Konto, unabhängig von der Zahl mitbetreuter Objekte.';

-- --- Transfer-Nachweis je Beteiligung --------------------------------------
-- An cohost_payouts (0214): Welcher Stripe-Transfer hat diese Beteiligung
-- tatsächlich ausgezahlt? Ohne diese Referenz wäre nicht nachvollziehbar, ob
-- Geld geflossen ist — und ein Retry würde doppelt transferieren (Wurzel 2).
alter table public.cohost_payouts
    add column stripe_transfer_id text,
    add column transfer_group text,
    add column paid_at timestamptz,
    -- Fehlgeschlagener Transfer: Grund festhalten, statt still auf 'pending'
    -- stehen zu bleiben (Wurzel 5 — ein verschlucktes Problem sieht aus wie
    -- „noch nicht dran").
    add column last_error text;

-- Ein Stripe-Transfer gehört zu genau einer Beteiligung. Der UNIQUE-Index ist
-- der Backstop gegen Doppelauszahlung, falls die Anwendungslogik einmal
-- versagt (Wurzel 2: der Schutz gehört in die DB).
create unique index cohost_payouts_transfer_uniq
    on public.cohost_payouts (stripe_transfer_id)
    where stripe_transfer_id is not null;

comment on column public.cohost_payouts.stripe_transfer_id is
    'Stripe-Transfer, der diese Beteiligung ausgezahlt hat. UNIQUE — ein '
    'Retry darf nie doppelt transferieren.';

-- --- RLS (Wurzel 6) ---------------------------------------------------------
-- Stripe-Konto-IDs sind sensibel: Wer sie kennt und schreiben könnte, könnte
-- Auszahlungen auf ein fremdes Konto umleiten. Schreiben ausschließlich Server.
alter table public.cohost_stripe_accounts enable row level security;

revoke insert, update, delete on public.cohost_stripe_accounts
    from anon, authenticated;
revoke select on public.cohost_stripe_accounts from anon;

-- Jeder sieht NUR sein eigenes Konto. Ein Gastgeber sieht bewusst nicht die
-- Stripe-Konto-ID seines Co-Gastgebers — er muss nur wissen, OB ausgezahlt
-- werden kann, nicht wohin.
create policy cohost_stripe_accounts_self_read
    on public.cohost_stripe_accounts
    for select
    using (user_id = (select auth.uid()));

grant select on public.cohost_stripe_accounts to authenticated;
alter publication supabase_realtime add table public.cohost_stripe_accounts;
