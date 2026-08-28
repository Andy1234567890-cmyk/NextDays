-- 0481 — Blog-CMS nach Framer-Vorbild: zweite Sichtbarkeitsachse und
--        Feldkonfiguration.
--
-- Grundlage: `docs/FRAMER-CMS-ANALYSE.md` (28.08.2026), Abschnitte C1 und G.
-- Zwei Befunde daraus brauchen die Datenbank; alles Uebrige der Analyse ist
-- reine Oberflaeche und steht im Frontend.
--
--
-- 1. `show_on_homepage` — DIE ZWEITE SICHTBARKEITSACHSE
--    ====================================================
--    Das Vorbild fuehrt `Status` (Draft/Live) UND `Show on the homepage` als
--    ZWEI getrennte Felder. Abschnitt G nennt den Grund: „Fertig" und „wo
--    sichtbar" sind zwei Fragen. Wer sie in ein Feld legt, kann einen fertigen
--    Beitrag nicht von der Startseite nehmen, ohne ihn zurueckzuziehen.
--
--    Das ist exakt unser eigenes Muster aus der Kanal-Sichtbarkeit
--    (`status='active'` + `listed_on_marketplace`, 0159) — dort ist die
--    Trennung schon entschieden, hier wird sie nachgezogen.
--
--    Vorgabe `true`: der Beitrag verhaelt sich damit wie bisher (jeder
--    veroeffentlichte Beitrag erscheint in der Uebersicht). Eine Vorgabe
--    `false` wuerde beim Einspielen jeden bestehenden Beitrag von der
--    Startseite nehmen — eine stille Aenderung an live stehenden Websites.
--
-- 2. `site_post_field_config` — DIE FELDKONFIGURATION
--    =================================================
--    Abschnitt C1: jedes Feld traegt Name, Beschreibung, Pflicht, ein-/
--    mehrzeilig, Platzhalter und Maximallaenge. Abschnitt G haelt fest, warum
--    das ins PRODUKT gehoert und nicht in eine Migration: es ist eine
--    Einstellung des Betriebs, keine Struktur.
--
--    Die Felder eines Blogbeitrags bleiben FEST (Titel, Anriss, Autor, …) —
--    kundendefinierte Sammlungen bauen wir ausdruecklich nicht. Konfigurierbar
--    ist, wie ein festes Feld sich VERHAELT und wie es HEISST. Deshalb eine
--    Zeile je (Betrieb, Feldschluessel) und kein Schema-Generator.

-- ---------------------------------------------------------------------------
-- 1. Zweite Sichtbarkeitsachse
-- ---------------------------------------------------------------------------

alter table public.site_pages
    add column if not exists show_on_homepage boolean not null default true;

comment on column public.site_pages.show_on_homepage is
    'Zweite Sichtbarkeitsachse eines Blogbeitrags (0481): erscheint er in der '
    'Beitragsuebersicht? Getrennt von is_published/is_draft — "fertig" und "wo '
    'sichtbar" sind zwei Fragen (Framer-Analyse Abschnitt G).';

-- Dasselbe wie fuer alle anderen Beitragsfelder (0438/0480): das Feld gilt
-- NUR an einem Beitrag. Ohne diese Bedingung stuende der Schalter an jeder
-- normalen Seite und wuerde dort nie gelesen.
--
-- Der bestehende CHECK aus 0480 wird ERSETZT und nicht ergaenzt: zwei CHECKs
-- ueber derselben Spaltenmenge waeren zwei Wahrheiten, von denen beim
-- naechsten neuen Feld nur eine gepflegt wird (Wurzel 2).
alter table public.site_pages
    drop constraint if exists site_pages_post_felder_nur_bei_post;
alter table public.site_pages
    add constraint site_pages_post_felder_nur_bei_post check (
        page_type = 'post'
        or (published_at is null and author is null
            and cover_image_url is null and excerpt is null and tags is null
            and content_html is null and post_sort is null
            and parent_post_id is null and author_user_id is null
            and is_archived = false and show_on_homepage = true)
    );

-- Die Abfrage der oeffentlichen Uebersicht: „die sichtbaren Beitraege dieses
-- Betriebs, neueste zuerst".
create index if not exists site_pages_post_homepage_idx
    on public.site_pages (tenant_id, published_at desc)
    where page_type = 'post' and show_on_homepage;

-- ---------------------------------------------------------------------------
-- 2. Feldkonfiguration je Betrieb
-- ---------------------------------------------------------------------------

