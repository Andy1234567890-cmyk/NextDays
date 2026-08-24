-- 0438 — Blog: Beiträge als Seitentyp
--
-- Etappe H aus docs/WEBSITE-BAUKASTEN-PLAN.md, die letzte und größte.
--
-- Ein Beitrag ist bei uns eine SEITE mit `page_type = 'post'` und nicht eine
-- eigene Tabelle. Das ist die wichtigste Entscheidung dieser Migration, und sie
-- hat einen handfesten Grund: ein Beitrag besteht aus denselben Abschnitten wie
-- eine Seite (Text, Bild, Galerie, Zitat, Karte). Eine zweite Tabelle hieße eine
-- zweite Block-Verwaltung, einen zweiten Editor, einen zweiten Renderer und
-- einen zweiten Veröffentlichungs-Pfad — viermal dasselbe, das irgendwann
-- auseinanderläuft.
--
-- Hostaway (Duda) macht es anders: dort ist der Blog ein eigenes Modul mit bis
-- zu 12 „Post Layouts", einem Layout-Modus und einem Post-Modus. Das ist
-- mächtiger und teuer erkauft — ihre eigene Doku listet die Folgen: Blog-Posts
-- gehen NICHT mit Mehrsprachigkeit, der Breadcrumb-Widget kennt sie nicht, und
-- die Beiträge tauchen im Seiten-Menü nicht auf. Genau die Brüche, die
-- entstehen, wenn ein Modul neben dem Seitensystem steht statt darin.
--
-- Was ein Beitrag ZUSÄTZLICH zu einer Seite braucht, steht unten: ein
-- Veröffentlichungsdatum (es bestimmt die Reihenfolge), ein Autor, ein
-- Titelbild, ein Auszug und Schlagwörter.

alter table public.site_pages
    drop constraint if exists site_pages_page_type_check;
alter table public.site_pages
    add constraint site_pages_page_type_check
    check (page_type in (
        'normal', 'external', 'folder', 'error404', 'popup', 'post'
    ));

alter table public.site_pages
    -- WANN der Beitrag erschienen ist. Das ist die Sortierung des Blogs und
    -- steht im `datePublished` des Article-Schemas.
    --
    -- Ein eigenes Feld und NICHT `created_at`: das beschreibt, wann die Zeile
    -- angelegt wurde (unsere Verarbeitung, Wurzel 5b). Ein Betrieb, der einen
    -- alten Text nachträgt, will das Datum des Textes zeigen — und wer
    -- vorschreibt, will ein Datum in der Zukunft.
    add column if not exists published_at timestamptz,
    -- Der Autor als NAME und nicht als Benutzer-Verweis.
    --
    -- Warum kein `references users(id)`: der Autor eines Beitrags ist oft nicht
    -- der, der ihn eintippt („Familie Jensen", „Das Team vom Nordlicht"), und
    -- ein gelöschter Benutzer würde den Beitrag anonymisieren. Der Name gehört
    -- zum Text, nicht zum Konto.
    add column if not exists author text,
    -- Titelbild. Es erscheint in der Beitragsliste, im Beitrag selbst und im
    -- Article-Schema.
    add column if not exists cover_image_url text,
    -- Anrisstext für die Liste. Fehlt er, nimmt der Renderer den Anfang des
    -- ersten Textabschnitts — das ist eine Kürzung, keine Erfindung (Wurzel 4).
    add column if not exists excerpt text,
    -- Schlagwörter zum Filtern. text[] und keine Zuordnungstabelle: es ist eine
    -- kurze, ungeordnete Liste ohne eigene Eigenschaften.
    add column if not exists tags text[];

-- Die Zusatzfelder gehören zu einem Beitrag und zu nichts anderem. Ohne diese
-- Prüfung könnte an einer normalen Seite ein `published_at` stehen, das nie
-- gelesen wird — gespeichert, wirkungslos, und niemand fände den Grund.
alter table public.site_pages
    drop constraint if exists site_pages_post_felder_nur_bei_post;
alter table public.site_pages
    add constraint site_pages_post_felder_nur_bei_post check (
        page_type = 'post'
        or (published_at is null and author is null
            and cover_image_url is null and excerpt is null and tags is null)
    );

-- Höchstens acht Schlagwörter je Beitrag. Ohne Deckel ist es ein unbegrenzter
-- Bereich (Wurzel 8): die Liste wandert in jede Beitragsansicht und in die
-- Filterleiste. Acht sind mehr, als ein Text sinnvoll trägt.
alter table public.site_pages
    drop constraint if exists site_pages_tags_deckel;
alter table public.site_pages
    add constraint site_pages_tags_deckel check (
        tags is null or array_length(tags, 1) <= 8
    );

-- Der Lesepfad des Blogs: „die veröffentlichten Beiträge dieses Betriebs,
-- neueste zuerst".
create index if not exists site_pages_posts_idx
    on public.site_pages (tenant_id, published_at desc)
    where page_type = 'post';

-- Der Abschnitts-Typ „letzte Beiträge": bringt den Blog auf die Startseite.
alter table public.site_blocks
    drop constraint if exists site_blocks_type_check;
alter table public.site_blocks
    add constraint site_blocks_type_check check (type in (
        'hero', 'rich_text', 'image', 'gallery', 'button',
        'spacer', 'contact', 'search', 'properties_grid',
        'featured_properties', 'reviews', 'faq',
        'map', 'testimonials', 'features', 'form', 'posts'
    ));

comment on column public.site_pages.published_at is
    'Erscheinungsdatum des Beitrags — bestimmt die Reihenfolge im Blog und '
    'steht im datePublished des Article-Schemas. Eigenes Feld, weil created_at '
    'unsere Verarbeitung beschreibt, nicht das Datum des Textes.';
comment on column public.site_pages.author is
    'Autor als Name, nicht als Benutzer-Verweis: er gehört zum Text, nicht zum '
    'Konto — und ein gelöschter Benutzer würde den Beitrag anonymisieren.';
comment on column public.site_pages.excerpt is
    'Anrisstext für die Beitragsliste. Fehlt er, kürzt der Renderer den ersten '
    'Textabschnitt — eine Kürzung, keine Erfindung.';
comment on column public.site_pages.tags is
    'Schlagwörter zum Filtern, höchstens acht.';
