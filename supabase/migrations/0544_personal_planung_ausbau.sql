-- 0544 — Personal: Dienstplan-Ausbau, Zeiterfassung-Terminal, zweistufige
-- Abwesenheit, terminierte Akte-Änderungen (Freigabe des Betreibers 04.09.2026,
-- Abgleich gegen Taskilo und Gastromatic; Konzept docs/PERSONAL-DIENSTPLAN-KONZEPT.md §8)
--
-- Was hier dazukommt und warum:
--   * Betriebsregeln: Jugendschutz, zweistufige Genehmigung, Höchstdauer
--     zusammenhängender Urlaub, GPS-Regel, Einstempel-Regel „ab Schichtbeginn",
--     Verspätungsmeldung, Terminal-Freigabe, Wetteranzeige. Alle Werte sind
--     Konfiguration je Betrieb — nichts davon ist ein Hardcode (Wurzel 4).
--   * Akte: Verdienstgrenze je Person (Gastromatic „Max. Verdienst", Aushilfen),
--     Stempel-ID (vierstellig) und PIN-Hash für das Terminal.
--   * Terminierte Akte-Änderungen („Änderung ab 01.07.26"): der Worker wendet
--     sie am Stichtag an, der Plan rechnet Soll ab Stichtag mit dem neuen Wert.
--   * Wochenvorlagen: ein Wochengerüst speichern und auf eine Woche anwenden.
--   * Schichttausch: Person bietet ihre Schicht einer Kollegin an, die annimmt,
--     die Planung gibt frei. Erst mit der Freigabe wechselt die Schicht (Wurzel 1:
--     der Tausch schreibt zwei Schichten in EINEM Schritt).
--   * Überstundenanträge und Guttage (eigene Konten wie bei Gastromatic).
--   * Terminals: ein Gerät je Rezeption mit eigenem Token; Stempeln per
--     Stempel-ID + PIN, nie mit einem Nutzer-Login (der Bildschirm ist öffentlich).
--   * Wetter-Cache (Open-Meteo, je Koordinate und Tag) — global, ohne Personenbezug.
--
-- Schutz (Wurzel 6): jede neue Tabelle enable rls + Tenant-Policy +
-- `revoke all from anon, authenticated`. `grant select` nur dort, wo eine
-- Realtime-Liste es braucht — dann mit restriktiver Personen-Policy und
-- `with check (false)` (Schreiben ausschließlich über die API).

-- ============================================================================
-- 1) Betriebsregeln
-- ============================================================================
alter table public.personal_regeln
    -- Jugendschutz: NULL = keine Prüfung. Werte kommen aus dem Ländervorschlag
    -- (laender.py), z. B. DE JArbSchG: bis 18, 8 h/Tag, 20:00–06:00.
    add column if not exists jugendschutz_bis_alter        smallint
        check (jugendschutz_bis_alter is null or jugendschutz_bis_alter between 14 and 21),
    add column if not exists jugendschutz_max_tagesstunden numeric(4,1)
        check (jugendschutz_max_tagesstunden is null or jugendschutz_max_tagesstunden between 1 and 12),
    add column if not exists jugendschutz_nacht_von        time,
    add column if not exists jugendschutz_nacht_bis        time,
    -- Abwesenheit: zweistufig = Schichtleitung vorgenehmigt, Leitung entscheidet.
    add column if not exists zweistufige_genehmigung       boolean not null default false,
    add column if not exists max_urlaub_zusammenhaengend_tage smallint
        check (max_urlaub_zusammenhaengend_tage is null or max_urlaub_zusammenhaengend_tage >= 1),
    -- Zeiterfassung
    add column if not exists gps_pflicht                   boolean not null default false,
    add column if not exists gps_radius_m                  integer not null default 250
        check (gps_radius_m between 25 and 5000),
    -- Arbeitszeit zählt frühestens ab dem geplanten Schichtbeginn (Gastromatic
    -- „Einstempel-Regel"); wer 20 Minuten früher stempelt, sammelt keine Zeit.
    add column if not exists stempel_ab_schichtbeginn      boolean not null default false,
    -- Verspätung (Minuten nach Schichtbeginn ohne Stempelung) → Meldung an die
    -- Leitung. NULL = aus.
    add column if not exists verspaetung_melden_min        smallint
        check (verspaetung_melden_min is null or verspaetung_melden_min between 1 and 240),
    add column if not exists terminal_aktiv                boolean not null default false,
    add column if not exists wetter_anzeigen               boolean not null default true;

alter table public.personal_regeln drop constraint if exists personal_regeln_jugendschutz_paar;
alter table public.personal_regeln add constraint personal_regeln_jugendschutz_paar
    check (
        (jugendschutz_bis_alter is null and jugendschutz_max_tagesstunden is null
            and jugendschutz_nacht_von is null and jugendschutz_nacht_bis is null)
        or (jugendschutz_bis_alter is not null and jugendschutz_max_tagesstunden is not null)
    );

-- ============================================================================
-- 2) Akte: Verdienstgrenze, Stempel-ID, Terminal-PIN
-- ============================================================================
alter table public.personal_akten
    add column if not exists verdienstgrenze_minor    integer
        check (verdienstgrenze_minor is null or verdienstgrenze_minor >= 0),
    add column if not exists verdienstgrenze_zeitraum text
        check (verdienstgrenze_zeitraum is null or verdienstgrenze_zeitraum in ('monat', 'jahr')),
    -- Vierstellige Kennung für das Terminal (Gastromatic wetime: „vierstellige
    -- ID"). Eindeutig je Betrieb; NULL = kein Terminal-Zugang.
    add column if not exists stempel_id               text
        check (stempel_id is null or stempel_id ~ '^[0-9]{4}$'),
    -- PIN nur als Hash (Argon2/PBKDF2, siehe core.security). Nie im Klartext.
    add column if not exists terminal_pin_hash        text;

alter table public.personal_akten drop constraint if exists personal_akten_verdienstgrenze_paar;
alter table public.personal_akten add constraint personal_akten_verdienstgrenze_paar
    check ((verdienstgrenze_minor is null) = (verdienstgrenze_zeitraum is null));
-- Eine Grenze ohne Währung ist kein Betrag (Wurzel 4).
alter table public.personal_akten drop constraint if exists personal_akten_verdienstgrenze_mit_waehrung;
alter table public.personal_akten add constraint personal_akten_verdienstgrenze_mit_waehrung
    check (verdienstgrenze_minor is null or currency is not null);
create unique index if not exists personal_akten_stempel_id_uq
    on public.personal_akten (tenant_id, stempel_id) where stempel_id is not null;

-- ============================================================================
-- 3) Terminierte Akte-Änderungen (§)
-- ============================================================================
create table if not exists public.personal_akte_aenderungen (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants (id) on delete cascade,
    user_id        uuid not null references public.users (id) on delete cascade,
    gueltig_ab     date not null,
    -- Teilmenge der Akte-Felder (Pydantic AkteUpdate): {"wochenstunden": 30,
    -- "stundenlohn_minor": 1650, "position": "Rezeptionsleitung"}.
    felder         jsonb not null,
    grund          text,
    angewendet_am  timestamptz,
    erstellt_von   uuid references public.users (id) on delete set null,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    constraint personal_akte_aenderungen_felder_objekt check (jsonb_typeof(felder) = 'object')
);
create index if not exists personal_akte_aenderungen_faellig_idx
    on public.personal_akte_aenderungen (tenant_id, gueltig_ab) where angewendet_am is null;
alter table public.personal_akte_aenderungen enable row level security;
drop policy if exists personal_akte_aenderungen_tenant on public.personal_akte_aenderungen;
create policy personal_akte_aenderungen_tenant on public.personal_akte_aenderungen
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_akte_aenderungen from anon, authenticated;
drop trigger if exists personal_akte_aenderungen_updated_at on public.personal_akte_aenderungen;
create trigger personal_akte_aenderungen_updated_at
    before update on public.personal_akte_aenderungen
    for each row execute function public.set_updated_at();

-- ============================================================================
-- 4) Wochenvorlagen (Gerüst) + ihre Schichten
-- ============================================================================
create table if not exists public.personal_wochenvorlagen (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants (id) on delete cascade,
    name          text not null,
    notiz         text,
    erstellt_von  uuid references public.users (id) on delete set null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    unique (tenant_id, name)
);
alter table public.personal_wochenvorlagen enable row level security;
drop policy if exists personal_wochenvorlagen_tenant on public.personal_wochenvorlagen;
create policy personal_wochenvorlagen_tenant on public.personal_wochenvorlagen
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_wochenvorlagen from anon, authenticated;
drop trigger if exists personal_wochenvorlagen_updated_at on public.personal_wochenvorlagen;
create trigger personal_wochenvorlagen_updated_at
    before update on public.personal_wochenvorlagen
    for each row execute function public.set_updated_at();

