-- 0476 — Seitenfelder einer Kunden-Website in allen 24 EU-Amtssprachen.
--
-- WOFÜR: Die ABSCHNITTE einer Website sind längst mehrsprachig
-- (`site_blocks.content` ist jsonb mit einer Sprachkarte je Feld, 0087). Die
-- SEITE selbst ist es nicht: `site_pages.title`, `seo_title`,
-- `seo_description`, `seo_keywords`, `excerpt` und `og_image_alt` sind plain
-- `text`. Ein dänischer Gast liest also übersetzte Inhalte unter einem
-- deutschen Menüpunkt, mit deutschem <title> und deutscher
-- Meta-Beschreibung.
--
-- WARUM DAS SEO-RELEVANT IST, nicht nur kosmetisch: Google indexiert eine
-- Sprachfassung nur als eigenständige Seite, wenn sie eine EIGENE URL hat und
-- ihr Hauptinhalt übersetzt ist ("Localized versions of a page are only
-- considered duplicates if the main content of the page remains untranslated",
-- Google Search Central, International/localized-versions). Titel und
-- Beschreibung sind das, was in der Trefferliste steht — eine dänische Seite
-- mit deutschem Titel ist für den dänischen Suchenden unsichtbar.
--
-- WARUM EINE EIGENE TABELLE statt jsonb-Spalten auf `site_pages`:
-- Dieselbe Begründung wie bei `announcement_translations` (0347), und sie gilt
-- hier genauso. Eine Fassung ist kein Wert, sondern ein Datensatz mit eigenem
-- Lebenszyklus: erzeugt zu einem Zeitpunkt, aus einem bestimmten Quelltext,
-- geprüft oder nicht. Sechs jsonb-Spalten könnten den Zustand „diese eine
-- Sprache hat ein Mensch korrigiert" nur als siebte Parallel-Map führen, und
-- zwei gleichzeitige Korrekturen an verschiedenen Sprachen wären ein
-- Lost-Update auf demselben jsonb-Wert.
--
-- WARUM `slug` HIER NICHT STEHT: Ein übersetzter Slug (`/en/about-us` statt
-- `/en/ueber-uns`) ändert die ADRESSE und berührt damit fünf Unique-Indizes
-- auf `site_pages` (tenant_slug, one_home, tenant_404, system_key,
-- dynamic_source) sowie die Auflösung in `app/[slug]`. Vor allem aber fehlt
-- der Gegenzustand: eine Slug-Änderung legt heute KEINE Weiterleitung an
-- (`update_page` prüft nur Eindeutigkeit), obwohl `site_redirects` (0430)
-- existiert. Übersetzte Slugs ohne diese Automatik würden bei jeder Umbenennung
-- pro Sprache einen toten Link hinterlassen (Wurzel 1). Das ist ein eigener
-- Schritt; die Sprachfassung bekommt ihre eigene URL vorerst über das
-- Pfad-Präfix (`/da/kontakt`), was für das Ranking ausreicht.

