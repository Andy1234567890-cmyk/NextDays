-- Beteiligung von Co-Gastgebern je Buchung.
--
-- ABGRENZUNG ZUR PLATTFORM-GEBÜHR — das ist der Kern:
--
--   • platform_fees = unsere 8 % (tenants.platform_fee_bps). FEST, vom
--     Betreiber gesetzt, vom Gastgeber NICHT beeinflussbar. Bleibt vollständig
--     unangetastet.
--   • cohost_payouts = was der GASTGEBER seinem Co-Gastgeber zahlt. Kommt
--     OBENDRAUF, geht also zulasten des Gastgebers, nicht zulasten der
--     Plattform. Der Gastgeber bestimmt Höhe und Art.
--
-- Rechenweg je Buchung (Beträge in Cent, Ganzzahl-Arithmetik):
--     Plattform    = brutto × platform_fee_bps / 10000        (fest, 8 %)
--     Co-Gastgeber = brutto × share_bps / 10000  ODER  fixer Betrag
--     Gastgeber    = brutto − Plattform − Co-Gastgeber
--
-- Die Summe der Co-Gastgeber-Anteile darf den Gastgeber-Rest nicht übersteigen
-- — sonst zahlt er drauf. Das prüft der Service, weil dort der Plattformanteil
-- der konkreten Buchung bekannt ist.
--
-- Airbnb erlaubt laut Artikel 3264 „a percentage or fixed amount" je Buchung.
-- Beides wird hier abgebildet; die Wahl trifft der Gastgeber je Co-Gastgeber.

-- Art der Beteiligung. Enum statt Freitext: Ein Tippfehler darf nicht zu einer
-- stillschweigend anderen Berechnung führen (Wurzel 4).
create type cohost_share_kind as enum (
    'none',     -- unentgeltlich (Standard — Familie, Nachbarn)
    'percent',  -- Anteil am Buchungsbetrag (Basispunkte)
    'fixed'     -- fixer Betrag je Buchung
);

-- --- Vereinbarung: was bekommt dieser Co-Gastgeber? -------------------------
-- Am property_cohosts-Eintrag, nicht an der Person: Derselbe Co-Gastgeber kann
-- für verschiedene Objekte unterschiedlich beteiligt sein.
alter table public.property_cohosts
    add column share_kind public.cohost_share_kind not null default 'none',
    -- Basispunkte (500 = 5 %). Nur bei share_kind='percent' gesetzt.
    add column share_bps integer,
    -- Fixer Betrag in Cent. Nur bei share_kind='fixed' gesetzt.
    add column share_fixed_cents bigint,
    -- Währung des Fixbetrags. Ohne sie wäre der Betrag bedeutungslos
    -- (Wurzel 4: 27 EU-Länder, kein €-Hardcode).
    add column share_currency text;

-- Die Felder müssen zur gewählten Art passen. Ohne diese Prüfung könnte eine
-- 'percent'-Vereinbarung ohne Satz existieren und still 0 auszahlen.
alter table public.property_cohosts
    add constraint property_cohosts_share_stimmig check (
        (share_kind = 'none'
            and share_bps is null
            and share_fixed_cents is null
            and share_currency is null)
        or (share_kind = 'percent'
            and share_bps is not null and share_bps > 0 and share_bps <= 10000
            and share_fixed_cents is null)
        or (share_kind = 'fixed'
            and share_fixed_cents is not null and share_fixed_cents > 0
            and share_currency is not null
            and share_bps is null)
    );

comment on column public.property_cohosts.share_kind is
    'Beteiligung des Co-Gastgebers je Buchung. Kommt ZUSÄTZLICH zur festen '
    'Plattform-Gebühr und geht zulasten des Gastgebers.';

-- --- Buchungsbezogene Beteiligung (Snapshot je Reservierung) ----------------
-- Eigene Tabelle statt einer Spalte in platform_fees: Es kann MEHRERE
-- Co-Gastgeber je Objekt geben (bis 10), also mehrere Zeilen je Buchung —
-- platform_fees hat dagegen UNIQUE(reservation_id) und bleibt unberührt.
create table public.cohost_payouts (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    reservation_id uuid not null
        references public.reservations(id) on delete cascade,
    -- Die Vereinbarung, aus der diese Zeile entstand. Bleibt erhalten, wenn
    -- der Zugriff später entzogen wird (set null) — eine abgerechnete
    -- Beteiligung darf nicht verschwinden, nur weil jemand ausscheidet.
    cohost_id uuid references public.property_cohosts(id) on delete set null,
    user_id uuid not null references auth.users(id) on delete cascade,
    -- Snapshot der Konditionen zum Buchungszeitpunkt. Eine spätere Änderung
    -- der Vereinbarung darf bereits entstandene Beteiligungen NICHT rückwirkend
    -- verändern (Wurzel 1: der alte Zustand bleibt gültig).
    share_kind public.cohost_share_kind not null,
    share_bps integer,
    gross_amount_cents bigint not null check (gross_amount_cents >= 0),
    payout_amount_cents bigint not null check (payout_amount_cents >= 0),
    currency text not null,
    status text not null default 'pending'
        check (status in ('pending', 'paid', 'cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- Ein Co-Gastgeber bekommt je Buchung genau EINE Beteiligung. Retry oder
    -- Webhook-Redelivery darf keine zweite erzeugen (Wurzel 2).
    unique (reservation_id, user_id)
);

comment on table public.cohost_payouts is
    'Beteiligung eines Co-Gastgebers an EINER Buchung. Zusätzlich zur festen '
    'Plattform-Gebühr (platform_fees) und zulasten des Gastgebers. Die '
    'Konditionen sind eingefroren — spätere Änderungen wirken nicht rückwirkend.';

create index cohost_payouts_tenant_idx on public.cohost_payouts (tenant_id);
create index cohost_payouts_user_idx
    on public.cohost_payouts (user_id, status);
create index cohost_payouts_reservation_idx
    on public.cohost_payouts (reservation_id);

-- --- RLS (Wurzel 6) ---------------------------------------------------------
-- Finanzdaten: Schreiben ausschließlich über den Server. Ein Client, der hier
-- schreiben könnte, würde sich selbst eine Beteiligung eintragen.
alter table public.cohost_payouts enable row level security;

revoke insert, update, delete on public.cohost_payouts
    from anon, authenticated;
revoke select on public.cohost_payouts from anon;

-- Lesen: der Gastgeber-Tenant (was er zahlt) und der Co-Gastgeber selbst (was
-- er bekommt). Sonst niemand — auch kein anderer Co-Gastgeber desselben
-- Objekts, denn was ein Dritter verdient, geht ihn nichts an.
create policy cohost_payouts_read
    on public.cohost_payouts
    for select
    using (
        tenant_id = public.current_tenant_id()
        or user_id = (select auth.uid())
    );

grant select on public.cohost_payouts to authenticated;
alter publication supabase_realtime add table public.cohost_payouts;
