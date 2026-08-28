-- 0485 — EIGENE Beitragsfelder (Framers Reiter „Fields").
--
-- WARUM DAS JETZT DOCH KOMMT
-- ==========================
-- 0481 haelt ausdruecklich fest: „Die Felder eines Blogbeitrags bleiben FEST
-- […] kundendefinierte Sammlungen bauen wir ausdruecklich nicht." Das war die
-- richtige Grenze fuer den damaligen Stand, und sie faellt hier NICHT ganz:
--
--   * Eine kundendefinierte SAMMLUNG (ein zweiter Inhaltstyp neben dem
--     Blogbeitrag, mit eigener Adresse und eigener Renderer-Route) bauen wir
--     weiterhin nicht. Das ist Framers Produkt.
--   * Ein zusaetzliches FELD an einem Blogbeitrag ist etwas anderes. Es
--     erfindet keine Route, keine Uebersicht und keinen Seitentyp — es haengt
--     an einer Zeile, die es schon gibt.
--
-- Der Anlass ist der Abgleich vom 28.08.2026: im Vorbild hat die linke Spalte
-- des CMS drei Reiter (`Collections · Fields · Plugins`), und „Fields" listet
-- ueber einem Trenner die Systemfelder (Titel, Status, Bild, Schalter, Slug)
-- und darunter die frei anlegbaren, jedes mit Typsymbol, ziehbar, mit `+` zum
-- Anlegen. Bei uns fehlte dieser Reiter ganz: `felder.ts` ist ein fester
-- Katalog, und die Feldkonfiguration konnte ein Feld nur UMBENENNEN.
--
--
-- ZWEI TABELLEN WAEREN EINE ZU VIEL
-- =================================
-- Die DEFINITION eines eigenen Feldes kommt in eine eigene Tabelle
-- (`site_post_custom_fields`, eine Zeile je Betrieb und Feld). Die WERTE
-- kommen NICHT dorthin, sondern als `jsonb` an die Beitragszeile.
--
-- Der naheliegende Gegenentwurf waere eine Wertetabelle (page_id, feld_id,
-- wert) — Entity-Attribute-Value. Dagegen sprechen drei Dinge, die hier alle
-- gleichzeitig gelten:
--
--   1. Die Beitragstabelle laedt ihre Zeilen in EINEM `select`. Mit einer
--      Wertetabelle braeuchte jede Zeile n weitere Zeilen; bei zehn eigenen
--      Feldern und 200 Beitraegen sind das 2 000 Zeilen fuer eine Ansicht,
--      die heute 200 laedt.
--   2. Ein Wert hat hier keine eigene Geschichte. Niemand fragt „wann wurde
--      Feld X an Beitrag Y gesetzt" — die Zeile traegt ihr `updated_at`.
--   3. `jsonb` haelt die Typen, die wir brauchen (Text, Zahl, Wahrheitswert,
--      Liste), ohne dass wir sie als Text serialisieren und beim Lesen raten
--      muessen (Wurzel 4).
--
-- Was `jsonb` NICHT darf: unbegrenzt wachsen. Deshalb ein CHECK auf die
-- Groesse und ein Deckel auf die Anzahl der Felder im Server (Wurzel 8: jeder
-- unbegrenzte Bereich bekommt eine harte Obergrenze).
--
--
-- WARUM DER SCHLUESSEL NICHT FREI IST
-- ===================================
-- `feld_key` ist a-z, 0-9 und `_` — und darf keinen der EINGEBAUTEN
-- Feldschluessel tragen. Sonst stuenden zwei Felder mit demselben Schluessel
-- in derselben Maske: eines aus `felder.ts`, eines aus dieser Tabelle. Welches
-- die Tabelle zeigt, entschiede die Reihenfolge einer Liste — also der Zufall
-- (Wurzel 2). Die Liste der eingebauten Schluessel steht im Server
-- (`beitrag_felder.BEITRAG_FELDER`) und wird dort geprueft; hier faengt der
-- CHECK nur die Form ab.

-- ---------------------------------------------------------------------------
-- 1. Die Feld-DEFINITIONEN
-- ---------------------------------------------------------------------------

create table if not exists public.site_post_custom_fields (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,
    -- Der Schluessel, unter dem der Wert in `site_pages.post_custom` steht.
    -- Klein, ohne Leerzeichen, nicht aenderbar nach dem Anlegen: eine
    -- Umbenennung waere ein Datenumzug ueber alle Beitraege. Der ANZEIGENAME
    -- (`label`) ist frei aenderbar — das ist der Name, den man sieht.
    feld_key text not null
        check (feld_key ~ '^[a-z][a-z0-9_]{0,39}$'),
    label text not null check (char_length(label) between 1 and 60),
    -- Die Feldart. Dieselben Werte wie `FeldArt` in
    -- `web/components/website/blog/felder.ts` — der Pruflauf
    -- `scripts/i18n/blog-felder-pruefen.mjs` haelt beide gleich.
    --
    -- `richtext` steht bewusst NICHT darin: ein zweiter Fliesstext neben dem
    -- Beitragstext waere ein zweiter Ort fuer denselben Inhalt, und der
    -- Renderer haette keine Stelle, ihn zu zeigen.
    art text not null check (
        art in ('text', 'zahl', 'datum', 'schalter', 'liste', 'link',
                'bild', 'galerie')
    ),
    -- Reihenfolge in Maske und Tabelle. Ganze Zahlen mit Luecken, damit ein
    -- Einschieben nicht die ganze Liste neu schreiben muss.
    position integer not null default 0,
    -- Dieselbe Konfigurationsflaeche wie bei den festen Feldern (0481).
    -- Ein eigenes Feld kann alles, was ein eingebautes kann — sonst waeren es
    -- zwei Sorten Feld mit zwei Sorten Einstellungen.
    beschreibung text
        check (beschreibung is null or char_length(beschreibung) <= 300),
    platzhalter text
        check (platzhalter is null or char_length(platzhalter) <= 120),
    max_zeichen integer
        check (max_zeichen is null or max_zeichen between 1 and 10000),
    pflicht boolean not null default false,
    mehrzeilig boolean not null default false,
    versteckt boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- Genau EIN Feld je Schluessel und Betrieb. Ohne diese Bedingung erzeugte
    -- ein doppelt abgeschicktes Formular zwei Felder, von denen die Maske
    -- willkuerlich eines liest (Wurzel 2).
    unique (tenant_id, feld_key)
);

comment on table public.site_post_custom_fields is
    'EIGENE Blog-Beitragsfelder je Betrieb (0485, Framers Reiter "Fields"). '
    'Die Definition steht hier, der Wert als jsonb in '
    'site_pages.post_custom. Erfindet keine neue Sammlung und keine neue '
    'Adresse — nur ein weiteres Feld an einem Beitrag, den es schon gibt.';

comment on column public.site_post_custom_fields.feld_key is
    'Schluessel in site_pages.post_custom. Nach dem Anlegen unveraenderlich — '
    'eine Umbenennung waere ein Datenumzug ueber alle Beitraege. Der '
    'Anzeigename (label) ist frei aenderbar.';

create index if not exists site_post_custom_fields_tenant_idx
    on public.site_post_custom_fields (tenant_id, position);

-- ---------------------------------------------------------------------------
-- 2. Die WERTE an der Beitragszeile
-- ---------------------------------------------------------------------------

alter table public.site_pages
    add column if not exists post_custom jsonb not null default '{}'::jsonb;

comment on column public.site_pages.post_custom is
    'Werte der EIGENEN Beitragsfelder (0485), Schluessel = '
    'site_post_custom_fields.feld_key. Objekt, nie Array oder Skalar; '
    'Groesse gedeckelt, damit ein Feld die Zeile nicht ins Uferlose treibt '
    '(Wurzel 8).';

-- Ein Objekt und nichts anderes. Ohne diesen CHECK koennte dort `[]`, `null`
-- oder `"text"` stehen, und jeder Leser muesste den Fall abfangen, den es
-- eigentlich nicht geben darf.
alter table public.site_pages
    drop constraint if exists site_pages_post_custom_objekt;
alter table public.site_pages
    add constraint site_pages_post_custom_objekt
    check (jsonb_typeof(post_custom) = 'object');

-- Harte Obergrenze (Wurzel 8). 64 kB je Beitrag sind grosszuegig fuer Text,
-- Zahlen und Bildadressen und klein genug, dass eine Zeile nicht zur Ablage
-- wird. Wer mehr braucht, braucht ein Feld vom Typ `bild` und die Mediathek.
alter table public.site_pages
    drop constraint if exists site_pages_post_custom_groesse;
alter table public.site_pages
    add constraint site_pages_post_custom_groesse
    check (pg_column_size(post_custom) <= 65536);

-- Die eigenen Werte gehoeren zu einem BEITRAG und zu nichts anderem —
-- dieselbe Regel wie 0438/0480/0481/0483. Der CHECK wird ERSETZT und nicht
-- ergaenzt: zwei CHECKs ueber derselben Spaltenmenge waeren zwei Wahrheiten,
-- von denen beim naechsten Feld nur eine gepflegt wird (Wurzel 2).
alter table public.site_pages
    drop constraint if exists site_pages_post_felder_nur_bei_post;
alter table public.site_pages
    add constraint site_pages_post_felder_nur_bei_post check (
        page_type = 'post'
        or (published_at is null and author is null
            and cover_image_url is null and excerpt is null and tags is null
            and content_html is null and post_sort is null
            and parent_post_id is null and author_user_id is null
            and is_archived = false and show_on_homepage = true
            -- 0483
            and post_industry is null and post_client is null
            and post_full_title is null and post_intro_heading is null
            and post_intro_body is null and post_button_text is null
            and post_website_link is null and post_gallery_top is null
            and post_gallery_left is null and post_gallery_right is null
            and post_gallery_bottom is null and post_final_heading is null
            and post_final_body is null and post_show_carousel = false
            and post_carousel_1 is null and post_carousel_2 is null
            and post_carousel_3 is null and post_carousel_4 is null
            -- 0485
            and post_custom = '{}'::jsonb)
    );

-- ---------------------------------------------------------------------------
-- 3. RLS und Rechte (Wurzel 6)
-- ---------------------------------------------------------------------------
--
-- Dieselbe Behandlung wie `site_post_field_config` (0481/0482): lesen darf der
-- eigene Tenant, schreiben ausschliesslich der Server. Wer diese Tabelle
-- schreiben kann, kann die Eingabemaske eines ganzen Betriebs umbauen — ein
-- Feld anlegen, das jeden Beitrag zur Pflichteingabe macht, oder eines
-- loeschen und damit die Werte aller Beitraege unlesbar machen.
--
-- Prueffrage vor „fertig" (CLAUDE.md, Wurzel 6): Was kann ein eingeloggter
-- cleaner mit dem anon-Key per `curl` gegen
-- `/rest/v1/site_post_custom_fields` lesen UND schreiben?
--   lesen:     die Felder SEINES Betriebs (Policy `..._read`) — keine
--              Gastdaten, keine Finanzen, kein Geheimnis.
--   schreiben: nichts (`revoke` + restriktive `for all`-Policy).

alter table public.site_post_custom_fields enable row level security;

grant select on public.site_post_custom_fields to authenticated;

drop policy if exists site_post_custom_fields_read
    on public.site_post_custom_fields;
create policy site_post_custom_fields_read
    on public.site_post_custom_fields
    for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

-- `revoke` UND restriktive Policy, weil das eine ohne das andere nicht
-- traegt: ein spaeter zurueckgegebenes Grant wuerde den Riegel sonst oeffnen,
-- und `for all` statt `for select` schliesst auch den SCHREIB-Pfad.
revoke insert, update, delete on public.site_post_custom_fields
    from anon, authenticated;

drop policy if exists site_post_custom_fields_write_restrict
    on public.site_post_custom_fields;
create policy site_post_custom_fields_write_restrict
    on public.site_post_custom_fields
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop trigger if exists set_updated_at on public.site_post_custom_fields;
create trigger set_updated_at
    before update on public.site_post_custom_fields
    for each row execute function public.set_updated_at();

-- BEWUSST KEINE Realtime-Publikation — dieselbe Begruendung wie bei
-- `site_post_field_config` (0481): die Feldliste aendert sich selten und wird
-- beim Oeffnen des Blog-Panels geladen. Ein Abo waere eine stumme Attrappe
-- (CLAUDE.md, Realtime).