create table if not exists public.personal_wochenvorlage_schichten (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    vorlage_id         uuid not null references public.personal_wochenvorlagen (id) on delete cascade,
    wochentag          smallint not null check (wochentag between 0 and 6),
    start_zeit         time not null,
    end_zeit           time not null,
    pause_min          integer not null default 0 check (pause_min >= 0),
    arbeitsbereich_id  uuid references public.personal_arbeitsbereiche (id) on delete set null,
    property_id        uuid references public.properties (id) on delete set null,
    -- NULL = offene Schicht im Gerüst (Bedarf ohne Person).
    user_id            uuid references public.users (id) on delete set null,
    schichtvorlage_id  uuid references public.personal_schichtvorlagen (id) on delete set null,
    notiz              text,
    created_at         timestamptz not null default now()
);
create index if not exists personal_wochenvorlage_schichten_vorlage_idx
    on public.personal_wochenvorlage_schichten (vorlage_id);
alter table public.personal_wochenvorlage_schichten enable row level security;
drop policy if exists personal_wochenvorlage_schichten_tenant on public.personal_wochenvorlage_schichten;
create policy personal_wochenvorlage_schichten_tenant on public.personal_wochenvorlage_schichten
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_wochenvorlage_schichten from anon, authenticated;

-- Herkunft „aus Wochenvorlage" an der Schicht.
alter table public.personal_schichten drop constraint if exists personal_schichten_quelle_check;
alter table public.personal_schichten add constraint personal_schichten_quelle_check
    check (quelle in ('manuell', 'vorlage', 'bedarf_aufgabe', 'abwesenheit', 'kopie',
                      'wochenvorlage', 'tausch', 'autoplan', 'bedarf'));

