-- 0541 — Personal & Dienstplan (Slice `personal`), Rolle `shift_lead` in den
-- Scope-Helfern, Feiertage. Die Benachrichtigungs-Spalten stehen in 0542.
--
-- Grundlage: docs/PERSONAL-DIENSTPLAN-KONZEPT.md (Entscheidungen des
-- Betreibers vom 03.09.2026) und ADR-0023. Gastromatic für Reinigungs-,
-- Wäsche- und Hausmeisterpersonal eines Ferienwohnungs-Verwalters: Akte,
-- Dienstplan, Abwesenheit, Zeiterfassung, Konten, Lohnvorbereitung.
--
-- SCHUTZMODELL (Wurzel 6) — drei Klassen von Tabellen:
--   (§)  Nur der Server (service_role) liest und schreibt: Akte, Dokumente,
--        Urlaubskonten, Zeitkorrekturen, Arbeitszeitkonten, Monatsabschlüsse,
--        Regeln, Fremdfirmen. `revoke all … from anon, authenticated`.
--   (R)  Realtime-Quellen: personal_schichten, personal_abwesenheiten,
--        personal_zeiterfassung. Nur `grant select`, dazu eine RESTRIKTIVE
--        `for all`-Policy: Lesen nach Personen-Scope (`personal_sieht_person`),
--        Schreiben über den Direktpfad für niemanden (`with check (false)`).
--   (G)  Global ohne Personenbezug: `feiertage` — lesbar für authenticated.
-- Neue Tabellen bekommen per Default-Privileges (0187/0229) KEINE Grants; die
-- Einträge unten sind trotzdem explizit, damit die Absicht im Text steht.
--
-- ZEITEN: Kalendertag (`datum`) ist der Tag in der Zeitzone des Objekts bzw.
-- des Betriebs; `start_at`/`end_at` sind timestamptz. Dieselbe Trennung wie im
-- Aufgabenkalender (Tages-Anker ≠ UTC-Zeitpunkt). Die Zeitpunkte von
-- Handlungen (`bestaetigt_am`, `entschieden_am`, …) sind UNSERE Handlungen
-- — Wurzel 5b ist hier nicht berührt, weil es keine fremde Quelle gibt.

-- ============================================================================
-- 1) Scope-Helfer um `shift_lead` erweitern (Wurzel 6, fail-closed)
-- ============================================================================
-- Die Schichtleitung verhält sich beim Objekt-Scope wie ein Mitarbeiter: sie
-- sieht die Objekte, die ihr über `staff_property_assignments` freigegeben sind.
-- Ohne diese Erweiterung fiele `shift_lead` in `staff_can_see_task` (0403) in
-- den „nicht Mitarbeiter"-Ast und sähe pauschal ALLE Aufgaben des Mandanten —
-- fail-OPEN durch eine unbekannte Rolle, genau der Fehler aus 0425.

create or replace function public.staff_can_see_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when public.current_user_role() in ('admin', 'co_admin') then true
      when public.current_user_role() in ('staff', 'cleaner', 'shift_lead') then exists (
        select 1
        from public.staff_property_assignments a
        where a.property_id = p_property_id
          and a.user_id = auth.uid()
          and a.tenant_id = public.current_tenant_id()
      )
      -- owner regelt `owner_can_see_property`; NULL/unbekannt sieht nichts.
      when public.current_user_role() = 'owner' then true
      else false
    end
$$;

create or replace function public.owner_can_see_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when public.current_user_role() in ('admin', 'co_admin') then true
      when public.current_user_role() = 'owner' then exists (
        select 1
        from public.owner_property_assignments a
        where a.property_id = p_property_id
          and a.user_id = auth.uid()
          and a.tenant_id = public.current_tenant_id()
      )
      -- staff/cleaner/shift_lead regelt `staff_can_see_property`; alles
      -- andere (NULL, unbekannt) sieht hier nichts. Fail-closed (Wurzel 6).
      when public.current_user_role() in ('staff', 'cleaner', 'shift_lead') then true
      else false
    end
$$;

create or replace function public.staff_can_see_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when public.current_user_role() is null
        or public.current_user_role() not in ('staff', 'cleaner', 'shift_lead')
        then true
      else exists (
        select 1
        from public.tasks t
        where t.id = p_task_id
          and t.tenant_id = public.current_tenant_id()
          and (
            t.property_id is null
            or exists (
              select 1
              from public.staff_property_assignments a
              where a.property_id = t.property_id
                and a.user_id = auth.uid()
                and a.tenant_id = public.current_tenant_id()
            )
          )
      )
    end
$$;

-- Diagnose-/Rohdaten-Tabellen (0133): die Schichtleitung ist operativ, kein
-- Vertriebs- oder Finanzeinblick (§4.3) — in die Ausschlussliste aufnehmen.
drop policy if exists channex_webhook_event_read on public.channex_webhook_event;
create policy channex_webhook_event_read on public.channex_webhook_event
    for select
    using (
        tenant_id = public.current_tenant_id()
        and coalesce(public.current_user_role(), 'admin')
            not in ('owner', 'staff', 'cleaner', 'shift_lead')
    );

drop policy if exists channex_debug_log_read on public.channex_debug_log;
create policy channex_debug_log_read on public.channex_debug_log
    for select
    using (
        tenant_id = public.current_tenant_id()
        and coalesce(public.current_user_role(), 'admin')
            not in ('owner', 'staff', 'cleaner', 'shift_lead')
    );