create table if not exists public.site_page_translations (
    id uuid primary key default gen_random_uuid(),

    page_id uuid not null
        references public.site_pages (id) on delete cascade,

    -- Redundant zur Mutter-Zeile, und zwar mit Absicht: die restriktive
    -- Tenant-Policy unten braucht die Spalte AUF DIESER Zeile. Ein Unterabfrage
    -- auf site_pages in jeder Policy wäre pro Zeile ein zusätzlicher Lookup,
    -- und ein `join` in einer restriktiven Policy ist die Stelle, an der ein
    -- fehlender Index unbemerkt zum Tabellenscan wird.
    tenant_id uuid not null
        references public.tenants (id) on delete cascade,

    -- ISO-639-1 der 24 EU-Amtssprachen, deckungsgleich mit
    -- `web/i18n/locales.ts` LOCALES, `apps/api/src/core/sprachen.py` und dem
    -- CHECK auf `tenant_site_config.languages` (0426).
    sprache text not null check (sprache in (
        'bg','cs','da','de','el','en','es','et','fi','fr','ga','hr',
        'hu','it','lt','lv','mt','nl','pl','pt','ro','sk','sl','sv'
    )),

    -- Die übersetzbaren Felder, spiegelbildlich zu `site_pages`.
    --
    -- `title` NOT NULL: er ist der Menüpunkt und die <h1>. Eine Fassung ohne
    -- Titel wäre ein leerer Menüeintrag — schlimmer als keine Fassung, weil der
    -- Gast einen unsichtbaren Link anklicken müsste.
    --
    -- Alle anderen dürfen NULL sein, weil sie im Original ebenfalls optional
    -- sind. NULL heißt „für diese Sprache nicht gepflegt", und der Renderer
    -- fällt dann auf das Original zurück — das ist bei SEO-Feldern zulässig
    -- (Google bewertet den HAUPTINHALT), bei `title` nicht.
    title text not null,
    seo_title text,
    seo_description text,
    seo_keywords text,
    -- Anrisstext eines Blogbeitrags (0438). Steht in der Beitragsliste, im
    -- RSS-Feed und als `Article.description` im JSON-LD.
    excerpt text,
    -- Alternativtext des Vorschaubilds (0457). Prosa, also übersetzbar — die
    -- Bild-URL selbst ist es nicht und bleibt an der Mutter-Zeile.
    og_image_alt text,

    -- DER SCHUTZ. false = maschinell erzeugt, darf jederzeit neu übersetzt
    -- werden. true = ein Mensch hat die Fassung im Baukasten bearbeitet und
    -- verantwortet sie; kein automatischer Lauf fasst sie mehr an.
    --
    -- Ohne dieses Feld hätte der Auftrag „wenn jemand den Text ändert, wird
    -- überall aktualisiert" eine stille Nebenwirkung: die von Hand korrigierte
    -- dänische Überschrift wäre beim nächsten Speichern des deutschen Textes
    -- weg, ohne Meldung. Das ist derselbe Fehler wie ein verschluckter
    -- Exception (Wurzel 5) — es sieht nach Erfolg aus.
    geprueft boolean not null default false,

    geprueft_von uuid references auth.users (id) on delete set null,
    geprueft_am timestamptz,

    -- Fingerabdruck des QUELLTEXTES, aus dem diese Fassung entstanden ist
    -- (sha256 über die sechs Felder der Mutter-Zeile). Er treibt beide Hälften
    -- des Auftrags:
    --
    --   • „überall aktualisieren": ändert sich das Original, passt der Hash
    --     nicht mehr, und der Lauf übersetzt genau die Sprachen neu, die noch
    --     nicht geprüft sind.
    --   • Wurzel 2 (Idempotenz): ein zweiter Lauf mit unverändertem Quelltext
    --     findet denselben Hash und macht NICHTS — kein zweiter Modellaufruf
    --     bei Doppelklick, Retry oder erneutem Speichern.
    --
    -- Ein Zeitstempel-Vergleich könnte das nicht leisten: `updated_at` der
    -- Seite ändert sich auch, wenn nur `nav_order` verschoben oder die Seite
    -- veröffentlicht wurde.
    quelle_hash text not null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.site_page_translations is
    'Fassungen einer Website-Seite je EU-Amtssprache (0476). Traegt die '
    'Felder, die site_pages nur einsprachig hat (title, seo_*, excerpt, '
    'og_image_alt). `geprueft = true` heisst: von einem Menschen '
    'verantwortet — maschinelle Laeufe fassen die Zeile nicht mehr an. '
    'Der Slug bleibt bewusst an der Mutter-Zeile (siehe Migrationskopf).';
comment on column public.site_page_translations.geprueft is
    'true = im Baukasten von Hand bearbeitet und damit vor automatischer '
    'Ueberschreibung geschuetzt. Jedes maschinelle UPDATE traegt '
    '`where geprueft = false`.';
comment on column public.site_page_translations.quelle_hash is
    'sha256 der sechs Quellfelder der Seite. Weicht er vom aktuellen Original '
    'ab, ist die Fassung veraltet: ungeprueft wird sie neu uebersetzt, '
    'geprueft bleibt sie stehen und wird in der Oberflaeche als veraltet '
    'gezeigt.';

-- Wurzel 2 als DB-Backstop: Doppelklick auf „Speichern" und ein Retry nach
-- Timeout starten den Uebersetzungslauf real zweimal. Ohne diesen Index
-- entstuenden zwei Zeilen fuer dieselbe Sprache, und der Lesepfad zeigte
-- danach zufaellig die eine oder die andere. Der Service schreibt per upsert
-- auf genau diesen Konflikt.
create unique index if not exists site_page_translations_uq
    on public.site_page_translations (page_id, sprache);

-- Der Lesezugriff des RENDERERS: „alle Fassungen dieser Seite" (fuer hreflang
-- braucht er jede Sprache, nicht nur die angeforderte) und „welche Sprachen
-- sind gepflegt". Der UNIQUE-Index deckt den Praefix `page_id` ab; dieser
-- Index dient dem Ueberblick im Baukasten ohne Sortierschritt.
create index if not exists site_page_translations_status_idx
    on public.site_page_translations (page_id, geprueft);

