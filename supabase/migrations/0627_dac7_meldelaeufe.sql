-- DAC7-Meldelaeufe: was wann an welche Behoerde gemeldet wurde.
--
-- WARUM DAS GESPEICHERT WERDEN MUSS, NICHT NUR DIE DATEI:
--
-- 1. KORREKTUREN. Eine Korrekturmeldung verweist ueber CORR_DOC_REF_ID auf
--    genau die Kennung, die in der Erstmeldung stand. Wer diese Kennungen
--    nicht aufbewahrt, kann eine abgegebene Meldung nie wieder korrigieren —
--    und Korrekturen sind der Normalfall, nicht die Ausnahme.
--
-- 2. NACHVOLLZIEHBARKEIT. Die Behoerde fragt "woher kommt dieser Betrag".
--    Die Antwort muss das System geben, nicht die Erinnerung eines Menschen.
--    Deshalb wird je Meldeeinheit festgehalten, aus welchen Buchungen ihre
--    Zahlen entstanden sind.
--
-- 3. AUFBEWAHRUNG. Die Aufzeichnungen ueber Meldeinhalte sind mehrere Jahre
--    aufzubewahren; die Aufbewahrungsfrist laeuft ab der Meldung.
--
-- ABGRENZUNG zu taxpayer_info (0226): Dort stehen die ERHOBENEN Angaben des
-- Steuerzahlers (Stammdaten, jederzeit aenderbar). Hier steht, was TATSAECHLICH
-- GEMELDET wurde — ein Schnappschuss, der sich nie mehr aendert. Beides zu
-- vermischen hiesse, die Vergangenheit umschreiben zu koennen.

-- Welche der beiden Meldungen: der Marktplatz meldet seine Betriebe, ein
-- Betrieb meldet seine Eigentuemer.
do $$
begin
    if not exists (select 1 from pg_type where typname = 'dac7_meldungsart') then
        create type public.dac7_meldungsart as enum ('marktplatz', 'betrieb');
    end if;
end$$;

-- Der Lebenszyklus eines Laufs. 'entwurf' darf neu berechnet werden,
-- 'abgegeben' nie wieder — ab dann existiert er in den Buechern der Behoerde.
do $$
begin
    if not exists (select 1 from pg_type where typname = 'dac7_lauf_status') then
        create type public.dac7_lauf_status as enum (
            'entwurf', 'abgegeben', 'ersetzt'
        );
    end if;
end$$;

create table if not exists public.dac7_meldelaeufe (
    id uuid primary key default gen_random_uuid(),

    -- Wessen Meldung. Bei der Marktplatz-Meldung ist das unser eigener
    -- Betreiber-Tenant, bei der Betriebs-Meldung der meldende Betrieb.
    tenant_id uuid not null references public.tenants (id) on delete cascade,

    art public.dac7_meldungsart not null,

    -- Der Meldezeitraum ist stets ein Kalenderjahr.
    jahr integer not null,

    -- Empfangende Behoerde (ISO-3166-1 alpha-2). Erste Umsetzung: DK.
    -- Bewusst eine Spalte und kein Hardcode: derselbe Lauf-Datensatz traegt
    -- spaeter die deutsche DPI-XML-Meldung.
    behoerde_land char(2) not null,

    status public.dac7_lauf_status not null default 'entwurf',

    -- DPI401 neu, DPI402 Korrektur/Loeschung, DPI403 Nullmeldung.
    meldeart text not null,

    -- Die Kennungen der Nachricht und des Betreibersatzes. Sie werden fuer
    -- Korrekturen gebraucht und muessen deshalb reproduzierbar bleiben.
    melde_ref_id text not null,
    betreiber_doc_ref_id text not null,

    -- Auf welchen Lauf sich eine Korrektur bezieht.
    korrigiert_lauf_id uuid references public.dac7_meldelaeufe (id),

    -- Kennzahlen des Laufs, damit eine Uebersicht ohne Nachrechnen auskommt.
    anzahl_anbieter integer not null default 0,
    anzahl_einheiten integer not null default 0,
    anzahl_buchungen integer not null default 0,

    -- Pruefsumme der erzeugten Datei. Belegt, dass die abgegebene Datei
    -- dieselbe ist, die hier dokumentiert wird.
    datei_pruefsumme text,
    datei_name text,

    -- Der Pruefbericht des Laufs (Fehler, Hinweise, Ausschluesse mit Grund).
    -- Als jsonb, weil seine Struktur sich mit den Formaten weiterentwickelt,
    -- der abgelegte Bericht aber unveraendert lesbar bleiben muss.
    pruefbericht jsonb not null default '{}'::jsonb,

    erstellt_von uuid references public.users (id),
    abgegeben_am timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- Das Meldejahr ist ein Kalenderjahr; DAC7 gilt ab 2023.
    constraint dac7_meldelaeufe_jahr_plausibel
        check (jahr between 2023 and 2100),

    -- Nur die drei Meldearten der Vorlage.
    constraint dac7_meldelaeufe_meldeart_gueltig
        check (meldeart in ('DPI401', 'DPI402', 'DPI403')),

    -- Ein abgegebener Lauf braucht seinen Abgabezeitpunkt: ohne ihn laesst
    -- sich die Einhaltung der Frist nicht belegen.
    constraint dac7_meldelaeufe_abgabe_datiert
        check (status <> 'abgegeben' or abgegeben_am is not null),

    -- Eine Korrektur ohne Bezug auf den korrigierten Lauf ist keine.
    constraint dac7_meldelaeufe_korrektur_hat_bezug
        check (meldeart <> 'DPI402' or korrigiert_lauf_id is not null)
);