-- ============================================================================
-- 2) Personen-Scope für den Personalbereich
-- ============================================================================
-- Wer darf die Personal-Zeilen (Schichten, Abwesenheiten, Zeiten) einer Person
-- sehen? admin/co_admin: alle im Mandanten. shift_lead: sich selbst und jede
-- Person, die an einem Objekt eingeteilt ist, das auch der Schichtleitung
-- freigegeben ist. staff/cleaner: nur sich selbst. Alles andere: nichts.
create or replace function public.personal_sieht_person(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when public.current_user_role() in ('admin', 'co_admin') then true
      when public.current_user_role() = 'shift_lead' then
        p_user_id = auth.uid()
        or exists (
          select 1
          from public.staff_property_assignments mich
          join public.staff_property_assignments sie
            on sie.property_id = mich.property_id
           and sie.tenant_id = mich.tenant_id
          where mich.user_id = auth.uid()
            and mich.tenant_id = public.current_tenant_id()
            and sie.user_id = p_user_id
        )
      when public.current_user_role() in ('staff', 'cleaner') then p_user_id = auth.uid()
      else false
    end
$$;
comment on function public.personal_sieht_person(uuid) is
  'Personen-Scope des Personalbereichs (0541). admin/co_admin alle, shift_lead '
  'sich selbst + Personen an gemeinsam freigegebenen Objekten, staff/cleaner '
  'nur sich selbst. Fail-closed.';

-- Offene Schichten (Bedarf, `user_id is null`) hängen an einem Objekt:
-- sichtbar für admin/co_admin und für jede Person, der das Objekt freigegeben
-- ist (sie soll sich bewerben können).
create or replace function public.personal_sieht_schicht(p_user_id uuid, p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when p_user_id is not null then public.personal_sieht_person(p_user_id)
      when public.current_user_role() in ('admin', 'co_admin') then true
      when p_property_id is null then false
      else public.staff_can_see_property(p_property_id)
    end
$$;

-- ============================================================================
-- 3) Stammdaten: Fremdfirmen, Arbeitsbereiche, Regeln, Pausenmodelle,
--    Schichtvorlagen
-- ============================================================================
create table if not exists public.personal_fremdfirmen (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenants (id) on delete cascade,
    name             text not null,
    kontakt_name     text,
    kontakt_email    text,
    kontakt_telefon  text,
    -- Abrechnung mit der Firma: je Einsatz oder je Stunde. Der Satz ist ein
    -- Vertragswert, kein Lohn — externe Kräfte haben keine Lohnfelder (E2).
    abrechnung       text not null check (abrechnung in ('je_einsatz', 'je_stunde')),
    satz_minor       integer check (satz_minor is null or satz_minor >= 0),
    currency         text check (currency is null or currency ~ '^[A-Z]{3}$'),
    notiz            text,
    archived_at      timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    -- Ein Satz ohne Währung ist kein Betrag (Wurzel 4).
    constraint personal_fremdfirmen_satz_mit_waehrung
        check ((satz_minor is null) = (currency is null))
);
create index if not exists personal_fremdfirmen_tenant_idx
    on public.personal_fremdfirmen (tenant_id);
alter table public.personal_fremdfirmen enable row level security;
drop policy if exists personal_fremdfirmen_tenant on public.personal_fremdfirmen;
create policy personal_fremdfirmen_tenant on public.personal_fremdfirmen
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_fremdfirmen from anon, authenticated;
drop trigger if exists personal_fremdfirmen_updated_at on public.personal_fremdfirmen;
create trigger personal_fremdfirmen_updated_at
    before update on public.personal_fremdfirmen
    for each row execute function public.set_updated_at();

create table if not exists public.personal_arbeitsbereiche (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants (id) on delete cascade,
    name         text not null,
    kurz         text not null check (char_length(kurz) between 1 and 4),
    farbe        text not null check (farbe ~ '^#[0-9a-fA-F]{6}$'),
    sort         integer not null default 0,
    archived_at  timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    unique (tenant_id, name)
);
alter table public.personal_arbeitsbereiche enable row level security;
drop policy if exists personal_arbeitsbereiche_tenant on public.personal_arbeitsbereiche;
create policy personal_arbeitsbereiche_tenant on public.personal_arbeitsbereiche
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
-- Lesen darf jeder im Mandanten (Name, Farbe — kein Personenbezug), Schreiben
-- nur der Server.
revoke all on public.personal_arbeitsbereiche from anon, authenticated;
grant select on public.personal_arbeitsbereiche to authenticated;
drop trigger if exists personal_arbeitsbereiche_updated_at on public.personal_arbeitsbereiche;
create trigger personal_arbeitsbereiche_updated_at
    before update on public.personal_arbeitsbereiche
    for each row execute function public.set_updated_at();

-- Betriebsregeln — EINE Zeile je Mandant. Das Land kommt aus `tenants.country`
-- und steht hier nur als Bestätigung („Regeln gelten für DK"); die Werte selbst
-- sind Entscheidungen des Betriebs, vorgeschlagen aus `personal/laender.py`,
-- gespeichert erst nach Bestätigung (`bestaetigt_am`). Ohne bestätigte Regeln
-- gibt es keine Konfliktprüfung und keine Zuschläge — 422, kein Default.
create table if not exists public.personal_regeln (
    tenant_id                    uuid primary key references public.tenants (id) on delete cascade,
    land                         text not null check (land ~ '^[A-Z]{2}$'),
    feiertage_region             text,
    -- Betriebszone (IANA) für Kalendertag, Nacht-/Sonntagsgrenzen und die
    -- Anzeige. `tenants` trägt keine Zeitzone; ein Objekt schon — hat eine
    -- Schicht ein Objekt, gilt dessen Zone, sonst diese.
    zeitzone                     text not null,
    ruhezeit_stunden             numeric(4,1) not null check (ruhezeit_stunden between 0 and 24),
    max_tagesstunden             numeric(4,1) not null check (max_tagesstunden between 1 and 24),
    max_wochenstunden            numeric(4,1) not null check (max_wochenstunden between 1 and 168),
    nacht_von                    time not null,
    nacht_bis                    time not null,
    zuschlag_nacht_pct           numeric(5,2) not null check (zuschlag_nacht_pct between 0 and 300),
    zuschlag_sonntag_pct         numeric(5,2) not null check (zuschlag_sonntag_pct between 0 and 300),
    zuschlag_feiertag_pct        numeric(5,2) not null check (zuschlag_feiertag_pct between 0 and 300),
    zuschlag_ueberstunden_pct    numeric(5,2) not null check (zuschlag_ueberstunden_pct between 0 and 300),
    urlaubsjahr_start_monat      smallint not null check (urlaubsjahr_start_monat between 1 and 12),
    -- Bis zu welchem Monat des Folgejahres übertragener Urlaub genommen sein
    -- muss (DE: 3 = 31.03., DK: 12 = Ferieloven-Übertrag). NULL = kein Verfall.
    uebertrag_verfall_monat      smallint check (uebertrag_verfall_monat between 1 and 12),
    uebertrag_max_tage           numeric(5,2) check (uebertrag_max_tage >= 0),
    mindest_vorlauf_urlaub_tage  smallint not null default 0 check (mindest_vorlauf_urlaub_tage >= 0),
    -- Lohnexport (E4): DATEV-Kennungen und Lohnarten je Betrieb. Nichts davon
    -- ist erfunden — leer bleibt leer, der Export verweigert dann mit 422.
    datev_berater_nr             text,
    datev_mandanten_nr           text,
    lohnarten                    jsonb not null default '{}'::jsonb,
    bestaetigt_am                timestamptz,
    bestaetigt_von               uuid references public.users (id) on delete set null,
    created_at                   timestamptz not null default now(),
    updated_at                   timestamptz not null default now()
);
alter table public.personal_regeln enable row level security;
drop policy if exists personal_regeln_tenant on public.personal_regeln;
create policy personal_regeln_tenant on public.personal_regeln
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_regeln from anon, authenticated;
drop trigger if exists personal_regeln_updated_at on public.personal_regeln;
create trigger personal_regeln_updated_at
    before update on public.personal_regeln
    for each row execute function public.set_updated_at();

-- Automatische Pausen: ab X Minuten Arbeitszeit Y Minuten Pause. Je Betrieb,
-- optional je Arbeitsbereich (NULL = für alle).
create table if not exists public.personal_pausenmodelle (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    arbeitsbereich_id  uuid references public.personal_arbeitsbereiche (id) on delete cascade,
    ab_minuten         integer not null check (ab_minuten > 0),
    pause_minuten      integer not null check (pause_minuten > 0),
    created_at         timestamptz not null default now()
);
create unique index if not exists personal_pausenmodelle_eindeutig
    on public.personal_pausenmodelle (
        tenant_id,
        coalesce(arbeitsbereich_id, '00000000-0000-0000-0000-000000000000'::uuid),
        ab_minuten
    );
alter table public.personal_pausenmodelle enable row level security;
drop policy if exists personal_pausenmodelle_tenant on public.personal_pausenmodelle;
create policy personal_pausenmodelle_tenant on public.personal_pausenmodelle
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_pausenmodelle from anon, authenticated;

create table if not exists public.personal_schichtvorlagen (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    name               text not null,
    kurz               text not null check (char_length(kurz) between 1 and 4),
    start_zeit         time not null,
    end_zeit           time not null,
    pause_min          integer not null default 0 check (pause_min >= 0),
    farbe              text not null check (farbe ~ '^#[0-9a-fA-F]{6}$'),
    arbeitsbereich_id  uuid references public.personal_arbeitsbereiche (id) on delete set null,
    sort               integer not null default 0,
    archived_at        timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    unique (tenant_id, name)
);
alter table public.personal_schichtvorlagen enable row level security;
drop policy if exists personal_schichtvorlagen_tenant on public.personal_schichtvorlagen;
create policy personal_schichtvorlagen_tenant on public.personal_schichtvorlagen
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_schichtvorlagen from anon, authenticated;
grant select on public.personal_schichtvorlagen to authenticated;
drop trigger if exists personal_schichtvorlagen_updated_at on public.personal_schichtvorlagen;
create trigger personal_schichtvorlagen_updated_at
    before update on public.personal_schichtvorlagen
    for each row execute function public.set_updated_at();

-- ============================================================================
-- 4) Personalakte (§) — 1:1 zu users, Qualifikationen, Dokumente
-- ============================================================================
-- Sensible Kennungen (steuer_id, sv_nummer, iban) liegen AES-GCM-verschlüsselt
-- (Schlüssel PERSONAL_AKTE_KEY, `personal/akte_krypto.py`), damit ein Dump der
-- Tabelle sie nicht preisgibt. Die Spalten heißen deshalb `*_enc`.
create table if not exists public.personal_akten (
    id                     uuid primary key default gen_random_uuid(),
    tenant_id              uuid not null references public.tenants (id) on delete cascade,
    user_id                uuid not null unique references public.users (id) on delete cascade,
    employee_number        text,
    beschaeftigungsart     text not null
        check (beschaeftigungsart in ('vollzeit', 'teilzeit', 'aushilfe', 'extern')),
    firma_id               uuid references public.personal_fremdfirmen (id) on delete restrict,
    position               text,
    eintritt               date,
    austritt               date,
    probezeit_bis          date,
    wochenstunden          numeric(5,2) check (wochenstunden is null or wochenstunden between 0 and 168),
    tagesstunden           numeric(4,2) check (tagesstunden is null or tagesstunden between 0 and 24),
    arbeitstage_je_woche   smallint check (arbeitstage_je_woche is null or arbeitstage_je_woche between 1 and 7),
    stundenlohn_minor      integer check (stundenlohn_minor is null or stundenlohn_minor >= 0),
    gehalt_minor           integer check (gehalt_minor is null or gehalt_minor >= 0),
    currency               text check (currency is null or currency ~ '^[A-Z]{3}$'),
    urlaubsanspruch_tage   numeric(5,2) check (urlaubsanspruch_tage is null or urlaubsanspruch_tage between 0 and 365),
    geburtsdatum           date,
    geburtsort             text,
    staatsangehoerigkeit   text check (staatsangehoerigkeit is null or staatsangehoerigkeit ~ '^[A-Z]{2}$'),
    strasse                text,
    hausnummer             text,
    plz                    text,
    ort                    text,
    land                   text check (land is null or land ~ '^[A-Z]{2}$'),
    notfall_name           text,
    notfall_beziehung      text,
    notfall_telefon        text,
    steuer_id_enc          text,
    sv_nummer_enc          text,
    krankenkasse           text,
    iban_enc               text,
    bic                    text,
    bank_name              text,
    kontoinhaber           text,
    notiz                  text,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now(),
    -- Ein Lohnbetrag ohne Währung ist kein Betrag (Wurzel 4).
    constraint personal_akten_lohn_mit_waehrung
        check ((stundenlohn_minor is null and gehalt_minor is null) or currency is not null),
    -- Externe (Fremdfirma, Entscheidung 4): Firma Pflicht, KEINE Lohn- und
    -- Urlaubsfelder. Angestellte: keine Firma.
    constraint personal_akten_extern_ohne_lohn
        check (
            (beschaeftigungsart = 'extern'
                and firma_id is not null
                and stundenlohn_minor is null
                and gehalt_minor is null
                and urlaubsanspruch_tage is null)
            or (beschaeftigungsart <> 'extern' and firma_id is null)
        ),
    constraint personal_akten_austritt_nach_eintritt
        check (austritt is null or eintritt is null or austritt >= eintritt)
);
create index if not exists personal_akten_tenant_idx on public.personal_akten (tenant_id);
create unique index if not exists personal_akten_personalnummer_uq
    on public.personal_akten (tenant_id, employee_number) where employee_number is not null;
alter table public.personal_akten enable row level security;
drop policy if exists personal_akten_tenant on public.personal_akten;
create policy personal_akten_tenant on public.personal_akten
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_akten from anon, authenticated;
drop trigger if exists personal_akten_updated_at on public.personal_akten;
create trigger personal_akten_updated_at
    before update on public.personal_akten
    for each row execute function public.set_updated_at();

create table if not exists public.personal_qualifikationen (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    user_id            uuid not null references public.users (id) on delete cascade,
    arbeitsbereich_id  uuid not null references public.personal_arbeitsbereiche (id) on delete cascade,
    -- NULL = für alle Objekte; gesetzt = nur an diesem Objekt eingewiesen.
    property_id        uuid references public.properties (id) on delete cascade,
    stufe              text not null default 'selbststaendig'
        check (stufe in ('lernend', 'selbststaendig', 'anleitend')),
    created_at         timestamptz not null default now()
);
create unique index if not exists personal_qualifikationen_eindeutig
    on public.personal_qualifikationen (
        tenant_id, user_id, arbeitsbereich_id,
        coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );
alter table public.personal_qualifikationen enable row level security;
drop policy if exists personal_qualifikationen_tenant on public.personal_qualifikationen;
create policy personal_qualifikationen_tenant on public.personal_qualifikationen
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_qualifikationen from anon, authenticated;

create table if not exists public.personal_dokumente (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants (id) on delete cascade,
    user_id         uuid not null references public.users (id) on delete cascade,
    art             text not null check (art in (
        'vertrag', 'ausweis', 'arbeitserlaubnis', 'fuehrungszeugnis',
        'gesundheitszeugnis', 'belehrung', 'zertifikat', 'attest', 'sonstiges'
    )),
    titel           text not null,
    -- Privater Bucket `personal-dokumente`, Auslieferung nur per signierter
    -- URL (Wurzel 8). NULL = angefordert, noch nicht eingereicht.
    storage_pfad    text,
    content_type    text,
    groesse_bytes   integer check (groesse_bytes is null or groesse_bytes >= 0),
    ablauf_am       date,
    angefragt_am    timestamptz,
    eingereicht_am  timestamptz,
    geprueft_von    uuid references public.users (id) on delete set null,
    geprueft_am     timestamptz,
    notiz           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index if not exists personal_dokumente_user_idx
    on public.personal_dokumente (tenant_id, user_id);
create index if not exists personal_dokumente_ablauf_idx
    on public.personal_dokumente (tenant_id, ablauf_am) where ablauf_am is not null;
alter table public.personal_dokumente enable row level security;
drop policy if exists personal_dokumente_tenant on public.personal_dokumente;
create policy personal_dokumente_tenant on public.personal_dokumente
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_dokumente from anon, authenticated;
drop trigger if exists personal_dokumente_updated_at on public.personal_dokumente;
create trigger personal_dokumente_updated_at
    before update on public.personal_dokumente
    for each row execute function public.set_updated_at();

-- Privater Bucket für die Dokumente der Akte. Versioniert hier, nicht per Hand
-- im Dashboard (Qualitätsgate „Bucket-Config in versionierter Migration").
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'personal-dokumente', 'personal-dokumente', false, 20 * 1024 * 1024,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- ============================================================================
-- 5) Dienstplan (R): Schichten, Änderungsprotokoll, Veröffentlichung,
--    Lesebestätigung, Bewerbungen
-- ============================================================================
create table if not exists public.personal_schichten (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    -- NULL = offene Schicht (Bedarf), noch niemand eingeteilt.
    user_id            uuid references public.users (id) on delete set null,
    datum              date not null,
    start_at           timestamptz not null,
    end_at             timestamptz not null,
    pause_min          integer not null default 0 check (pause_min >= 0),
    arbeitsbereich_id  uuid references public.personal_arbeitsbereiche (id) on delete set null,
    property_id        uuid references public.properties (id) on delete set null,
    building_id        uuid references public.buildings (id) on delete set null,
    vorlage_id         uuid references public.personal_schichtvorlagen (id) on delete set null,
    status             text not null default 'entwurf'
        check (status in ('entwurf', 'veroeffentlicht', 'bestaetigt', 'abgesagt')),
    quelle             text not null default 'manuell'
        check (quelle in ('manuell', 'vorlage', 'bedarf_aufgabe', 'abwesenheit', 'kopie')),
    -- Herkunft bei Bedarf aus einer Aufgabe (Abreise-Reinigung). UNIQUE je
    -- Aufgabe: der Bedarfslauf ist damit idempotent (Wurzel 2).
    task_id            uuid references public.tasks (id) on delete cascade,
    abwesenheit_id     uuid,
    bestaetigt_am      timestamptz,
    notiz              text,
    erstellt_von       uuid references public.users (id) on delete set null,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    constraint personal_schichten_ende_nach_start check (end_at > start_at),
    -- Eine Schicht länger als 24 h ist ein Eingabefehler, kein Dienst.
    constraint personal_schichten_max_24h check (end_at - start_at <= interval '24 hours')
);
create index if not exists personal_schichten_tenant_datum_idx
    on public.personal_schichten (tenant_id, datum);
create index if not exists personal_schichten_person_idx
    on public.personal_schichten (tenant_id, user_id, datum);
create unique index if not exists personal_schichten_task_uq
    on public.personal_schichten (tenant_id, task_id) where task_id is not null;
alter table public.personal_schichten enable row level security;
drop policy if exists personal_schichten_tenant on public.personal_schichten;
create policy personal_schichten_tenant on public.personal_schichten
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
-- (R): Lesen nach Personen-/Objekt-Scope, Schreiben nur über die API.
drop policy if exists personal_schichten_scope on public.personal_schichten;
create policy personal_schichten_scope on public.personal_schichten
    as restrictive for all
    using (public.personal_sieht_schicht(user_id, property_id))
    with check (false);
revoke all on public.personal_schichten from anon, authenticated;
grant select on public.personal_schichten to authenticated;
drop trigger if exists personal_schichten_updated_at on public.personal_schichten;
create trigger personal_schichten_updated_at
    before update on public.personal_schichten
    for each row execute function public.set_updated_at();

create table if not exists public.personal_schicht_aenderungen (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    schicht_id  uuid not null references public.personal_schichten (id) on delete cascade,
    akteur_id   uuid references public.users (id) on delete set null,
    art         text not null check (art in (
        'angelegt', 'geaendert', 'zugewiesen', 'freigegeben', 'abgesagt',
        'veroeffentlicht', 'bestaetigt', 'geloescht', 'bewerbung', 'bewerbung_entschieden'
    )),
    alt         jsonb,
    neu         jsonb,
    created_at  timestamptz not null default now()
);
create index if not exists personal_schicht_aenderungen_schicht_idx
    on public.personal_schicht_aenderungen (schicht_id);
alter table public.personal_schicht_aenderungen enable row level security;
drop policy if exists personal_schicht_aenderungen_tenant on public.personal_schicht_aenderungen;
create policy personal_schicht_aenderungen_tenant on public.personal_schicht_aenderungen
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_schicht_aenderungen from anon, authenticated;

create table if not exists public.personal_veroeffentlichungen (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants (id) on delete cascade,
    woche_start         date not null,
    veroeffentlicht_von uuid references public.users (id) on delete set null,
    veroeffentlicht_am  timestamptz not null default now(),
    anzahl_schichten    integer not null default 0,
    unique (tenant_id, woche_start)
);
alter table public.personal_veroeffentlichungen enable row level security;
drop policy if exists personal_veroeffentlichungen_tenant on public.personal_veroeffentlichungen;
create policy personal_veroeffentlichungen_tenant on public.personal_veroeffentlichungen
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_veroeffentlichungen from anon, authenticated;
grant select on public.personal_veroeffentlichungen to authenticated;

create table if not exists public.personal_lesebestaetigungen (
    id                   uuid primary key default gen_random_uuid(),
    tenant_id            uuid not null references public.tenants (id) on delete cascade,
    veroeffentlichung_id uuid not null references public.personal_veroeffentlichungen (id) on delete cascade,
    user_id              uuid not null references public.users (id) on delete cascade,
    bestaetigt_am        timestamptz not null default now(),
    unique (veroeffentlichung_id, user_id)
);
alter table public.personal_lesebestaetigungen enable row level security;
drop policy if exists personal_lesebestaetigungen_tenant on public.personal_lesebestaetigungen;
create policy personal_lesebestaetigungen_tenant on public.personal_lesebestaetigungen
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_lesebestaetigungen from anon, authenticated;

create table if not exists public.personal_schicht_bewerbungen (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    schicht_id  uuid not null references public.personal_schichten (id) on delete cascade,
    user_id     uuid not null references public.users (id) on delete cascade,
    status      text not null default 'offen' check (status in ('offen', 'angenommen', 'abgelehnt')),
    created_at  timestamptz not null default now(),
    entschieden_am timestamptz,
    entschieden_von uuid references public.users (id) on delete set null,
    unique (schicht_id, user_id)
);
alter table public.personal_schicht_bewerbungen enable row level security;
drop policy if exists personal_schicht_bewerbungen_tenant on public.personal_schicht_bewerbungen;
create policy personal_schicht_bewerbungen_tenant on public.personal_schicht_bewerbungen
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_schicht_bewerbungen from anon, authenticated;

-- ============================================================================
-- 6) Abwesenheit & Verfügbarkeit: Anträge (R), Sperren, Urlaubskonten (§),
--    Wunsch-/Sperrzeiten
-- ============================================================================
create table if not exists public.personal_abwesenheiten (
    id                      uuid primary key default gen_random_uuid(),
    tenant_id               uuid not null references public.tenants (id) on delete cascade,
    user_id                 uuid not null references public.users (id) on delete cascade,
    art                     text not null check (art in (
        'urlaub', 'krank', 'kind_krank', 'unbezahlt', 'sonderurlaub', 'schulung', 'frei'
    )),
    von                     date not null,
    bis                     date not null,
    halbtag_start           boolean not null default false,
    halbtag_ende            boolean not null default false,
    -- Vom Server nach Arbeitstagen, Feiertagen und Halbtagen berechnet.
    tage_berechnet          numeric(5,2) not null check (tage_berechnet >= 0),
    status                  text not null default 'beantragt'
        check (status in ('beantragt', 'genehmigt', 'abgelehnt', 'storniert')),
    grund                   text,
    kommentar_entscheidung  text,
    entschieden_von         uuid references public.users (id) on delete set null,
    entschieden_am          timestamptz,
    attest_dokument_id      uuid references public.personal_dokumente (id) on delete set null,
    erstellt_von            uuid references public.users (id) on delete set null,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now(),
    constraint personal_abwesenheiten_bis_nach_von check (bis >= von)
);
create index if not exists personal_abwesenheiten_person_idx
    on public.personal_abwesenheiten (tenant_id, user_id, von);
create index if not exists personal_abwesenheiten_status_idx
    on public.personal_abwesenheiten (tenant_id, status);
alter table public.personal_abwesenheiten enable row level security;
drop policy if exists personal_abwesenheiten_tenant on public.personal_abwesenheiten;
create policy personal_abwesenheiten_tenant on public.personal_abwesenheiten
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
drop policy if exists personal_abwesenheiten_scope on public.personal_abwesenheiten;
create policy personal_abwesenheiten_scope on public.personal_abwesenheiten
    as restrictive for all
    using (public.personal_sieht_person(user_id))
    with check (false);
revoke all on public.personal_abwesenheiten from anon, authenticated;
grant select on public.personal_abwesenheiten to authenticated;
drop trigger if exists personal_abwesenheiten_updated_at on public.personal_abwesenheiten;
create trigger personal_abwesenheiten_updated_at
    before update on public.personal_abwesenheiten
    for each row execute function public.set_updated_at();

-- Rückverweis Schicht → Abwesenheit (materialisierte Ganztags-Schicht, E1/E3).
alter table public.personal_schichten
    drop constraint if exists personal_schichten_abwesenheit_fk;
alter table public.personal_schichten
    add constraint personal_schichten_abwesenheit_fk
    foreign key (abwesenheit_id) references public.personal_abwesenheiten (id) on delete cascade;

create table if not exists public.personal_urlaubssperren (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    von                date not null,
    bis                date not null,
    grund              text not null,
    arbeitsbereich_id  uuid references public.personal_arbeitsbereiche (id) on delete cascade,
    created_at         timestamptz not null default now(),
    constraint personal_urlaubssperren_bis_nach_von check (bis >= von)
);
alter table public.personal_urlaubssperren enable row level security;
drop policy if exists personal_urlaubssperren_tenant on public.personal_urlaubssperren;
create policy personal_urlaubssperren_tenant on public.personal_urlaubssperren
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_urlaubssperren from anon, authenticated;
grant select on public.personal_urlaubssperren to authenticated;

-- Jahreskonto: Anspruch + Übertrag + Korrektur. Genommen/geplant werden aus
-- den genehmigten/beantragten Abwesenheiten GERECHNET, nicht gespeichert — zwei
-- Wahrheiten für dieselbe Zahl liefen auseinander (Wurzel 1).
create table if not exists public.personal_urlaubskonten (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenants (id) on delete cascade,
    user_id          uuid not null references public.users (id) on delete cascade,
    jahr             smallint not null check (jahr between 2000 and 2100),
    anspruch         numeric(5,2) not null check (anspruch >= 0),
    uebertrag        numeric(5,2) not null default 0 check (uebertrag >= 0),
    verfall_am       date,
    korrektur        numeric(5,2) not null default 0,
    korrektur_grund  text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    unique (tenant_id, user_id, jahr),
    constraint personal_urlaubskonten_korrektur_mit_grund
        check (korrektur = 0 or korrektur_grund is not null)
);
alter table public.personal_urlaubskonten enable row level security;
drop policy if exists personal_urlaubskonten_tenant on public.personal_urlaubskonten;
create policy personal_urlaubskonten_tenant on public.personal_urlaubskonten
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_urlaubskonten from anon, authenticated;
drop trigger if exists personal_urlaubskonten_updated_at on public.personal_urlaubskonten;
create trigger personal_urlaubskonten_updated_at
    before update on public.personal_urlaubskonten
    for each row execute function public.set_updated_at();

create table if not exists public.personal_verfuegbarkeiten (
    id                       uuid primary key default gen_random_uuid(),
    tenant_id                uuid not null references public.tenants (id) on delete cascade,
    user_id                  uuid not null references public.users (id) on delete cascade,
    art                      text not null check (art in ('wunsch', 'gesperrt')),
    -- Entweder wiederkehrend (Wochentag 0 = Montag … 6 = Sonntag) ODER ein
    -- Datumsbereich — nie beides, nie keines.
    wiederkehrend_wochentag  smallint check (wiederkehrend_wochentag between 0 and 6),
    datum_von                date,
    datum_bis                date,
    zeit_von                 time,
    zeit_bis                 time,
    ganztags                 boolean not null default true,
    notiz                    text,
    aktiv                    boolean not null default true,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),
    constraint personal_verfuegbarkeiten_form check (
        (wiederkehrend_wochentag is not null and datum_von is null and datum_bis is null)
        or (wiederkehrend_wochentag is null and datum_von is not null
            and datum_bis is not null and datum_bis >= datum_von)
    ),
    constraint personal_verfuegbarkeiten_zeit check (
        ganztags or (zeit_von is not null and zeit_bis is not null)
    )
);
create index if not exists personal_verfuegbarkeiten_person_idx
    on public.personal_verfuegbarkeiten (tenant_id, user_id);
