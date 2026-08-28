-- 0461 — Mediathek: Stock-Fotos mit Bildnachweis (Unsplash, Pexels).
--
-- Die Mediathek kannte bisher nur EINE Herkunft: hochgeladen. Wer kein eigenes
-- Foto hat — und das ist bei einem frisch angelegten Objekt der Normalfall —
-- stand vor einer leeren Kachelwand. `web/lib/website-stock.ts` behalf sich mit
-- 18 fest verdrahteten Unsplash-Foto-IDs als Hotlink; das ist keine Suche, es
-- ist eine Liste, und sie war im ganzen Repo nirgends eingebunden.
--
-- ============================================================================
-- WARUM DER BILDNACHWEIS IN DIE DATENBANK MUSS
-- ============================================================================
-- Unsplash verlangt in seinen API-Nutzungsbedingungen bei JEDER Anzeige eines
-- Fotos die Angabe „Photo by <Name> on Unsplash", beide Teile verlinkt. Das ist
-- keine Bitte, sondern der Vertrag, unter dem der Zugriffsschlüssel steht — und
-- wir schließen ihn im Namen unserer Kunden. Ein Nachweis, der nur im Editor
-- steht und nicht im gerenderten Kundenauftritt, erfüllt ihn NICHT: gesehen
-- wird das Foto auf der veröffentlichten Website.
--
-- Deshalb hängt der Nachweis am BILD und nicht am Block:
--   • Dasselbe Foto kann in Hero, Galerie und Hintergrund stehen. Am Block
--     gepflegt wäre er dreimal da und zweimal veraltet.
--   • Die acht Block-Typen mit Bildfeldern (`hero.image_url`, `image.url`,
--     `gallery.images[]`, `tabs.items[].image_url`, `list.items[].image_url`,
--     `media_slider.slides[].image_url`, `before_after.before_url/after_url`,
--     `shape.image_url`) plus `settings.background_image_url` plus
--     `og_image_url`/`cover_image_url`/`logo_url`/`hero_image_url`/
--     `favicon_url`/`rss_image_url` müssten JEDER einzeln ein Nachweisfeld
--     bekommen. Der neunte Block-Typ, den jemand nächste Woche baut, hätte
--     keines — und niemand merkte es, bis eine Abmahnung kommt.
--   • Der Renderer schlägt den Nachweis über die BILD-ADRESSE nach. Damit ist
--     jedes Bildfeld abgedeckt, auch die, die es noch nicht gibt.
--
-- ============================================================================
-- WARUM HOTLINK UND KEIN REHOSTING
-- ============================================================================
-- Unsplash verlangt ausdrücklich, die Adressen aus `photo.urls` zu verwenden
-- und die Bilder nicht auf eigene Server zu kopieren — nur so zählt ihre
-- Auslieferung die Aufrufe, aus denen der Fotograf seine Statistik bekommt.
-- Pexels wird aus demselben Grund gleich behandelt: eine zweite Bauart für
-- denselben Vorgang wäre ein zweiter Ort, an dem man etwas vergisst.
--
-- Folge fürs Schema: eine Stock-Zeile hat KEINE Datei im Bucket. `path` und
-- `bytes` verlieren deshalb ihr NOT NULL — und bekommen stattdessen eine
-- Bedingung, die sie GENAU DANN verlangt, wenn die Herkunft „upload" ist.
-- Ohne diese Bedingung wäre der Verlust des NOT NULL ein stiller Rückschritt
-- für die Uploads (Wurzel 4: keine Lücke, die man später mit einem geratenen
-- Wert füllt).

