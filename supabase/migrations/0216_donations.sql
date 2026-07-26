-- Spenden vom Auszahlungsanteil (Airbnb-Modell „Donate to Airbnb.org").
--
-- Der Gastgeber legt EINEN Prozentsatz fest, der je Buchung von SEINEM Anteil
-- abgeht. Die feste Plattform-Gebühr (tenants.platform_fee_bps) bleibt davon
-- unberührt — die Spende kommt oben drauf, genau wie die Co-Gastgeber-
-- Beteiligung (0214).
--
-- Geldfluss: Wir kassieren per Destination Charge; die Plattform hält das Geld
-- nie. Deshalb wird der Spendenanteil in die Stripe-application_fee eingerechnet
-- und liegt anschließend auf dem Plattform-Saldo. Von dort geht er an die
-- Organisation — deshalb je Buchung eine Ledger-Zeile (donations), sonst wäre
-- später nicht mehr feststellbar, wie viel wem zusteht.
--
-- Empfänger sind als eigene Tabelle vorbereitet, obwohl vorerst nur ein Eintrag
-- existiert: Ein späterer Wechsel auf mehrere Organisationen braucht dann keine
-- Migration am Ledger (der trägt die recipient_id bereits).

-- ---------------------------------------------------------------------------
-- 1) Empfänger
-- ---------------------------------------------------------------------------

create table if not exists public.donation_recipients (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    -- Kurzbeschreibung für die Auswahl-UI („was macht diese Organisation").
    description text,
    website     text,
    -- Nur aktive Empfänger sind wählbar. Ein abgeschalteter Empfänger bleibt
    -- bestehen, damit historische Ledger-Zeilen ihren Bezug behalten.
    active      boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.donation_recipients is
  'Spendenempfänger (von myNextDays gepflegt). Vorerst ein Eintrag; die Tabelle '
  'existiert, damit ein Wechsel auf mehrere Organisationen ohne Ledger-Migration '
  'möglich ist.';

-- ---------------------------------------------------------------------------
-- 2) Einstellung je Betrieb
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_donation_settings (
    tenant_id     uuid primary key references public.tenants(id) on delete cascade,
    -- Basispunkte (300 = 3 %). Obergrenze 5000 = 50 %: ein höherer Satz wäre in
    -- Kombination mit Plattform-Gebühr und Co-Gastgeber-Beteiligung fast immer
    -- unerfüllbar und deutet auf einen Eingabefehler hin.
    share_bps     integer not null check (share_bps between 0 and 5000),
    recipient_id  uuid not null references public.donation_recipients(id),
    -- Wer hat wann zugestimmt (Spenden-Bedingungen). Nachweis, kein Deko-Feld.
    accepted_at   timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

comment on column public.tenant_donation_settings.share_bps is
  'Spendenanteil in Basispunkten (300 = 3 %). Geht vom Anteil des Gastgebers ab, '
  'NICHT von der Plattform-Gebühr.';

-- ---------------------------------------------------------------------------
-- 3) Ledger je Buchung
-- ---------------------------------------------------------------------------

do $$
begin
    if not exists (select 1 from pg_type where typname = 'donation_status') then
        create type public.donation_status as enum (
            'pending',    -- Buchung angelegt, Zahlung noch nicht bestätigt
            'collected',  -- Zahlung durch, Betrag liegt auf dem Plattform-Saldo
            'paid_out',   -- an die Organisation überwiesen
            'reversed'    -- Buchung storniert/erstattet → Gegenzustand (Wurzel 1)
        );
    end if;
end $$;

create table if not exists public.donations (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants(id) on delete cascade,
    reservation_id uuid not null references public.reservations(id) on delete cascade,
    recipient_id   uuid not null references public.donation_recipients(id),
    -- Satz und Bemessungsgrundlage EINGEFROREN: Ändert der Gastgeber später
    -- seinen Prozentsatz, darf das die bereits abgerechnete Buchung nicht
    -- rückwirkend verändern (gleiche Logik wie platform_fees.fee_bps, 0182).
    share_bps      integer not null check (share_bps between 0 and 5000),
    gross_amount_cents bigint not null check (gross_amount_cents >= 0),
    amount_cents   bigint not null check (amount_cents >= 0),
    currency       text not null,
    status         public.donation_status not null default 'pending',
    -- Gegenzustand bei Storno/Erstattung: anteilig zurückgenommener Betrag.
    reversed_amount_cents bigint not null default 0
        check (reversed_amount_cents >= 0),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    -- Eine Spendenzeile je Buchung. Backstop gegen Doppelanlage bei Retry/
    -- Doppelklick (Wurzel 2) — der Service prüft zusätzlich den Status.
    constraint donations_je_reservierung unique (reservation_id)
);

-- Zurückgenommen kann nie mehr sein als gespendet.
alter table public.donations
    drop constraint if exists donations_reversal_stimmig;
alter table public.donations
    add constraint donations_reversal_stimmig
    check (reversed_amount_cents <= amount_cents);

create index if not exists donations_tenant_idx
    on public.donations (tenant_id, created_at desc);
create index if not exists donations_status_idx
    on public.donations (status) where status in ('collected', 'pending');

comment on table public.donations is
  'Spendenanteil je Buchung. Der Betrag ist Teil der Stripe-application_fee und '
  'liegt nach der Zahlung auf dem Plattform-Saldo — von dort geht er an die '
  'Organisation.';

-- ---------------------------------------------------------------------------
-- 4) Realtime
-- ---------------------------------------------------------------------------