alter table public.personal_verfuegbarkeiten enable row level security;
drop policy if exists personal_verfuegbarkeiten_tenant on public.personal_verfuegbarkeiten;
create policy personal_verfuegbarkeiten_tenant on public.personal_verfuegbarkeiten
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_verfuegbarkeiten from anon, authenticated;
drop trigger if exists personal_verfuegbarkeiten_updated_at on public.personal_verfuegbarkeiten;
create trigger personal_verfuegbarkeiten_updated_at
    before update on public.personal_verfuegbarkeiten
    for each row execute function public.set_updated_at();

-- ============================================================================
-- 7) Zeiterfassung (R/§): Stempelungen, Korrekturen, Arbeitszeitkonto,
--    Monatsabschluss
-- ============================================================================
create table if not exists public.personal_zeiterfassung (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenants (id) on delete cascade,
    user_id          uuid not null references public.users (id) on delete cascade,
    start_at         timestamptz not null,
    end_at           timestamptz,
    -- [{"start": "…Z", "end": "…Z"|null}] — eine laufende Pause hat end null.
    pausen           jsonb not null default '[]'::jsonb,
    quelle           text not null check (quelle in ('web', 'app', 'korrektur', 'import')),
    schicht_id       uuid references public.personal_schichten (id) on delete set null,
    task_id          uuid references public.tasks (id) on delete set null,
    property_id      uuid references public.properties (id) on delete set null,
    -- {"lat":…, "lng":…, "genauigkeit_m":…, "distanz_m":…} — vom Gerät des
    -- Nutzers gemeldet, Distanz zum Objekt serverseitig gerechnet.
    standort_start   jsonb,
    standort_ende    jsonb,
    status           text not null default 'offen'
        check (status in ('offen', 'abgeschlossen', 'bestaetigt')),
    bestaetigt_von   uuid references public.users (id) on delete set null,
    bestaetigt_am    timestamptz,
    notiz            text,
    -- Idempotenz für die spätere App mit Offline-Warteschlange (Wurzel 2):
    -- dieselbe Stempelung zweimal gesendet = eine Zeile.
    idempotenz_key   text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    constraint personal_zeiterfassung_ende_nach_start
        check (end_at is null or end_at > start_at),
    constraint personal_zeiterfassung_status_ende
        check ((status = 'offen') = (end_at is null))
);
create index if not exists personal_zeiterfassung_person_idx
    on public.personal_zeiterfassung (tenant_id, user_id, start_at);
