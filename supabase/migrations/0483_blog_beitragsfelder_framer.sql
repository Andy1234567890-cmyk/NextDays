-- 0483 — Die Beitragsfelder aus der Framer-Feldliste.
--
-- Grundlage: die Feldliste des Vorbilds (Bildreihe vom 28.08.2026,
-- `docs/FRAMER-CMS-ANALYSE.md` Abschnitt C):
--
--     Status · Project Thumbnail Title · Main Image / Thumbnail Image ·
--     Show on the homepage · Slug · Industry · Client · Full Project Title ·
--     Intro Section Heading · Intro Section Body · Button Text ·
--     Website Link · Gallery Top · Gallery Side Left · Gallery Side Right ·
--     Gallery Bottom · Final Section Heading · Final Section Body ·
--     Show Image Carousel · Carousel Img 1–4 · Created · Updated
--
-- Was davon schon stand: Status (is_published/is_draft), Titel, Adresse
-- (slug), Titelbild (cover_image_url), `show_on_homepage` (0481), Created
-- (created_at) und Updated (updated_at). Alles Uebrige kommt hier dazu.
--
--
-- ZWEI ARTEN BILDFELD, NICHT EINE
-- ===============================
-- `gallery_top` und `gallery_bottom` tragen MEHRERE Bilder, `gallery_left`
-- und `gallery_right` je EINES. Die Analyse haelt das ausdruecklich fest
-- (Abschnitt C, Feld 14/15: „**Image** (nicht Gallery!)"), und Abschnitt G
-- nennt den Grund, warum das kein Zufall ist: „Ein Mehrfach-Bildfeld ist ein
-- eigener Typ, keine vier Einzelfelder."
--
-- Deshalb `text[]` fuer die Galerien und `text` fuer die Einzelbilder — und
-- nicht viermal dasselbe. Wer alle vier gleich baut, baut zwei davon falsch.
--
-- WARUM text[] UND NICHT jsonb
-- ============================
-- Eine Galerie ist eine geordnete Liste von Adressen, sonst nichts. `jsonb`
-- koennte pro Bild noch Alt-Text und Bildausschnitt tragen — das taete es
-- aber an einer ZWEITEN Stelle neben der Mediathek, die beides schon fuehrt
-- (0479). Der Alternativtext haengt AM BILD und nicht am Feld, das es
-- einbindet (Analyse G) — zwei Wahrheiten waeren die Folge (Wurzel 2).

alter table public.site_pages
    -- Einordnung
    add column if not exists post_industry text,
    add column if not exists post_client text,
    add column if not exists post_full_title text,
    -- Einleitung
    add column if not exists post_intro_heading text,
    add column if not exists post_intro_body text,
    -- Handlungsaufforderung
    add column if not exists post_button_text text,
    add column if not exists post_website_link text,
    -- Galerien: zwei mehrfach, zwei einfach
    add column if not exists post_gallery_top text[],
    add column if not exists post_gallery_left text,
    add column if not exists post_gallery_right text,
    add column if not exists post_gallery_bottom text[],
    -- Abschluss
    add column if not exists post_final_heading text,
    add column if not exists post_final_body text,
    -- Bildkarussell
    add column if not exists post_show_carousel boolean not null default false,
    add column if not exists post_carousel_1 text,
    add column if not exists post_carousel_2 text,
    add column if not exists post_carousel_3 text,
    add column if not exists post_carousel_4 text;

comment on column public.site_pages.post_gallery_top is
    'Galerie OBEN (0483): MEHRERE Bildadressen, geordnet. text[] und nicht '
    'jsonb — Alt-Text und Ausschnitt haengen am Bild in der Mediathek (0479), '
    'nicht am Feld, das es einbindet (Framer-Analyse G).';
comment on column public.site_pages.post_gallery_left is
    'Galerie LINKS (0483): genau EIN Bild. Im Vorbild ausdruecklich ein '
    'Image-Feld und keine Gallery (Analyse C, Feld 14).';
comment on column public.site_pages.post_full_title is
    'Der volle Titel neben dem kurzen Listentitel (0483). ZWEI Felder und '
    'nicht ein gekuerztes — Framer-Analyse G.';
comment on column public.site_pages.post_show_carousel is
    'Zeigt die Beitragsseite das Bildkarussell? (0483)';

-- Die neuen Felder gehoeren zu einem BEITRAG und zu nichts anderem —
-- dieselbe Regel wie 0438/0480/0481. Der CHECK wird ERSETZT und nicht
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
            and post_carousel_3 is null and post_carousel_4 is null)
    );