-- ============================================================================
-- 5) Schichttausch (R)
-- ============================================================================
create table if not exists public.personal_schicht_tausch (
    id                uuid primary key default gen_random_uuid(),
    tenant_id         uuid not null references public.tenants (id) on delete cascade,
    schicht_id        uuid not null references public.personal_schichten (id) on delete cascade,
    -- Wer gibt (Inhaber der Schicht) und wer nimmt.
    von_user_id       uuid not null references public.users (id) on delete cascade,
    an_user_id        uuid not null references public.users (id) on delete cascade,
    -- Direkter Tausch: die Gegen-Schicht der annehmenden Person (NULL = Abgabe).
    gegen_schicht_id  uuid references public.personal_schichten (id) on delete set null,
    status            text not null default 'angefragt'
        check (status in ('angefragt', 'angenommen', 'abgelehnt', 'freigegeben', 'verworfen')),
    grund             text,
    kommentar         text,
    angenommen_am     timestamptz,
    entschieden_von   uuid references public.users (id) on delete set null,
    entschieden_am    timestamptz,
    erstellt_von      uuid references public.users (id) on delete set null,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    constraint personal_schicht_tausch_zwei_personen check (von_user_id <> an_user_id)
);
create index if not exists personal_schicht_tausch_schicht_idx
    on public.personal_schicht_tausch (tenant_id, schicht_id);
create index if not exists personal_schicht_tausch_status_idx
    on public.personal_schicht_tausch (tenant_id, status);
-- Je Schicht höchstens EINE offene Anfrage (Wurzel 2: Doppelklick = eine Zeile).
create unique index if not exists personal_schicht_tausch_offen_uq
    on public.personal_schicht_tausch (schicht_id) where status in ('angefragt', 'angenommen');
