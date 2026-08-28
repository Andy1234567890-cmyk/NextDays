-- 0468 — Die Buchungsstrecke: dynamische Objektseite und Buchungs-Block.
--
-- Grundlage: `docs/BUCHUNGSSTRECKE-VORBILDER.md` (Erhebung vom 25.08.2026 —
-- 95 Artikel aus Hostaways Hilfe-Center, dazu SiteMinder, Guesty, Lodgify).
--
-- ============================================================================
-- WAS 0466 RICHTIG UND WAS ES FALSCH GEMACHT HAT
-- ============================================================================
-- 0466 führte Systemseiten ein: Objekt-Detailseite, Buchung, Bestätigung, Blog.
-- Für Bestätigung und Blog ist das richtig — Hostaway führt sie im Standard-
-- Tarif als feste, nicht löschbare Seiten (dort „Reservation confirmation" und
-- „Inquiry received").
--
-- Für die OBJEKT-DETAILSEITE ist es falsch. Sie ist bei Hostaway keine starre
-- Seite, sondern eine DYNAMISCHE:
--
--   „In Booking Website Pro fungiert eine dynamische Seite als intelligente,
--    wiederverwendbare Masterseite."
--
-- Ein Layout, viele Objekte: man baut es EINMAL, und das System füllt Text,
-- Galerie, Lage und Preise je Objekt aus den Live-Daten. Neues Objekt → neue
-- Adresse mit eigenem SEO, automatisch. Objekt deaktiviert → Seite sofort weg.
--
-- Der Unterschied ist nicht kosmetisch. Eine starre Systemseite kann man nicht
-- gestalten; eine dynamische ist der eigentliche Wert des Baukastens für den
-- Vermieter — sie ist die Seite, auf der gebucht wird.
--
-- ============================================================================
-- WARUM EIN EIGENER SEITENTYP UND NICHT NUR EIN FLAG
-- ============================================================================
-- Eine dynamische Seite verhält sich an vier Stellen anders als eine normale,
-- und jede davon ist eine Fallunterscheidung, die man sonst an vier Orten
-- einzeln treffen müsste:
--
--   * Ihr Slug ist ein MUSTER (`inserat/[id]`), keine Adresse.
--   * Sie wird nie „veröffentlicht" — sie existiert, sobald es Objekte gibt.
--   * Ihre Blöcke tragen VERWEISE auf Datenfelder statt fester Texte.
--   * In der Sitemap steht nicht SIE, sondern eine Adresse je Objekt.
--
-- `dynamic_source` sagt, WORAUS die Vielzahl entsteht. Heute gibt es genau eine
-- Quelle (`property`); der Blog wäre die zweite, wenn wir seine Beiträge je
-- einmal rendern wollten. Eine Spalte und kein Boolean, damit die zweite Quelle
-- kein zweites Feld braucht.

alter table public.site_pages
    drop constraint if exists site_pages_page_type_check;
alter table public.site_pages
    add constraint site_pages_page_type_check
    check (page_type in (
        'normal', 'external', 'folder', 'error404', 'popup', 'post',
        'system', 'dynamic'
    ));

alter table public.site_pages
    -- Woraus die Vielzahl entsteht. NULL bei jeder nicht-dynamischen Seite.
    add column if not exists dynamic_source text;

alter table public.site_pages
    drop constraint if exists site_pages_dynamic_source_check;
alter table public.site_pages
    add constraint site_pages_dynamic_source_check
    check (
        (page_type = 'dynamic' and dynamic_source in ('property'))
        or (page_type <> 'dynamic' and dynamic_source is null)
    );

-- Genau EINE dynamische Seite je Quelle und Betrieb. Zwei Master-Layouts für
-- dasselbe Objekt wären zwei Wahrheiten darüber, wie ein Objekt aussieht — und
-- der Renderer müsste raten, welche gilt.
create unique index if not exists site_pages_dynamic_source_uniq
    on public.site_pages (tenant_id, dynamic_source)
    where dynamic_source is not null;

-- ============================================================================
-- DIE BESTEHENDE SYSTEMSEITE `inserat` WIRD ZUR DYNAMISCHEN SEITE
-- ============================================================================
-- Sie trägt bereits die richtige Adresse und etwaige SEO-Angaben. Sie zu
-- löschen und neu anzulegen hieße, beides wegzuwerfen — und der Betrieb hätte
-- seine Einstellungen ohne Vorwarnung verloren (Wurzel 1: der Gegenzustand
-- gehört mitgepflegt).
update public.site_pages
   set page_type = 'dynamic',
       dynamic_source = 'property',
       system_key = null
 where page_type = 'system'
   and system_key = 'inserat';

-- Der Buchungs-Block. Bei Hostaway heißt er „Property book-form": Datumsfeld,
-- Gästezahl, und zwei Knöpfe — „Send Inquiry" und „Book now". Er ist ein Widget
-- wie jedes andere: er liegt in einer Spalte, hat Inhalt und Design und lässt
-- sich verschieben.
--
-- Er steht bewusst NICHT nur auf der dynamischen Seite zur Verfügung: ein
-- Betrieb mit EINEM Ferienhaus will ihn auf seine Startseite setzen, ohne den
-- Umweg über eine Objektliste. Welches Objekt er dann bucht, steht in seinem
-- Inhalt.
alter table public.site_blocks
    drop constraint if exists site_blocks_type_check;
alter table public.site_blocks
    add constraint site_blocks_type_check
    check (type in (
        'hero', 'rich_text', 'image', 'gallery', 'button', 'spacer', 'contact',
        'search', 'properties_grid', 'featured_properties', 'reviews', 'faq',
        'map', 'testimonials', 'features', 'form', 'posts', 'accordion', 'tabs',
        'countdown', 'table', 'list', 'file', 'copyright', 'breadcrumbs',
        'media_slider', 'video', 'audio', 'before_after', 'shape',
        'business_hours', 'click_to_call', 'click_to_email', 'multi_location',
        'search_posts',
        -- 0468
        'property_book_form', 'property_gallery', 'property_description',
        'property_amenities', 'property_map'
    ));
