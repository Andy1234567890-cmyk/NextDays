-- 0459 — den Abschnitts-CHECK wieder vollständig machen
--
-- Reparatur, und sie hat einen Namen: 0458 hat den CHECK `site_blocks_type_check`
-- ersetzt und dabei eine Liste benutzt, die aus 0438 stammte. Zwischen 0438 und
-- 0458 hatte 0450 acht Basis-Widgets ergänzt (accordion, tabs, countdown, table,
-- list, file, copyright, breadcrumbs). Die standen danach nicht mehr im CHECK.
--
-- Warum das schlimmer ist, als es aussieht: der Fehler ist unsichtbar, bis ein
-- Kunde einen dieser Abschnitte SPEICHERT — dann bricht das Speichern der ganzen
-- Seite mit 23514 ab, und der Grund steht in einer Migration, die mit dem
-- Abschnitt nichts zu tun hat. Der Reihe nach angewendet (0450 vor 0458) hätte
-- eine frische Datenbank denselben Zustand gehabt wie die Live-DB.
--
-- Die Lehre steht als Kommentar in 0458 und in 0450: dieser CHECK wird immer als
-- GANZES ersetzt. Wer einen Typ ergänzt, kopiert die Liste aus der HÖCHSTEN
-- Migration, nicht aus der, die er gerade offen hat — genau das prüft auch
-- `node scripts/i18n/blocktypen-pruefen.mjs` (es liest den CHECK aus der
-- höchsten Migrationsnummer).

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
        -- 0451: Medien-Widgets
        'media_slider', 'video', 'audio', 'before_after', 'shape',
        -- 0458: die Beitragssuche
        'search_posts'
    ));

-- Die Medien-Typen aus 0451 stehen hier MIT, obwohl 0451 eine kleinere Nummer
-- hat: auf einer frischen Datenbank läuft 0459 NACH 0451 und würde sie sonst
-- genau so entfernen, wie 0458 es mit den Basis-Widgets getan hat. Diese
-- Migration ist damit die neue Wahrheit über die Typenliste — und genau die
-- liest `node scripts/i18n/blocktypen-pruefen.mjs` (immer die höchste
-- Migrationsnummer).
