-- Auszahlungen an Betriebe nach dem Modell von Airbnb und Booking.com.
--
-- DAS PRINZIP: Der Gast zahlt sofort, das Geld bleibt bei der Plattform, der
-- Betrieb bekommt es NACH DER ABREISE. Bis dahin ist der Aufenthalt gelaufen —
-- Schäden, verkürzte Aufenthalte, No-Shows und Beschwerden sind bekannt, BEVOR
-- Geld fließt. (Airbnb zahlt schon 24 h nach Anreise und muss bei Problemen
-- zurückverrechnen; Booking wartet auf den Checkout. Wir folgen Booking.)
--
-- DARAUS FOLGT DER KERN: Ein Storno wird VERRECHNET, nicht zurückgeholt. Airbnb
-- wörtlich: der Betrag "wird von den nächsten Auszahlungen einbehalten". Genau
-- dafür gibt es payout_adjustments. Rückholen vom Bankkonto des Betriebs gibt es
-- in diesem Modell nicht mehr.
--
-- Diese Migration legt NUR das Datenmodell an. Der Zahlungspfad läuft weiter
-- über Destination Charges; die Umstellung auf getrennte Charges folgt separat.

-- ---------------------------------------------------------------------------
-- 1) Enums
-- ---------------------------------------------------------------------------

do $$
begin
    if not exists (select 1 from pg_type where typname = 'payout_status') then
        create type public.payout_status as enum (
            'scheduled',  -- Abreise liegt in der Zukunft, Fälligkeit steht fest
            'due',        -- fällig, wartet auf den nächsten Auszahlungslauf
            'held',       -- zurückgehalten (Prüfung/Rückbuchung), siehe payout_holds
            'paid',       -- an den Betrieb ausgezahlt
            'withheld',   -- Storno VOR Auszahlung: es fließt nichts
            'failed'      -- Transfer fehlgeschlagen, Wiederholung möglich
        );
    end if;

    if not exists (select 1 from pg_type where typname = 'payout_interval') then
        create type public.payout_interval as enum (
            'daily',    -- einen Tag nach Abreise
            'weekly',   -- donnerstags, für Abreisen Do–Mi (Booking-Rhythmus)
            'monthly'   -- bis zum 15. des Folgemonats
        );
    end if;

    if not exists (select 1 from pg_type where typname = 'payout_adjustment_kind') then
        create type public.payout_adjustment_kind as enum (
            'refund',          -- Gast-Erstattung nach bereits erfolgter Auszahlung
            'chargeback',      -- Rückbuchung durch die Bank des Gastes
            'cancellation_fee',-- Stornogebühr zulasten des Betriebs
            'correction'       -- manuelle Korrektur durch die Plattform
        );
    end if;

    if not exists (select 1 from pg_type where typname = 'payout_hold_reason') then
        create type public.payout_hold_reason as enum (
            'chargeback',      -- offene Rückbuchung zur Buchung
            'dispute',         -- Beschwerde/Streitfall
            'fraud_review',    -- Betrugsprüfung
            'bank_changed',    -- Auszahlungskonto frisch geändert
            'manual'           -- von der Plattform gesetzt
        );
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Einstellungen je Betrieb
-- ---------------------------------------------------------------------------

create table if not exists public.payout_settings (
    tenant_id     uuid primary key references public.tenants(id) on delete cascade,
    -- Booking lässt den Partner wählen; Standard ist wöchentlich.
    interval      public.payout_interval not null default 'weekly',
    -- Auszahlungen generell angehalten (z. B. laufende Kontoprüfung). Wirkt auf
    -- ALLE Zeilen des Betriebs, unabhängig von einzelnen holds.
    paused        boolean not null default false,
    paused_reason text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

comment on table public.payout_settings is
  'Auszahlungsrhythmus je Betrieb (Booking-Modell: täglich/wöchentlich/monatlich).';

-- ---------------------------------------------------------------------------
-- 3) Auszahlungen
-- ---------------------------------------------------------------------------

