-- 0458 — Abschnittstyp „Beitragssuche"
--
-- Ein Suchfeld, das NUR in den Titeln der Beiträge sucht. Das ist keine
-- Sparversion einer Volltextsuche, sondern eine bewusste Grenze, und Hostaway
-- schreibt sie in seiner eigenen Doku genauso hin („searches only the post
-- titles, not the content"):
--
--   * Eine Volltextsuche über den Inhalt hieße, die Abschnitte JEDES Beitrags zu
--     durchsuchen. Der Inhalt liegt bei uns in `site_blocks.content` als JSONB
--     je Sprache — eine Suche darüber wäre ein Scan über alle Blöcke aller
--     Beiträge, bei jedem Tastendruck eines Gastes.
--   * Und sie wäre irreführend: ein Treffer mitten in einem Abschnitt zeigt in
--     der Ergebnisliste trotzdem nur den Titel. Der Gast sieht dann einen
--     Beitrag, dem er sein Suchwort nicht ansieht.
--
-- Der bestehende Typ `search` ist etwas anderes: er sucht OBJEKTE (Verfügbarkeit
-- und Preis). Deshalb ein eigener Typ und kein Schalter am alten — ein Abschnitt
-- mit zwei grundverschiedenen Betriebsarten ist zwei Abschnitte in einem.

-- ACHTUNG, die Falle dieser Zeile: der CHECK wird als GANZES ersetzt (drop +
-- add). Wer hier nur „seinen" Typ anhängt und die Liste aus einer älteren
-- Migration kopiert, LÖSCHT alle Typen, die zwischenzeitlich dazugekommen sind
-- — und zwar still: der Fehler zeigt sich erst, wenn ein Kunde einen dieser
-- Abschnitte speichert und einen 23514 bekommt. Genau das ist beim Schreiben
-- dieser Migration passiert: die Liste stammte aus 0438 und hätte die acht
-- Basis-Widgets aus 0450 entfernt. Die Liste unten ist deshalb die
-- VOLLSTÄNDIGE, und sie ist mit 0450 deckungsgleich.
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
        'search_posts'
    ));
