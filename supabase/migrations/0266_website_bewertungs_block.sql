-- 0266_website_bewertungs_block.sql — Blocktyp „reviews" für den Page-Builder
--
-- Die eigene Website des Betriebs soll die verifizierten myBestDays-Bewertungen
-- zeigen können (Lodgify löst das über den Drittanbieter Revyoos; wir haben die
-- Bewertungen selbst). BEWUSST nur eigene Bewertungen: Booking.com und Airbnb
-- erlauben das Weiterveröffentlichen ihrer Bewertungen nur eingeschränkt, und
-- eine „via Booking.com"-Kachel auf der Betriebs-Website ist deren Sache, nicht
-- unsere Standardfunktion.
--
-- Der Blocktyp steht als CHECK, nicht als Enum (0087) — genau dafür: erweitern
-- ohne `alter type`.

alter table public.site_blocks
    drop constraint if exists site_blocks_type_check;

alter table public.site_blocks
    add constraint site_blocks_type_check check (type in (
        'hero', 'rich_text', 'image', 'gallery', 'button',
        'spacer', 'contact', 'search', 'properties_grid',
        'featured_properties', 'reviews'
    ));