-- Höchstens EINE offene Stempelung je Person.
create unique index if not exists personal_zeiterfassung_eine_offene_uq
    on public.personal_zeiterfassung (tenant_id, user_id) where end_at is null;
create unique index if not exists personal_zeiterfassung_idempotenz_uq
    on public.personal_zeiterfassung (tenant_id, idempotenz_key) where idempotenz_key is not null;
alter table public.personal_zeiterfassung enable row level security;
drop policy if exists personal_zeiterfassung_tenant on public.personal_zeiterfassung;
create policy personal_zeiterfassung_tenant on public.personal_zeiterfassung
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
drop policy if exists personal_zeiterfassung_scope on public.personal_zeiterfassung;
create policy personal_zeiterfassung_scope on public.personal_zeiterfassung
    as restrictive for all
    using (public.personal_sieht_person(user_id))
    with check (false);
revoke all on public.personal_zeiterfassung from anon, authenticated;
grant select on public.personal_zeiterfassung to authenticated;
drop trigger if exists personal_zeiterfassung_updated_at on public.personal_zeiterfassung;
create trigger personal_zeiterfassung_updated_at
    before update on public.personal_zeiterfassung
    for each row execute function public.set_updated_at();

create table if not exists public.personal_zeit_korrekturen (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    zeiterfassung_id   uuid not null references public.personal_zeiterfassung (id) on delete cascade,
    korrigiert_von     uuid references public.users (id) on delete set null,
    grund              text not null check (char_length(grund) >= 3),
    alt                jsonb not null,
    neu                jsonb not null,
    created_at         timestamptz not null default now()
);
create index if not exists personal_zeit_korrekturen_zeit_idx
    on public.personal_zeit_korrekturen (zeiterfassung_id);
