-- 0457 — Blog: Planung, Beitrags-SEO und Blog-Einstellungen
--
-- Der Blog aus 0438 kann bisher genau eine Sache: einen Beitrag zeigen. Was
-- Hostaway (Duda) an seinem Blog zusätzlich hat und was ein Betrieb wirklich
-- braucht, ist an drei Stellen offen — diese Migration schließt sie, ohne die
-- Grundentscheidung von 0438 anzutasten (ein Beitrag ist eine SEITE).
--
-- 1) Beitrags-SEO braucht den Alt-Text zum Vorschaubild. `og_image_url` gibt es
--    seit 0430 an jeder Seite, den Alt-Text dazu nicht — und ein Bild ohne
--    Alternativtext ist für einen Screenreader nicht vorhanden. Die Spalte
--    hängt deshalb an `site_pages` und nicht an den Beitrags-Feldern: sie
--    gehört zu `og_image_url`, und das gilt für jede Seite.
--
-- 2) Der Blog braucht einen NAMEN. Er steht über der Beitragsliste, im
--    „Alle Beiträge"-Abschnitt und im RSS-Kanal. Ohne eigenes Feld nahm der
--    Renderer den Namen der Website — das ist ein Rückfall, kein Wert, und
--    ein Betrieb, der seinen Blog „Nordlicht-Journal" nennen will, konnte es
--    nicht.
--
-- 3) Der RSS-Feed hatte keine eigenen Angaben. Titel und Beschreibung kamen aus
--    den SEO-Feldern der WEBSITE — für einen Feed-Leser steht dort dann die
--    Verkaufsbeschreibung des Betriebs statt der des Blogs.
--
-- Nicht enthalten und bewusst nicht gebaut: die zwölf Beitrags-Layouts von
-- Hostaway. Das wäre ein zweites Layout-System neben unseren Abschnitten, und
-- sein Kern (ein „Inhalts-Platzhalter" mitten im Layout) setzt einen Editor
-- voraus, den es hier nicht gibt.

alter table public.site_pages
    -- Alternativtext zum Vorschaubild (og:image). Er ist NICHT dasselbe wie die
    -- Beschreibung: die beschreibt die Seite, dieser das Bild.
    --
    -- Warum überhaupt, wo og:image doch nur in sozialen Netzen erscheint: das
    -- Feld ist im Baukasten das Bild-Feld der SEO-Karte, und dieselbe Angabe
    -- wandert in das `image` des Article-Schemas. Ein Alt-Text, den der Kunde
    -- an genau einer Stelle pflegt, ist einer, den er pflegt.
    add column if not exists og_image_alt text;

comment on column public.site_pages.og_image_alt is
    'Alternativtext zum Vorschaubild (og:image). Beschreibt das BILD, nicht die '
    'Seite — deshalb ein eigenes Feld neben seo_description.';

alter table public.tenant_site_config
    -- Der Name des Blogs. Leer heißt „kein eigener Name": der Renderer nimmt
    -- dann seinen übersetzten Standardtitel. Das ist ein Rückfall auf einen
    -- ÜBERSETZTEN Text, kein erfundener Wert (Wurzel 4) — und genau deshalb
    -- steht hier NULL und nicht ein vorgefüllter String.
    add column if not exists blog_name text,
    -- Nächster/Vorheriger Beitrag am Ende jedes Beitrags.
    --
    -- Ein Schalter und keine Sortierwahl: die Reihenfolge ist das
    -- Erscheinungsdatum, sonst nichts. Hostaway hält es genauso („the order is
    -- based on the publish date and cannot be changed") und der Grund ist
    -- handfest — ein Blog ist eine Zeitachse. Wer eine andere Reihenfolge will,
    -- meint eine kuratierte Liste, und die ist ein anderer Abschnitt.
    add column if not exists blog_prev_next boolean not null default true,
    -- Eigener Titel des RSS-Kanals. Leer → der Blogname, dann der Name der
    -- Website. Drei Ränge, absteigend spezifisch — kein vierter erfundener.
    add column if not exists rss_title text,
    add column if not exists rss_description text,
    add column if not exists rss_image_url text;

comment on column public.tenant_site_config.blog_name is
    'Name des Blogs — Überschrift der Beitragsliste und Titel des '
    '„Alle Beiträge"-Abschnitts. NULL = der übersetzte Standardtitel.';
comment on column public.tenant_site_config.blog_prev_next is
    'Nächster/Vorheriger-Beitrag-Navigation am Ende jedes Beitrags. Die '
    'Reihenfolge ist das Erscheinungsdatum und nicht einstellbar.';
comment on column public.tenant_site_config.rss_title is
    'Titel des RSS-Kanals. NULL → blog_name → site_name.';
comment on column public.tenant_site_config.rss_description is
    'Beschreibung des RSS-Kanals. NULL → seo_description der Website.';
comment on column public.tenant_site_config.rss_image_url is
    'Vorschaubild des RSS-Kanals (<image> im Feed).';
