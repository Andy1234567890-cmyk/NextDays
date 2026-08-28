-- 0452 — Business-Widgets des Website-Baukastens
--
-- Dritter Zug nach 0450 (Basis) und 0451 (Medien). Vier neue Abschnittstypen:
--
--   business_hours   Öffnungszeiten je Wochentag, mit Ausnahmetagen
--   click_to_call    Anruf-Knopf (tel:)
--   click_to_email   E-Mail-Knopf (mailto:)
--   multi_location   mehrere Standorte als Liste, jeder mit Karten-Link
--
-- Alle vier zeigen BETRIEBSDATEN. Deshalb ist bei dreien das leere Feld der
-- Normalfall: dann gilt, was im Firmenprofil steht (`/konto`) — dieselbe Regel
-- wie beim Kontakt- und beim Karten-Abschnitt. Wer seine Nummer im Konto
-- ändert, soll sie nicht an vier Stellen nachziehen müssen.
--
-- Wieder keine neue Tabelle und keine neue Spalte: die Felder stehen im
-- bestehenden `content`-jsonb von `site_blocks`, an RLS ändert sich nichts.
--
-- Was Hostaway hier hat und wir NICHT: den Knopf „nächstgelegener Standort".
-- Er braucht Koordinaten je Standort (dort über den Kartendienst HERE) und die
-- Position des Gastes. Wir führen zu einem Standort eine ANSCHRIFT, keine
-- Koordinaten — ein Knopf, der stattdessen irgendeine Reihenfolge behauptet,
-- wäre eine Falschaussage (Wurzel 4). Der Weg zum Standort führt über den
-- Karten-Link je Eintrag.
--
-- Die vollständige Typ-Liste (Regel aus 0459): dieser CHECK wird immer als
-- GANZES ersetzt, also stehen hier ALLE Typen, die es zu diesem Zeitpunkt gibt.

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
        'search_posts',
        -- 0452: Business-Widgets
        'business_hours', 'click_to_call', 'click_to_email', 'multi_location'
    ));