-- Je Betrieb, Jahr, Art und Behoerde darf es nur EINEN abgegebenen Lauf
-- geben. Entwuerfe und ersetzte Laeufe bleiben davon unberuehrt — nur der
-- gueltige Stand ist eindeutig.
create unique index if not exists dac7_meldelaeufe_ein_abgegebener_uidx
    on public.dac7_meldelaeufe (tenant_id, jahr, art, behoerde_land)
    where status = 'abgegeben';

create index if not exists dac7_meldelaeufe_tenant_jahr_idx
    on public.dac7_meldelaeufe (tenant_id, jahr desc);


-- Die gemeldeten Anbieter eines Laufs samt ihrer Kennung.
--
-- Diese Tabelle ist der Grund, warum Korrekturen moeglich sind: Sie haelt
-- fest, unter welcher RS_DOC_REF_ID ein Anbieter gemeldet wurde.
create table if not exists public.dac7_meldelauf_anbieter (
    id uuid primary key default gen_random_uuid(),
    lauf_id uuid not null
        references public.dac7_meldelaeufe (id) on delete cascade,

    -- Die Kennung, auf die eine spaetere Korrektur verweist.
    doc_ref_id text not null,

    -- Wer der Anbieter in unseren Daten ist. Nullable, weil ein Anbieter
    -- geloescht sein kann, waehrend die Meldung bestehen bleibt — die
    -- Meldung ist ein Schnappschuss der Vergangenheit.
    owner_id uuid,
    anbieter_tenant_id uuid references public.tenants (id) on delete set null,

    -- Was gemeldet wurde, als Schnappschuss. Nicht als Verweis auf die
    -- Stammdaten: aendert der Anbieter spaeter seinen Namen, bleibt die
    -- Meldung trotzdem das, was sie war.
    ist_person boolean not null,
    anzeigename text not null,
    satzart text not null,

    created_at timestamptz not null default now(),

    constraint dac7_meldelauf_anbieter_satzart_gueltig
        check (satzart in ('OECD0', 'OECD1', 'OECD2', 'OECD3')),

    -- Innerhalb eines Laufs muss die Kennung eindeutig sein, sonst ordnet
    -- die Behoerde Taetigkeiten dem falschen Anbieter zu.
    constraint dac7_meldelauf_anbieter_kennung_eindeutig
        unique (lauf_id, doc_ref_id)
);

create index if not exists dac7_meldelauf_anbieter_lauf_idx
    on public.dac7_meldelauf_anbieter (lauf_id);


-- Welche Buchungen in welche gemeldete Zahl eingeflossen sind.
--
-- Das ist die Antwort auf "woher kommt dieser Betrag". Eine Zeile je
-- Buchung und Meldeeinheit.
create table if not exists public.dac7_meldelauf_belege (
    id uuid primary key default gen_random_uuid(),
    lauf_id uuid not null
        references public.dac7_meldelaeufe (id) on delete cascade,
    anbieter_id uuid not null
        references public.dac7_meldelauf_anbieter (id) on delete cascade,

    -- Die Meldeeinheit, in der diese Buchung aufgeht (Anschrift als Text,
    -- weil sie zum Meldezeitpunkt so lautete).
    einheit_anschrift text not null,

    reservation_id uuid,
    -- Der Betrag, mit dem diese Buchung in die Meldung einging, und das
    -- Quartal, in das sie fiel. Beides festgehalten, damit die Summe
    -- nachgerechnet werden kann, ohne die Buchung erneut zu bewerten.
    betrag numeric(14, 2) not null,
    waehrung char(3) not null,
    quartal smallint not null,

    created_at timestamptz not null default now(),

    constraint dac7_meldelauf_belege_quartal_gueltig
        check (quartal between 1 and 4)
);

