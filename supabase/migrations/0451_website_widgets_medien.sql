-- 0451 — Medien-Widgets des Website-Baukastens
--
-- Zweiter Zug nach 0450. Fünf neue Abschnittstypen:
--
--   media_slider   Bild-/Video-Slider, höchstens 25 Folien (Hostaways Zahl)
--   video          YouTube / Vimeo / Dailymotion, mit VideoObject-Schema
--   audio          SoundCloud / Mixcloud
--   before_after   zwei Bilder mit Schieberegler dazwischen
--   shape          hervorgehobene Fläche mit Text (Auszeichnung, Aktionspreis)
--
-- Die bestehende `gallery` wird NICHT ersetzt, sondern im Schema erweitert
-- (Lightbox, Beschriftungen, Spaltenzahl, Bild-Links) — ihre Daten stehen auf
-- Kundenseiten, und zwei fast gleiche Galerie-Abschnitte im Katalog wären eine
-- Frage, die niemand beantworten kann. Alle neuen Felder haben Defaults, die
-- das bisherige Aussehen unverändert lassen (Wurzel 1).
--
-- WIEDER KEINE neue Tabelle und keine neue Spalte: ein Abschnittstyp ist eine
-- Zeile in `site_blocks`, seine Felder stehen im bestehenden `content`-jsonb.
-- An RLS ändert sich nichts.
--
-- SICHERHEIT — der Unterschied zu 0450: zwei dieser Typen holen etwas von einem
-- FREMDEN Host. Deshalb (alles in `block_inhalte_medien.py`, nicht im Renderer):
--   * Host-Allowlist BEIM SPEICHERN. Eine beliebige Fremdadresse kommt gar
--     nicht erst in diese Spalte (Wurzel 8).
--   * Aus der Adresse wird die KENNUNG gelöst und gespeichert; der Renderer
--     baut die Einbettungs-Adresse selbst. Eine Kennung aus [A-Za-z0-9_-] kann
--     nicht aus einem `src`-Attribut ausbrechen, eine freie Adresse schon.
--   * Die CSP des Renderers muss die Hosts kennen (builder/next.config.ts,
--     `frameSrc`). Fehlt einer, bleibt der Rahmen LEER — ohne Fehlermeldung.
--
-- Die vollständige Typ-Liste (Regel aus 0459): dieser CHECK wird immer als
-- GANZES ersetzt, also stehen hier ALLE Typen, die es zu diesem Zeitpunkt gibt,
-- nicht nur die fünf neuen.

alter table public.site_blocks
    drop constraint if exists site_blocks_type_check;
alter table public.site_blocks
    add constraint site_blocks_type_check check (type in (
        -- Bestand (0087 … 0438)
        'hero', 'rich_text', 'image', 'gallery', 'button',
        'spacer', 'contact', 'search', 'properties_grid',
        'featured_properties', 'reviews', 'faq',
        'map', 'testimonials', 'features', 'form', 'posts',
        -- 0450: Basis-Widgets
        'accordion', 'tabs', 'countdown', 'table', 'list',
        'file', 'copyright', 'breadcrumbs',
        -- 0458: die Beitragssuche
        'search_posts',
        -- 0451: Medien-Widgets
        'media_slider', 'video', 'audio', 'before_after', 'shape'
    ));
