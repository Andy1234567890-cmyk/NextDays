-- 0545 — Personal: Bedarfsplanung (Schichthüllen), Produktivitätsannahmen,
-- Budget-Leitplanken und Umsatzbuch (Gastromatic-Kennzahlen im Dienstplan).
--
-- Gastromatic zeigt je Arbeitsbereich über den Personen die Zeilen
-- „Stundenlimit x/y" und „Anzahl Einsätze", unten die Betriebs-KPI-Leiste und
-- rechts die Summenspalte; Grundlage sind Umsatzbuch (Plan/Ist je Tag),
-- Ziel-Umsatzproduktivität (€/h) und Budget. Bei einem Hotel kommt der Bedarf
-- zusätzlich aus der Buchungslage (Anreisen, Abreisen, Gäste im Haus, belegte
-- Einheiten) — die haben WIR selbst, Gastromatic nur über ein fremdes PMS.
--
-- Was gespeichert wird und was gerechnet:
--   * personal_bedarf          Soll-Besetzung je Bereich, Tag/Wochentag und
--                              Zeitfenster (Hülle). Ist-Besetzung wird aus den
--                              Schichten GERECHNET, nie gespeichert (Wurzel 1).
--   * personal_produktivitaet  Annahme je Bereich: wie viele Einheiten einer
--                              Basis (belegte Einheiten, Anreisen, Abreisen,
--                              Gäste, Umsatz) eine Arbeitsstunde schafft — oder
--                              feste Stunden je Tag. Grundlage der Prognose.
--   * personal_budget          Leitplanke je Tag oder Wochentag: Stunden und/
--                              oder Betrag. Abweichung wird gerechnet.
--   * personal_umsatzbuch      Plan- und Ist-Umsatz je Tag (und optional je
--                              Bereich). Ist aus den Buchungen (Zimmerumsatz je
--                              Nacht) wird LIVE gerechnet; hier stehen nur
--                              manuelle Werte, Prognosen und Übersteuerungen.
--
-- Finanzdaten (Umsatzbuch, Budget mit Betrag) bleiben ohne `grant` — kein
-- Realtime, kein Direktpfad (Wurzel 6, wie payments/commissions).

-- ============================================================================
-- 1) Betriebsregeln: Zielwerte der Kennzahlen
-- ============================================================================
alter table public.personal_regeln
    -- Ziel-Umsatzproduktivität: Umsatz (Minor) je geplanter Arbeitsstunde.
    -- Daraus rechnet der Plan das Stundenlimit je Tag: Plan-Umsatz / Ziel.
    add column if not exists ziel_umsatzproduktivitaet_minor integer
        check (ziel_umsatzproduktivitaet_minor is null or ziel_umsatzproduktivitaet_minor > 0),
    -- Ziel-Personalkostenquote in Prozent (Personalkosten / Umsatz).
    add column if not exists ziel_personalkostenquote_pct    numeric(5,2)
        check (ziel_personalkostenquote_pct is null or ziel_personalkostenquote_pct between 0 and 100),
    -- Währung der Kennzahlen-Ziele (Pflicht, sobald ein Ziel gesetzt ist).
    add column if not exists kennzahlen_currency              text
        check (kennzahlen_currency is null or kennzahlen_currency ~ '^[A-Z]{3}$'),
    -- Welche Kennzahl-Zeilen der Plan je Arbeitsbereich zeigt (Gastromatic:
    -- „Anzahl KPI-Leisten je Ebene"). Werte: stundenlimit, einsaetze,
    -- besetzung, kosten, umsatz, produktivitaet, quote, budget.
    add column if not exists kennzahlen_zeilen                jsonb not null
        default '["besetzung", "stundenlimit"]'::jsonb;
alter table public.personal_regeln drop constraint if exists personal_regeln_ziel_mit_waehrung;
alter table public.personal_regeln add constraint personal_regeln_ziel_mit_waehrung
    check (ziel_umsatzproduktivitaet_minor is null or kennzahlen_currency is not null);
alter table public.personal_regeln drop constraint if exists personal_regeln_kennzahlen_zeilen_liste;
alter table public.personal_regeln add constraint personal_regeln_kennzahlen_zeilen_liste
    check (jsonb_typeof(kennzahlen_zeilen) = 'array');

-- ============================================================================
-- 2) Bedarf (Schichthüllen) — Soll-Besetzung
-- ============================================================================
create table if not exists public.personal_bedarf (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    arbeitsbereich_id  uuid not null references public.personal_arbeitsbereiche (id) on delete cascade,
    property_id        uuid references public.properties (id) on delete set null,
    -- Entweder wiederkehrend je Wochentag (Vorlage) ODER für ein Datum
    -- (Übersteuerung/Prognose) — nie beides, nie keines.
    wochentag          smallint check (wochentag between 0 and 6),
    datum              date,
    zeit_von           time not null,
    zeit_bis           time not null,
    anzahl             smallint not null check (anzahl between 0 and 200),
    quelle             text not null default 'manuell'
        check (quelle in ('manuell', 'vorlage', 'prognose')),
    prognose_id        uuid,
    notiz              text,
    erstellt_von       uuid references public.users (id) on delete set null,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    constraint personal_bedarf_form check (
        (wochentag is not null and datum is null) or (wochentag is null and datum is not null)
    ),
    constraint personal_bedarf_prognose_mit_datum check (quelle <> 'prognose' or datum is not null)
);
create index if not exists personal_bedarf_datum_idx on public.personal_bedarf (tenant_id, datum);
create index if not exists personal_bedarf_wochentag_idx on public.personal_bedarf (tenant_id, wochentag);
alter table public.personal_bedarf enable row level security;
drop policy if exists personal_bedarf_tenant on public.personal_bedarf;
create policy personal_bedarf_tenant on public.personal_bedarf
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
drop policy if exists personal_bedarf_nur_lesen on public.personal_bedarf;
create policy personal_bedarf_nur_lesen on public.personal_bedarf
    as restrictive for all using (true) with check (false);