alter table public.donations replica identity full;
alter table public.tenant_donation_settings replica identity full;

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'tenant_donation_settings'
    ) then
        alter publication supabase_realtime add table public.tenant_donation_settings;
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'donations'
    ) then
        alter publication supabase_realtime add table public.donations;
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5) RLS + Grants (Wurzel 6)
-- ---------------------------------------------------------------------------
-- donations ist eine FINANZTABELLE: geschrieben wird ausschließlich vom Server
-- (service_role). Lesen darf der eigene Betrieb, damit das Dashboard die
-- Spendenübersicht ohne zweiten API-Weg live abonnieren kann.

alter table public.donations enable row level security;
alter table public.tenant_donation_settings enable row level security;
alter table public.donation_recipients enable row level security;

-- Erst das pauschale Grant entziehen, dann gezielt gewähren — sonst greift ein
-- späteres column-REVOKE nicht (Wurzel 6).
revoke all on public.donations from anon, authenticated;
revoke all on public.tenant_donation_settings from anon, authenticated;
revoke all on public.donation_recipients from anon, authenticated;

create policy donations_tenant_read
    on public.donations for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

create policy tenant_donation_settings_tenant_read
    on public.tenant_donation_settings for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

-- Empfänger sind nicht vertraulich (der Gastgeber muss sie in der Auswahl
-- sehen), aber nur die aktiven und nur lesend.
create policy donation_recipients_read
    on public.donation_recipients for select
    to authenticated
    using (active);

grant select on public.donations to authenticated;
grant select on public.tenant_donation_settings to authenticated;
grant select on public.donation_recipients to authenticated;

-- Schreiben bleibt dem Server vorbehalten: KEIN insert/update/delete-Grant für
-- anon/authenticated. Ein eingeloggter Nutzer kann seinen Spendensatz also
-- nicht per direktem PostgREST-Zugriff setzen — das läuft über die API, die
-- Rolle und Betrieb prüft.

-- ---------------------------------------------------------------------------
-- 6) Startdatensatz
-- ---------------------------------------------------------------------------
-- Ein Empfänger, damit die Auswahl nicht leer ist. Name/Beschreibung sind
-- bewusst neutral und von myNextDays später zu pflegen — hier wird KEINE
-- reale Organisation erfunden.

insert into public.donation_recipients (name, description, active)
select 'myNextDays Hilfsfonds',
       'Unterstützt Menschen in Notlagen mit kurzfristiger Unterkunft.',
       true
where not exists (select 1 from public.donation_recipients);