alter table public.personal_schicht_tausch enable row level security;
drop policy if exists personal_schicht_tausch_tenant on public.personal_schicht_tausch;
create policy personal_schicht_tausch_tenant on public.personal_schicht_tausch
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
drop policy if exists personal_schicht_tausch_scope on public.personal_schicht_tausch;
create policy personal_schicht_tausch_scope on public.personal_schicht_tausch
    as restrictive for all
    using (public.personal_sieht_person(von_user_id) or public.personal_sieht_person(an_user_id))
    with check (false);
revoke all on public.personal_schicht_tausch from anon, authenticated;
grant select on public.personal_schicht_tausch to authenticated;
drop trigger if exists personal_schicht_tausch_updated_at on public.personal_schicht_tausch;
create trigger personal_schicht_tausch_updated_at
    before update on public.personal_schicht_tausch
    for each row execute function public.set_updated_at();

-- ============================================================================
-- 6) Überstundenanträge (R) und Guttage (§)
-- ============================================================================
create table if not exists public.personal_ueberstunden_antraege (
    id                uuid primary key default gen_random_uuid(),
    tenant_id         uuid not null references public.tenants (id) on delete cascade,
    user_id           uuid not null references public.users (id) on delete cascade,
    datum             date not null,
    minuten           integer not null check (minuten > 0 and minuten <= 720),
    grund             text not null check (char_length(grund) >= 3),
    status            text not null default 'beantragt'
        check (status in ('beantragt', 'genehmigt', 'abgelehnt')),
    zeiterfassung_id  uuid references public.personal_zeiterfassung (id) on delete set null,
    kommentar         text,
    entschieden_von   uuid references public.users (id) on delete set null,
    entschieden_am    timestamptz,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index if not exists personal_ueberstunden_antraege_person_idx
    on public.personal_ueberstunden_antraege (tenant_id, user_id, datum);
alter table public.personal_ueberstunden_antraege enable row level security;
drop policy if exists personal_ueberstunden_antraege_tenant on public.personal_ueberstunden_antraege;
create policy personal_ueberstunden_antraege_tenant on public.personal_ueberstunden_antraege
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
drop policy if exists personal_ueberstunden_antraege_scope on public.personal_ueberstunden_antraege;
create policy personal_ueberstunden_antraege_scope on public.personal_ueberstunden_antraege
    as restrictive for all
    using (public.personal_sieht_person(user_id))
    with check (false);
revoke all on public.personal_ueberstunden_antraege from anon, authenticated;
grant select on public.personal_ueberstunden_antraege to authenticated;
drop trigger if exists personal_ueberstunden_antraege_updated_at on public.personal_ueberstunden_antraege;
create trigger personal_ueberstunden_antraege_updated_at
    before update on public.personal_ueberstunden_antraege
    for each row execute function public.set_updated_at();

-- Guttage: Anspruch auf freie Tage aus Feiertagsarbeit (positiv) und ihr Abbau
-- (negativ). Konto = Summe; genommene Guttage laufen als Abwesenheit `frei`.
create table if not exists public.personal_guttage (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants (id) on delete cascade,
    user_id         uuid not null references public.users (id) on delete cascade,
    datum           date not null,
    tage            numeric(4,2) not null check (tage <> 0),
    grund           text not null check (grund in ('feiertagsarbeit', 'ausgleich', 'korrektur', 'abbau')),
    abwesenheit_id  uuid references public.personal_abwesenheiten (id) on delete set null,
    notiz           text,
    erstellt_von    uuid references public.users (id) on delete set null,
    created_at      timestamptz not null default now(),
    constraint personal_guttage_korrektur_mit_notiz check (grund <> 'korrektur' or notiz is not null)
);
create index if not exists personal_guttage_person_idx on public.personal_guttage (tenant_id, user_id, datum);
alter table public.personal_guttage enable row level security;
drop policy if exists personal_guttage_tenant on public.personal_guttage;
create policy personal_guttage_tenant on public.personal_guttage
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_guttage from anon, authenticated;

-- ============================================================================
-- 7) Terminals (§) und Stempel-Quelle 'terminal'
-- ============================================================================
create table if not exists public.personal_terminals (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    name               text not null,
    property_id        uuid references public.properties (id) on delete set null,
    -- SHA-256 des Geräte-Tokens; das Token selbst wird EINMAL beim Anlegen gezeigt.
    token_hash         text not null unique,
    aktiv              boolean not null default true,
    letzter_kontakt_am timestamptz,
    erstellt_von       uuid references public.users (id) on delete set null,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    unique (tenant_id, name)
);
alter table public.personal_terminals enable row level security;
drop policy if exists personal_terminals_tenant on public.personal_terminals;
create policy personal_terminals_tenant on public.personal_terminals
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_terminals from anon, authenticated;
drop trigger if exists personal_terminals_updated_at on public.personal_terminals;
create trigger personal_terminals_updated_at
    before update on public.personal_terminals
    for each row execute function public.set_updated_at();