alter table public.site_media
    -- Herkunft. `shutterstock` steht bewusst NICHT in der Liste: der Anbieter
    -- braucht ein bezahltes Abo und eine AGB-Erweiterung (API Platform
    -- License — wir haften für Verstöße unserer Kunden). Ihn hier schon zu
    -- erlauben, hieße den einzigen Riegel zu entfernen, der eine
    -- Scharfschaltung zu einer bewussten Entscheidung macht. Wer ihn
    -- freischaltet, schreibt eine Migration — und in genau der Migration
    -- gehört die Rechtsentscheidung dokumentiert.
    add column if not exists source text not null default 'upload'
        check (source in ('upload', 'unsplash', 'pexels')),
    -- Name des Fotografen, wie ihn der Anbieter liefert. Anzeige-Text des
    -- Nachweises.
    add column if not exists credit_name text
        check (credit_name is null or length(credit_name) <= 200),
    -- Profil-Adresse des Fotografen beim Anbieter, inklusive der von Unsplash
    -- vorgeschriebenen utm-Parameter. Gespeichert und nicht beim Rendern
    -- zusammengebaut: sie kommt aus der Antwort des Anbieters, und ein selbst
    -- gebauter Link auf ein geratenes Profil wäre ein falscher Nachweis.
    add column if not exists credit_url text
        check (credit_url is null or credit_url ~ '^https://'),
    -- Die Kennung des Fotos beim Anbieter. Zweck: Doppelklick und Retry legen
    -- nicht zweimal dasselbe Foto an (Wurzel 2) — der Unique-Index unten ist
    -- der Backstop in der DB, nicht nur eine Prüfung im Dienst.
    add column if not exists external_id text
        check (external_id is null or length(external_id) <= 120);

-- Der Nachweis ist bei fremder Herkunft PFLICHT, nicht optional. Eine
-- Unsplash-Zeile ohne Fotografennamen wäre eine Zeile, die den Vertrag bricht,
-- sobald jemand sie auf eine Seite legt — und zwar unsichtbar, weil die
-- Oberfläche schlicht nichts anzeigt (Wurzel 5: fail-closed, lieber gar nicht
-- anlegen als still unvollständig).
alter table public.site_media
    drop constraint if exists site_media_herkunft_stimmig;
alter table public.site_media
    add constraint site_media_herkunft_stimmig check (
        case source
            -- Hochgeladen: Datei im Bucket, Größe bekannt, kein Fremdnachweis.
            when 'upload' then path is not null and bytes is not null
            -- Stock: Hotlink, also keine Datei — dafür ein vollständiger
            -- Nachweis und die Kennung beim Anbieter.
            else credit_name is not null
                 and credit_url is not null
                 and external_id is not null
        end
    );

-- NOT NULL erst NACH dem Check lösen: zwischen beiden Schritten gibt es keinen
-- Zustand, in dem eine Upload-Zeile ohne `path` entstehen könnte.
alter table public.site_media alter column path drop not null;
alter table public.site_media alter column bytes drop not null;

-- Der alte Check `bytes > 0` erlaubt NULL nicht mehr sauber lesbar — er bleibt
-- gültig (NULL macht einen Check nicht falsch, sondern unbekannt, und
-- unbekannt gilt als erfüllt), wird hier aber ausdrücklich neu gefasst, damit
-- niemand beim Lesen rätselt.
alter table public.site_media drop constraint if exists site_media_bytes_check;
alter table public.site_media
    add constraint site_media_bytes_check check (bytes is null or bytes > 0);

-- Backstop gegen das doppelt übernommene Foto (Wurzel 2). Partiell, weil
-- Uploads kein `external_id` tragen und sonst alle miteinander kollidierten.
create unique index if not exists site_media_extern_einmal
    on public.site_media (tenant_id, source, external_id)
    where external_id is not null;

comment on column public.site_media.source is
    'Herkunft: upload (Datei im Bucket) | unsplash | pexels (Hotlink, kein '
    'Rehosting — Anbietervorgabe). Shutterstock fehlt bewusst: braucht Abo und '
    'AGB-Erweiterung, Freischaltung nur per eigener Migration (0461).';
comment on column public.site_media.credit_url is
    'Profil-Adresse des Fotografen beim Anbieter, inkl. utm-Parameter. Kommt '
    'aus der Anbieterantwort, wird NIE selbst zusammengebaut (0461).';
comment on constraint site_media_herkunft_stimmig on public.site_media is
    'Upload braucht Datei+Größe, Stock braucht vollständigen Bildnachweis. Ein '
    'Stock-Bild ohne Nachweis bricht den Anbietervertrag, sobald es auf einer '
    'Seite steht (0461).';