alter table public.personal_zeit_korrekturen enable row level security;
drop policy if exists personal_zeit_korrekturen_tenant on public.personal_zeit_korrekturen;
create policy personal_zeit_korrekturen_tenant on public.personal_zeit_korrekturen
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_zeit_korrekturen from anon, authenticated;

create table if not exists public.personal_arbeitszeitkonten (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants (id) on delete cascade,
    user_id       uuid not null references public.users (id) on delete cascade,
    datum         date not null,
    -- Positiv = Guthaben (Mehrarbeit), negativ = Abbau/Auszahlung/Minus.
    minuten       integer not null check (minuten <> 0),
    grund         text not null check (grund in (
        'monatsabschluss', 'abbau', 'auszahlung', 'korrektur', 'uebertrag'
    )),
    bezug_id      uuid,
    notiz         text,
    erstellt_von  uuid references public.users (id) on delete set null,
    created_at    timestamptz not null default now(),
    constraint personal_azk_korrektur_mit_notiz
        check (grund <> 'korrektur' or notiz is not null)
);
create index if not exists personal_arbeitszeitkonten_person_idx
    on public.personal_arbeitszeitkonten (tenant_id, user_id, datum);
alter table public.personal_arbeitszeitkonten enable row level security;
drop policy if exists personal_arbeitszeitkonten_tenant on public.personal_arbeitszeitkonten;
create policy personal_arbeitszeitkonten_tenant on public.personal_arbeitszeitkonten
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_arbeitszeitkonten from anon, authenticated;