create table if not exists public.payouts (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants(id) on delete cascade,
    reservation_id uuid not null references public.reservations(id) on delete cascade,

    -- Beträge EINGEFROREN zum Zeitpunkt der Fälligkeit: Ändert der Betrieb
    -- später seinen Provisionssatz oder Spendenanteil, darf das eine bereits
    -- abgerechnete Buchung nicht rückwirkend verschieben (wie platform_fees).
    gross_amount_cents    bigint not null check (gross_amount_cents >= 0),
    platform_fee_cents    bigint not null default 0 check (platform_fee_cents >= 0),
    donation_cents        bigint not null default 0 check (donation_cents >= 0),
    cohost_cents          bigint not null default 0 check (cohost_cents >= 0),
    -- Was dem Betrieb bleibt: brutto − Provision − Spende − Co-Gastgeber.
    net_amount_cents      bigint not null check (net_amount_cents >= 0),
    currency       text not null,

    status         public.payout_status not null default 'scheduled',
    -- Fällig ab: tatsächlicher Checkout, sonst geplantes Datum + 1 Tag.
    -- Der Rückfall ist zwingend, sonst bliebe Geld liegen, wenn ein Betrieb den
    -- Checkout nie einträgt.
    due_at         timestamptz not null,
    paid_at        timestamptz,
    -- Stripe-Transfer bzw. Payout dieser Zeile (für die Nachverfolgung).
    stripe_transfer_id text,
    last_error     text,

    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    -- Eine Auszahlungszeile je Buchung. Backstop gegen Doppelanlage bei
    -- Retry/Doppelklick (Wurzel 2) — der Service prüft zusätzlich den Status.
    constraint payouts_je_reservierung unique (reservation_id)
);

-- Die Aufteilung muss aufgehen: Netto plus alle Abzüge ergibt den Bruttobetrag.
-- Ohne diese Prüfung könnte ein Rechenfehler still Geld verschwinden lassen.
alter table public.payouts drop constraint if exists payouts_aufteilung_stimmig;
alter table public.payouts add constraint payouts_aufteilung_stimmig
    check (
        net_amount_cents + platform_fee_cents + donation_cents + cohost_cents
        = gross_amount_cents
    );

-- Ein Transfer darf nur EINER Auszahlung zugeordnet sein (Doppelzahlung).
create unique index if not exists payouts_transfer_uniq
    on public.payouts (stripe_transfer_id)
    where stripe_transfer_id is not null;

-- Der Auszahlungslauf sucht genau danach: fällige Zeilen je Betrieb.
create index if not exists payouts_faellig_idx
    on public.payouts (tenant_id, due_at)
    where status in ('scheduled', 'due', 'failed');

create index if not exists payouts_tenant_idx
    on public.payouts (tenant_id, created_at desc);

comment on table public.payouts is
  'Auszahlung je Buchung. Fällig NACH DER ABREISE (Booking-Modell), nicht bei '
  'Zahlungseingang — bis dahin hält die Plattform das Geld.';

-- ---------------------------------------------------------------------------
-- 4) Verrechnungsposten — der Kern des Modells
-- ---------------------------------------------------------------------------
-- Statt Geld vom Bankkonto des Betriebs zurückzuholen (was scheitert, sobald er
-- es abgehoben hat), wird der Betrag von der NÄCHSTEN Auszahlung einbehalten.
-- Steht keine an, bleibt der Posten offen und wird zur Forderung.

create table if not exists public.payout_adjustments (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants(id) on delete cascade,
    -- Auf welche Buchung er zurückgeht (kann fehlen bei manueller Korrektur).
    reservation_id uuid references public.reservations(id) on delete set null,
    kind           public.payout_adjustment_kind not null,
    -- IMMER positiv: der Betrag, der einbehalten werden soll. Das Vorzeichen
    -- steckt in der Bedeutung, nicht in der Zahl — sonst summiert sich beim
    -- Verrechnen leicht etwas falsch.
    amount_cents   bigint not null check (amount_cents > 0),
    currency       text not null,
    -- Wie viel davon bereits verrechnet wurde (Teilverrechnung über mehrere
    -- Auszahlungen möglich, wenn eine einzelne nicht reicht).
    settled_cents  bigint not null default 0 check (settled_cents >= 0),
    -- Auszahlung, mit der zuletzt verrechnet wurde (Nachvollziehbarkeit).
    settled_payout_id uuid references public.payouts(id) on delete set null,
    note           text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

alter table public.payout_adjustments
    drop constraint if exists payout_adjustments_settled_stimmig;
alter table public.payout_adjustments
    add constraint payout_adjustments_settled_stimmig
    check (settled_cents <= amount_cents);

-- Offene Posten je Betrieb — genau das liest der Auszahlungslauf.
create index if not exists payout_adjustments_offen_idx
    on public.payout_adjustments (tenant_id, currency)
    where settled_cents < amount_cents;

comment on table public.payout_adjustments is
  'Verrechnungsposten (Airbnb: "wird von den nächsten Auszahlungen einbehalten"). '
  'Ersetzt das Zurückholen vom Bankkonto des Betriebs.';

-- ---------------------------------------------------------------------------
-- 5) Zurückhaltungen
-- ---------------------------------------------------------------------------
-- Airbnb hält Auszahlungen bis zu 45 Tage an, wenn etwas zu klären ist. Das ist
-- der Schutz davor, Geld auszuzahlen, das kurz darauf zurückgebucht wird.