revoke all on public.personal_bedarf from anon, authenticated;
grant select on public.personal_bedarf to authenticated;
drop trigger if exists personal_bedarf_updated_at on public.personal_bedarf;
create trigger personal_bedarf_updated_at
    before update on public.personal_bedarf
    for each row execute function public.set_updated_at();

-- ============================================================================
-- 3) Produktivitätsannahmen je Arbeitsbereich
-- ============================================================================
create table if not exists public.personal_produktivitaet (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    arbeitsbereich_id  uuid not null references public.personal_arbeitsbereiche (id) on delete cascade,
    -- Bezugsgröße der Annahme:
    --   einheiten_belegt  belegte Einheiten je Arbeitsstunde (Housekeeping)
    --   abreisen          Abreisen (Wechselreinigungen) je Arbeitsstunde
    --   anreisen          Anreisen je Arbeitsstunde (Rezeption)
    --   gaeste            Gäste im Haus je Arbeitsstunde (Frühstück)
    --   umsatz            Umsatz (Minor) je Arbeitsstunde
    --   fest              feste Stunden je Tag, unabhängig von der Lage
    basis              text not null
        check (basis in ('einheiten_belegt', 'abreisen', 'anreisen', 'gaeste', 'umsatz', 'fest')),
    wert               numeric(12,4) not null check (wert > 0),
    -- Mindest- und Höchststunden je Tag als Leitplanke der Prognose.
    min_stunden_tag    numeric(5,2) check (min_stunden_tag is null or min_stunden_tag >= 0),
    max_stunden_tag    numeric(5,2) check (max_stunden_tag is null or max_stunden_tag >= 0),
    notiz              text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    unique (tenant_id, arbeitsbereich_id),
    constraint personal_produktivitaet_min_max
        check (min_stunden_tag is null or max_stunden_tag is null or min_stunden_tag <= max_stunden_tag)
);
alter table public.personal_produktivitaet enable row level security;
drop policy if exists personal_produktivitaet_tenant on public.personal_produktivitaet;
create policy personal_produktivitaet_tenant on public.personal_produktivitaet
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_produktivitaet from anon, authenticated;
drop trigger if exists personal_produktivitaet_updated_at on public.personal_produktivitaet;
create trigger personal_produktivitaet_updated_at
    before update on public.personal_produktivitaet
    for each row execute function public.set_updated_at();