-- Fuer die tenant-weite Sicht („welche Seiten fehlen in welcher Sprache") und
-- damit die restriktive Policy unten nicht ueber einen Scan laeuft.
create index if not exists site_page_translations_tenant_idx
    on public.site_page_translations (tenant_id, sprache);


-- == Wurzel 6: DB-Direktpfad (PostgREST/Realtime mit anon-Key) ===============
--
-- ANDERS als bei `announcement_translations` (0347), und der Unterschied ist
-- wichtig: dort ist der Inhalt eine Plattform-Ankuendigung, die niemand ausser
-- der Leitung sehen darf. Hier ist es der Text einer OEFFENTLICHEN
-- Kunden-Website — er steht ohnehin fuer jeden im Netz. Ein Deny-all waere
-- hier keine Sicherheit, sondern eine Attrappe.
--
-- Die Absicherung folgt deshalb genau der Mutter-Tabelle `site_pages`
-- (0224:340-345): LESEN erlaubt (RLS entscheidet ueber die Zeilen), SCHREIBEN
-- ausschliesslich serverseitig. Ein eingeloggter cleaner darf per
-- `curl /rest/v1/site_page_translations` also die Titel seines Betriebs lesen
-- (die stehen auf der Website) — aber keine Zeile anlegen, aendern oder
-- loeschen, und keine fremde lesen.
alter table public.site_page_translations enable row level security;

-- Lesen: nur der eigene Tenant. Permissiv, weil es die einzige Lese-Erlaubnis
-- ist.
drop policy if exists site_page_translations_read
    on public.site_page_translations;
create policy site_page_translations_read
    on public.site_page_translations
    for select
    to authenticated
    using (tenant_id = public.current_tenant_id());

-- Schreiben: entzogen. `revoke` UND restriktive Policy, weil das eine ohne das
-- andere nicht traegt: ein spaeter zurueckgegebenes Grant wuerde den Riegel
-- sonst oeffnen, und `for all` statt `for select` schliesst auch den
-- Schreibpfad (Wurzel 6).
revoke insert, update, delete on public.site_page_translations
    from anon, authenticated;

drop policy if exists site_page_translations_write_restrict
    on public.site_page_translations;
create policy site_page_translations_write_restrict
    on public.site_page_translations
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- `updated_at` pflegen — dieselbe Funktion, die alle anderen Tabellen nutzen.
drop trigger if exists set_updated_at on public.site_page_translations;
create trigger set_updated_at
    before update on public.site_page_translations
    for each row execute function public.set_updated_at();

-- BEWUSST KEINE Realtime-Publikation. Ein Abo braeuchte hier nichts, was der
-- Block oben schliesst (select ist ja erlaubt) — es waere aber eine Attrappe
-- aus einem anderen Grund: die Uebersetzungen aendert der SERVER nach einem
-- Speichervorgang, und der Baukasten laedt seinen Stand danach ohnehin neu.
-- Ein Abo wuerde denselben Zustand ein zweites Mal melden.