create index if not exists dac7_meldelauf_belege_lauf_idx
    on public.dac7_meldelauf_belege (lauf_id);
create index if not exists dac7_meldelauf_belege_anbieter_idx
    on public.dac7_meldelauf_belege (anbieter_id);
create index if not exists dac7_meldelauf_belege_reservation_idx
    on public.dac7_meldelauf_belege (reservation_id);


-- ZUGRIFF (Wurzel 6): Steuermeldungen enthalten Steuer-IDs, Geburtsdaten und
-- Kontokennungen — die sensibelsten Daten im System. Ein eingeloggter Nutzer
-- mit dem oeffentlichen anon-Key spricht PostgREST direkt an und umgeht den
-- FastAPI-Layer vollstaendig. RLS allein reicht daher NICHT: erst das
-- pauschale Tabellen-GRANT entziehen, dann restriktive Policy.
alter table public.dac7_meldelaeufe enable row level security;
alter table public.dac7_meldelauf_anbieter enable row level security;
alter table public.dac7_meldelauf_belege enable row level security;

revoke select, insert, update, delete on public.dac7_meldelaeufe
    from anon, authenticated;
revoke select, insert, update, delete on public.dac7_meldelauf_anbieter
    from anon, authenticated;
revoke select, insert, update, delete on public.dac7_meldelauf_belege
    from anon, authenticated;

-- Restriktiv und `for all`: eine Policy nur `for select` liesse den
-- SCHREIB-Pfad tenant-weit offen.
drop policy if exists dac7_meldelaeufe_tenant_restrict on public.dac7_meldelaeufe;
create policy dac7_meldelaeufe_tenant_restrict
    on public.dac7_meldelaeufe
    as restrictive
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Die Kindtabellen haengen ueber den Lauf am Mandanten.
drop policy if exists dac7_meldelauf_anbieter_restrict
    on public.dac7_meldelauf_anbieter;
create policy dac7_meldelauf_anbieter_restrict
    on public.dac7_meldelauf_anbieter
    as restrictive
    for all
    using (
        exists (
            select 1
            from public.dac7_meldelaeufe lauf
            where lauf.id = dac7_meldelauf_anbieter.lauf_id
              and lauf.tenant_id = public.current_tenant_id()
        )
    )
    with check (
        exists (
            select 1
            from public.dac7_meldelaeufe lauf
            where lauf.id = dac7_meldelauf_anbieter.lauf_id
              and lauf.tenant_id = public.current_tenant_id()
        )
    );

drop policy if exists dac7_meldelauf_belege_restrict
    on public.dac7_meldelauf_belege;
create policy dac7_meldelauf_belege_restrict
    on public.dac7_meldelauf_belege
    as restrictive
    for all
    using (
        exists (
            select 1
            from public.dac7_meldelaeufe lauf
            where lauf.id = dac7_meldelauf_belege.lauf_id
              and lauf.tenant_id = public.current_tenant_id()
        )
    )
    with check (
        exists (
            select 1
            from public.dac7_meldelaeufe lauf
            where lauf.id = dac7_meldelauf_belege.lauf_id
              and lauf.tenant_id = public.current_tenant_id()
        )
    );

comment on table public.dac7_meldelaeufe is
    'Abgegebene und geplante DAC7-Meldungen. Ein abgegebener Lauf wird nie '
    'geaendert — Korrekturen entstehen als neuer Lauf mit Bezug auf ihn.';
comment on table public.dac7_meldelauf_anbieter is
    'Die gemeldeten Anbieter je Lauf samt RS_DOC_REF_ID. Ohne diese Kennung '
    'ist keine Korrekturmeldung moeglich.';
comment on table public.dac7_meldelauf_belege is
    'Welche Buchung mit welchem Betrag in welche gemeldete Zahl einging — '
    'die Antwort auf die Rueckfrage der Behoerde.';