-- ============================================================================
-- 4) Budget-Leitplanken (§, Finanzen)
-- ============================================================================
create table if not exists public.personal_budget (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants (id) on delete cascade,
    wochentag     smallint check (wochentag between 0 and 6),
    datum         date,
    stunden       numeric(7,2) check (stunden is null or stunden >= 0),
    betrag_minor  integer check (betrag_minor is null or betrag_minor >= 0),
    currency      text check (currency is null or currency ~ '^[A-Z]{3}$'),
    notiz         text,
    erstellt_von  uuid references public.users (id) on delete set null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    constraint personal_budget_form check (
        (wochentag is not null and datum is null) or (wochentag is null and datum is not null)
    ),
    constraint personal_budget_inhalt check (stunden is not null or betrag_minor is not null),
    constraint personal_budget_betrag_mit_waehrung check (betrag_minor is null or currency is not null)
);
create index if not exists personal_budget_datum_idx on public.personal_budget (tenant_id, datum);
alter table public.personal_budget enable row level security;
drop policy if exists personal_budget_tenant on public.personal_budget;
create policy personal_budget_tenant on public.personal_budget
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_budget from anon, authenticated;
drop trigger if exists personal_budget_updated_at on public.personal_budget;
create trigger personal_budget_updated_at
    before update on public.personal_budget
    for each row execute function public.set_updated_at();

-- ============================================================================
-- 5) Umsatzbuch (§, Finanzen)
-- ============================================================================
create table if not exists public.personal_umsatzbuch (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants (id) on delete cascade,
    datum              date not null,
    -- NULL = Betrieb gesamt; sonst Anteil eines Arbeitsbereichs (Schlüsselung).
    arbeitsbereich_id  uuid references public.personal_arbeitsbereiche (id) on delete cascade,
    plan_minor         integer check (plan_minor is null or plan_minor >= 0),
    ist_minor          integer check (ist_minor is null or ist_minor >= 0),
    currency           text not null check (currency ~ '^[A-Z]{3}$'),
    quelle             text not null default 'manuell'
        check (quelle in ('manuell', 'prognose', 'buchungen')),
    prognose_id        uuid,
    notiz              text,
    erstellt_von       uuid references public.users (id) on delete set null,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    constraint personal_umsatzbuch_inhalt check (plan_minor is not null or ist_minor is not null)
);
create unique index if not exists personal_umsatzbuch_betrieb_uq
    on public.personal_umsatzbuch (tenant_id, datum) where arbeitsbereich_id is null;
create unique index if not exists personal_umsatzbuch_bereich_uq
    on public.personal_umsatzbuch (tenant_id, datum, arbeitsbereich_id) where arbeitsbereich_id is not null;
alter table public.personal_umsatzbuch enable row level security;
drop policy if exists personal_umsatzbuch_tenant on public.personal_umsatzbuch;
create policy personal_umsatzbuch_tenant on public.personal_umsatzbuch
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
revoke all on public.personal_umsatzbuch from anon, authenticated;
drop trigger if exists personal_umsatzbuch_updated_at on public.personal_umsatzbuch;
create trigger personal_umsatzbuch_updated_at
    before update on public.personal_umsatzbuch
    for each row execute function public.set_updated_at();

-- ============================================================================
-- 6) Realtime: Bedarf (kein Finanzbezug)
-- ============================================================================
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'personal_bedarf'
    ) then
        execute 'alter publication supabase_realtime add table public.personal_bedarf';
    end if;
end $$;

comment on table public.personal_bedarf is
  'Soll-Besetzung (Schichthüllen, 0545) je Arbeitsbereich, Wochentag ODER Datum und '
  'Zeitfenster. Ist-Besetzung wird aus personal_schichten gerechnet, nie gespeichert.';
comment on table public.personal_umsatzbuch is
  'Plan-/Ist-Umsatz je Tag (0545), Finanzdaten ohne Direktpfad. Der Ist-Umsatz aus '
  'Buchungen wird live gerechnet; hier stehen manuelle Werte, Prognosen, Übersteuerungen.';