create table if not exists public.personal_monatsabschluesse (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenants (id) on delete cascade,
    user_id          uuid not null references public.users (id) on delete cascade,
    jahr             smallint not null check (jahr between 2000 and 2100),
    monat            smallint not null check (monat between 1 and 12),
    soll_minuten     integer not null check (soll_minuten >= 0),
    ist_minuten      integer not null check (ist_minuten >= 0),
    saldo_minuten    integer not null,
    -- {"nacht_min":…, "sonntag_min":…, "feiertag_min":…, "ueberstunden_min":…,
    --  "abwesenheiten": {"urlaub": 2, "krank": 1, …}}
    zuschlaege       jsonb not null default '{}'::jsonb,
    freigegeben_von  uuid references public.users (id) on delete set null,
    freigegeben_am   timestamptz not null default now(),
    unique (tenant_id, user_id, jahr, monat)
);
alter table public.personal_monatsabschluesse enable row level security;
drop policy if exists personal_monatsabschluesse_tenant on public.personal_monatsabschluesse;
create policy personal_monatsabschluesse_tenant on public.personal_monatsabschluesse
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_monatsabschluesse from anon, authenticated;

-- ============================================================================
-- 8) Feiertage (G) — je Land/Region/Jahr, importiert aus dem Paket `holidays`
-- ============================================================================
create table if not exists public.feiertage (
    id       uuid primary key default gen_random_uuid(),
    land     text not null check (land ~ '^[A-Z]{2}$'),
    -- Regionaler Feiertag (z. B. DE-BY); NULL = landesweit.
    region   text,
    datum    date not null,
    name     text not null,
    quelle   text not null,
    importiert_am timestamptz not null default now()
);
create unique index if not exists feiertage_eindeutig
    on public.feiertage (land, coalesce(region, ''), datum);