create table if not exists public.payout_holds (
    id          uuid primary key default gen_random_uuid(),
    payout_id   uuid not null references public.payouts(id) on delete cascade,
    reason      public.payout_hold_reason not null,
    note        text,
    -- Spätestens dann wird der Halt aufgehoben (Airbnb: max. 45 Tage). Ohne
    -- Frist bliebe Geld unbegrenzt liegen.
    expires_at  timestamptz not null,
    released_at timestamptz,
    created_at  timestamptz not null default now()
);

-- Je Auszahlung nur EIN offener Halt — sonst wäre unklar, welcher zählt.
create unique index if not exists payout_holds_offen_uniq
    on public.payout_holds (payout_id)
    where released_at is null;

create index if not exists payout_holds_faellig_idx
    on public.payout_holds (expires_at)
    where released_at is null;

comment on table public.payout_holds is
  'Zurückgehaltene Auszahlung mit Grund und Frist (Airbnb: bis 45 Tage).';

-- ---------------------------------------------------------------------------
-- 6) Realtime
-- ---------------------------------------------------------------------------

alter table public.payouts replica identity full;
alter table public.payout_adjustments replica identity full;
alter table public.payout_settings replica identity full;

do $$
declare
    t text;
begin
    foreach t in array array['payouts', 'payout_adjustments', 'payout_settings']
    loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and tablename = t
        ) then
            execute format(
                'alter publication supabase_realtime add table public.%I', t
            );
        end if;
    end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7) RLS + Grants (Wurzel 6)
-- ---------------------------------------------------------------------------
-- Finanzdaten: geschrieben wird AUSSCHLIESSLICH vom Server (service_role).
-- Lesen darf der eigene Betrieb, damit das Dashboard live abonnieren kann.
-- payout_holds bleibt für Clients GANZ gesperrt: Der Grund einer Zurückhaltung
-- (Betrugsprüfung, Rückbuchung) darf der Betrieb nicht roh mitlesen.

alter table public.payouts enable row level security;
alter table public.payout_adjustments enable row level security;
alter table public.payout_settings enable row level security;
alter table public.payout_holds enable row level security;

-- Erst das pauschale Grant entziehen, dann gezielt gewähren — sonst greift ein
-- späteres column-REVOKE nicht (Wurzel 6).
revoke all on public.payouts from anon, authenticated;
revoke all on public.payout_adjustments from anon, authenticated;
revoke all on public.payout_settings from anon, authenticated;
revoke all on public.payout_holds from anon, authenticated;

create policy payouts_tenant_read
    on public.payouts for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

create policy payout_adjustments_tenant_read
    on public.payout_adjustments for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

create policy payout_settings_tenant_read
    on public.payout_settings for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

grant select on public.payouts to authenticated;
grant select on public.payout_adjustments to authenticated;
grant select on public.payout_settings to authenticated;

-- payout_holds: KEIN Grant, KEINE Policy — nur service_role. Der Betrieb sieht
-- über die API, DASS zurückgehalten wird, nicht den Rohgrund.

-- Schreiben bleibt überall dem Server vorbehalten: kein insert/update/delete
-- für anon/authenticated. Wer hier schreiben könnte, würde sich selbst
-- Auszahlungen bewilligen.
