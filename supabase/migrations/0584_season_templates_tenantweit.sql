-- 0584_season_templates_tenantweit.sql — tenant-weite Saison-Vorlagen
-- („Standard", „Skagen") als EINE Zeile je Vorlage (ADR-0024).
--
-- WEG BIS HIER: 0011 legte `season_templates` mit drei Kindtabellen an
-- (seasons → season_periods, season_assignments); nichts hat sie je gelesen.
-- 0053 hat das Modell per COMMENT deprecatet, 0138 baute die Saisons
-- OBJEKTGEBUNDEN (`property_seasons` + `property_season_assignments`, mate-
-- rialisiert nach price_overrides). Seitdem fehlte, was das Lastenheft §2.3
-- verlangt: eine Vorlage, die der Betrieb EINMAL pflegt und per Checkbox auf
-- viele Objekte anwendet. Das Kopieren einer einzelnen Saison
-- (`POST /calendar/seasons/{id}/apply`) deckt das nur zur Hälfte.
--
-- ENTSCHEIDUNG (ADR-0024): die Vorlage ist eine eigenständige Definition —
-- Kategorien und Zeiträume als jsonb in DERSELBEN Zeile — und wird beim
-- Anwenden in `property_seasons`/`property_season_assignments` MATERIALISIERT
-- (über den bestehenden apply-Pfad des calendar-Slice). Keine Verknüpfung, die
-- nachzieht: nach dem Anwenden ist jede Saison am Objekt eigenständig (Haus-
-- muster wie Gebühren, Steuern, Aktionen, Saison-Kopie). Die Kindtabellen aus
-- 0011 bleiben deprecatet und ungenutzt; ihr FK auf season_templates ist
-- unschädlich (sie sind leer, 0053).
--
-- WARUM NEU ANGELEGT: Die Tabelle aus 0011 existiert live NICHT mehr —
-- Migration 0252 hat sie samt der drei Kindtabellen gelöscht, nachdem sie als
-- Attrappe erkannt wurde (kein Schreibpfad, 0 Zeilen, Saison-Faktor immer
-- 1.0). Der erste Entwurf dieser Migration hat sie erweitern wollen und ist
-- beim Einspielen mit „relation does not exist" abgebrochen (07.09.2026).
-- Der NAME bleibt derselbe, weil er der fachlich richtige und im Lastenheft
-- benannte ist; RLS, revoke, Trigger und Grants entstehen deshalb hier
-- vollständig neu und nicht als Nachtrag zu 0015/0224.
--
-- FORM der Nutzdaten:
--   kategorien: [{name, mode 'percent'|'fixed', amount, color '#RRGGBB',
--                min_stay?, max_stay?, closed_arrival_weekdays?,
--                closed_departure_weekdays?, min_stay_by_weekday?}]
--     — genau die Felder eines Regelsatzes (property_seasons, 0138/0572/0576),
--       damit „anwenden" den VOLLEN Satz kopiert, nicht nur den Preis.
--   zeitraeume: [{kategorie_index, start_date, end_date}]  (end inklusiv,
--       wie property_season_assignments)
-- Die Form prüft Pydantic beim Schreiben; der CHECK hier sichert nur den
-- Typ (Array), damit ein Direktschreiber (Wurzel 6) kein Objekt oder
-- Skalar ablegt, mit dem der Anwender nicht rechnen kann.
--
-- KEIN `begin;`/`commit;` (0576).