create index if not exists feiertage_land_datum_idx on public.feiertage (land, datum);
alter table public.feiertage enable row level security;
-- Kein Personenbezug, keine Mandantenbindung: lesbar für jeden Angemeldeten,
-- geschrieben nur vom Import (service_role).
drop policy if exists feiertage_lesen on public.feiertage;
create policy feiertage_lesen on public.feiertage for select using (true);
revoke all on public.feiertage from anon, authenticated;
grant select on public.feiertage to authenticated;

-- ============================================================================
-- 9) Realtime: die drei Quellen in die Publikation
-- ============================================================================
do $$
declare
    t text;
begin
    foreach t in array array[
        'personal_schichten', 'personal_abwesenheiten', 'personal_zeiterfassung',
        'personal_veroeffentlichungen'
    ] loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and tablename = t
        ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end $$;

comment on table public.personal_akten is
  'Personalakte 1:1 zu users (0541). Sensible Kennungen AES-GCM-verschlüsselt (*_enc). '
  'Nur service_role (Wurzel 6); owner/staff/cleaner/shift_lead sehen sie nie.';
comment on table public.personal_schichten is
  'Dienstplan-Einsätze (0541). user_id NULL = offener Bedarf. Lesen nach '
  'personal_sieht_schicht, Schreiben nur über die API (with check false).';
comment on table public.personal_zeiterfassung is
  'Stempelungen (0541). Eine offene je Person (Unique-Index), idempotenz_key für '
  'die spätere App mit Offline-Warteschlange (Wurzel 2).';
comment on table public.feiertage is
  'Gesetzliche Feiertage je Land/Region/Jahr, importiert aus dem Python-Paket '
  '`holidays` (scripts/personal/feiertage-importieren.py, Worker-Tick). Global, '
  'kein Personenbezug.';