create table if not exists public.site_post_field_config (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    -- Der Schluessel des FESTEN Feldes, das hier konfiguriert wird
    -- ('title', 'excerpt', 'author', 'cover', 'tags', 'published', …).
    -- Kein Verweis auf eine Feldtabelle: die Felder sind fest, ihre Liste
    -- steht im Code (web/.../blog/felder.ts). Ein unbekannter Schluessel wird
    -- beim Lesen ignoriert — er kann keine Spalte erfinden.
    feld_key text not null,
    -- Abweichender Name. NULL = der eingebaute Name aus dem Katalog, in der
    -- Sprache des Betrachters. Ein hier gesetzter Name steht in EINER Sprache;
    -- das ist die Entscheidung des Betriebs und wird nicht uebersetzt.
    label text check (label is null or char_length(label) <= 60),
    beschreibung text
        check (beschreibung is null or char_length(beschreibung) <= 300),
    platzhalter text
        check (platzhalter is null or char_length(platzhalter) <= 120),
    -- NULL = keine Grenze. Eine 0 waere „null Zeichen erlaubt" und damit ein
    -- Feld, das nichts annimmt — deshalb muss der Wert positiv sein.
    max_zeichen integer check (max_zeichen is null or max_zeichen between 1 and 10000),
    pflicht boolean not null default false,
    -- Mehrzeilig (Framers `Textbereich`). Nur bei Textfeldern wirksam.
    mehrzeilig boolean not null default false,
    -- Im Beitragsdialog ausgeblendet. NICHT dasselbe wie die Spaltenwahl der
    -- Tabelle: die ist die Ansicht EINES Bearbeiters (localStorage), das hier
    -- gilt fuer den ganzen Betrieb.
    versteckt boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- Genau EINE Konfiguration je Feld und Betrieb. Ohne diese Bedingung
    -- entstuenden bei einem doppelt abgeschickten Formular zwei Zeilen, von
    -- denen die Oberflaeche willkuerlich eine liest (Wurzel 2).
    unique (tenant_id, feld_key)
);

comment on table public.site_post_field_config is
    'Konfiguration der FESTEN Blog-Beitragsfelder je Betrieb (0481, '
    'Framer-Analyse C1): Name, Beschreibung, Pflicht, mehrzeilig, Platzhalter, '
    'Maximallaenge. Erfindet keine Felder — konfiguriert nur, wie die '
    'vorhandenen heissen und sich verhalten.';

create index if not exists site_post_field_config_tenant_idx
    on public.site_post_field_config (tenant_id);

-- --- RLS und Rechte (Wurzel 6) ---------------------------------------------
--
-- Die Tabelle traegt keine Gast- und keine Finanzdaten, aber sie steuert die
-- Eingabemaske eines ganzen Betriebs. Wer sie schreiben kann, kann jedes
-- Pflichtfeld abschalten und jedes Feld verstecken. Deshalb dieselbe
-- Behandlung wie bei `site_page_translations` (0476): lesen darf der eigene
-- Tenant, schreiben ausschliesslich der Server.

alter table public.site_post_field_config enable row level security;

-- Lesen: nur der eigene Tenant. Permissiv, weil es die einzige
-- Lese-Erlaubnis ist. Die Maske MUSS ihre Konfiguration kennen — sonst zeigt
-- der Dialog die eingebauten Namen statt der eingestellten.
drop policy if exists site_post_field_config_read
    on public.site_post_field_config;
create policy site_post_field_config_read
    on public.site_post_field_config
    for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

-- Schreiben: entzogen. `revoke` UND restriktive Policy, weil das eine ohne
-- das andere nicht traegt: ein spaeter zurueckgegebenes Grant wuerde den
-- Riegel sonst oeffnen, und `for all` statt `for select` schliesst auch den
-- Schreibpfad (Wurzel 6). Ohne das koennte ein eingeloggter cleaner per
-- `curl /rest/v1/site_post_field_config` die Pflichtfelder seines Betriebs
-- umstellen — der FastAPI-Layer wird dabei komplett umgangen.
revoke insert, update, delete on public.site_post_field_config
    from anon, authenticated;

drop policy if exists site_post_field_config_write_restrict
    on public.site_post_field_config;
create policy site_post_field_config_write_restrict
    on public.site_post_field_config
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- `updated_at` pflegen — dieselbe Funktion, die alle anderen Tabellen nutzen.
drop trigger if exists set_updated_at on public.site_post_field_config;
create trigger set_updated_at
    before update on public.site_post_field_config
    for each row execute function public.set_updated_at();

-- BEWUSST KEINE Realtime-Publikation. Die Feldkonfiguration aendert sich
-- selten und wird beim Oeffnen des Blog-Panels geladen; ein Abo waere eine
-- stumme Attrappe (CLAUDE.md, Realtime).