alter table public.personal_zeiterfassung
    add column if not exists terminal_id uuid references public.personal_terminals (id) on delete set null,
    -- Verspätung gegenüber der geplanten Schicht in Minuten (vom Server beim
    -- Einstempeln gerechnet; NULL = keine Schicht oder pünktlich).
    add column if not exists verspaetung_min integer check (verspaetung_min is null or verspaetung_min >= 0);
alter table public.personal_zeiterfassung drop constraint if exists personal_zeiterfassung_quelle_check;
alter table public.personal_zeiterfassung add constraint personal_zeiterfassung_quelle_check
    check (quelle in ('web', 'app', 'korrektur', 'import', 'terminal'));

-- ============================================================================
-- 8) Abwesenheit: zweistufige Genehmigung
-- ============================================================================
alter table public.personal_abwesenheiten
    add column if not exists vorentschieden_von uuid references public.users (id) on delete set null,
    add column if not exists vorentschieden_am  timestamptz;
alter table public.personal_abwesenheiten drop constraint if exists personal_abwesenheiten_status_check;
alter table public.personal_abwesenheiten add constraint personal_abwesenheiten_status_check
    check (status in ('beantragt', 'vorgenehmigt', 'genehmigt', 'abgelehnt', 'storniert'));

-- ============================================================================
-- 9) Wetter-Cache (G) — Open-Meteo je gerundeter Koordinate und Tag
-- ============================================================================
create table if not exists public.wetter_tage (
    id               uuid primary key default gen_random_uuid(),
    -- Auf zwei Stellen gerundet (~1 km): Objekte am selben Ort teilen den Eintrag.
    lat              numeric(7,2) not null,
    lng              numeric(7,2) not null,
    datum            date not null,
    temp_min         numeric(4,1),
    temp_max         numeric(4,1),
    -- WMO-Wettercode (Open-Meteo `weathercode`).
    code             smallint,
    niederschlag_mm  numeric(6,1),
    quelle           text not null default 'open-meteo',
    geholt_am        timestamptz not null default now(),
    unique (lat, lng, datum)
);
alter table public.wetter_tage enable row level security;
drop policy if exists wetter_tage_lesen on public.wetter_tage;
create policy wetter_tage_lesen on public.wetter_tage for select using (true);
revoke all on public.wetter_tage from anon, authenticated;
grant select on public.wetter_tage to authenticated;

-- ============================================================================
-- 10) Realtime
-- ============================================================================
do $$
declare
    t text;
begin
    foreach t in array array['personal_schicht_tausch', 'personal_ueberstunden_antraege'] loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and tablename = t
        ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end $$;

comment on table public.personal_schicht_tausch is
  'Schichttausch (0544): Inhaber bietet an, Kollegin nimmt an, Planung gibt frei. '
  'Erst die Freigabe schreibt beide Schichten. Eine offene Anfrage je Schicht.';
comment on table public.personal_terminals is
  'Stempel-Terminals (0544): ein Gerät je Standort mit Token-Hash; Personen stempeln '
  'per Stempel-ID + PIN aus personal_akten. Kein Nutzer-Login am öffentlichen Bildschirm.';
comment on table public.wetter_tage is
  'Wettervorhersage je Koordinate (2 Stellen) und Tag aus Open-Meteo (0544). Global, '
  'kein Personenbezug; im Dienstplan-Kopf je Tag angezeigt.';