create table if not exists public.season_templates (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references public.tenants (id) on delete cascade,
    name       text not null,
    farbe      text,
    kategorien jsonb not null default '[]'::jsonb,
    zeitraeume jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists season_templates_tenant_id_idx
    on public.season_templates (tenant_id);

-- Nachtrag für Umgebungen, in denen die Tabelle bereits ohne die Nutzdaten
-- existiert (idempotent, tut in einer frischen DB nichts).
alter table public.season_templates
    add column if not exists farbe text,
    add column if not exists kategorien jsonb not null default '[]'::jsonb,
    add column if not exists zeitraeume jsonb not null default '[]'::jsonb;

alter table public.season_templates
    drop constraint if exists season_templates_farbe_form;
alter table public.season_templates
    add constraint season_templates_farbe_form
    check (farbe is null or farbe ~ '^#[0-9a-fA-F]{6}$');

alter table public.season_templates
    drop constraint if exists season_templates_kategorien_form;
alter table public.season_templates
    add constraint season_templates_kategorien_form
    check (jsonb_typeof(kategorien) = 'array');

alter table public.season_templates
    drop constraint if exists season_templates_zeitraeume_form;
alter table public.season_templates
    add constraint season_templates_zeitraeume_form
    check (jsonb_typeof(zeitraeume) = 'array');

alter table public.season_templates
    drop constraint if exists season_templates_name_form;
alter table public.season_templates
    add constraint season_templates_name_form
    check (char_length(name) between 1 and 80);

alter table public.season_templates enable row level security;

-- Vorlagen sind Preisdaten des Betriebs. Lesen darf die Oberfläche im eigenen
-- Mandanten, schreiben NUR der Server (Wurzel 6: ohne revoke wäre der
-- DB-Direktpfad über PostgREST offen — ein eingeloggter cleaner könnte mit dem
-- anon-Key Preisvorlagen anlegen und über „anwenden" die Objektpreise ändern).
revoke all on public.season_templates from anon, authenticated;

drop policy if exists season_templates_tenant on public.season_templates;
create policy season_templates_tenant
    on public.season_templates
    for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

drop policy if exists season_templates_kein_client_schreiben on public.season_templates;
create policy season_templates_kein_client_schreiben
    on public.season_templates
    as restrictive
    for all
    to anon, authenticated
    using (true)
    with check (false);

-- Preise sind Leitungssache: Eigentümer und Mitarbeiter sehen keine Vorlagen
-- (§4.2/§4.3). Fail-closed — eine unbekannte oder fehlende Rolle sieht nichts.
drop policy if exists season_templates_nur_leitung on public.season_templates;
create policy season_templates_nur_leitung
    on public.season_templates
    as restrictive
    for all
    to authenticated
    using (public.current_user_role() in ('admin','co_admin'))
    with check (false);

create or replace function public.season_templates_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

revoke execute on function public.season_templates_updated_at() from anon, authenticated;

drop trigger if exists season_templates_updated_at_trg on public.season_templates;
create trigger season_templates_updated_at_trg
    before update on public.season_templates
    for each row
    execute function public.season_templates_updated_at();

-- Eindeutiger Name je Mandant: der UNIQUE ist der Backstop gegen den
-- Doppelklick beim Anlegen (Wurzel 2) — zwei Vorlagen „Standard" wären in
-- der Anwenden-Checkbox nicht unterscheidbar.
create unique index if not exists season_templates_tenant_name_key
    on public.season_templates (tenant_id, name);

-- Lesen für die Vorlagen-Seite + Realtime (RLS scopt auf den Mandanten und
-- die Rolle). Schreiben bleibt beim Server.
grant select on public.season_templates to authenticated;

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public'
          and tablename = 'season_templates'
    ) then
        alter publication supabase_realtime add table public.season_templates;
    end if;
end
$$;

comment on table public.season_templates is
    'Tenant-weite Saison-Vorlagen (ADR-0024, 0584): Kategorien + Zeiträume als '
    'jsonb in EINER Zeile. „Anwenden" (POST /calendar/season-templates/{id}/apply) '
    'materialisiert sie als property_seasons/-assignments über den apply-Pfad des '
    'calendar-Slice; danach eigenständig. Neu angelegt in 0584 — die Tabelle aus '
    '0011 war samt Kindtabellen in 0252 als Attrappe entfernt worden.';
