-- 0472 — Der Baukasten bekommt eine Verschachtelung: Abschnitt → Spalte →
-- innere Spalte → Baustein.
--
-- ============================================================================
-- WARUM DAS DER GRÖSSTE UMBAU DES SLICE IST — UND WARUM ER SEIN MUSS
-- ============================================================================
-- Bis heute war eine Seite eine FLACHE, geordnete Liste von Blöcken.
-- `site_blocks` trug `page_id`, `type` und `position` — und keinen Ort, an dem
-- ein Block einen anderen enthalten könnte.
--
-- Im Code stand das als Vorteil formuliert (`web/components/website/
-- abschnitte.ts`):
--
--     „Eine Seite ist eine geordnete Liste von Abschnitten, kein freies
--      Canvas. […] Genau deshalb kann er die Seite nicht zerlegen."
--
-- Das ist das Squarespace-Modell und eine legitime Bauweise für einen
-- THEMEN-Editor. Für einen Page-Builder ist es keine: Section → Column →
-- Inner Column → Widget ist dessen Grundgerüst. Ohne Spalten lassen sich zwei
-- Dinge nicht nebeneinander stellen — und genau das ist die Frage, mit der
-- jeder Vermieter als Erstes kommt.
--
-- Belegt am Vorbild (`docs/BUCHUNGSSTRECKE-VORBILDER.md`, Screenshot des echten
-- Hostaway-Ebenen-Panels):
--
--     Header
--       Section
--       Section
--         Column
--           Text Block
--           Text Block
--       Section
--         Column
--           Inner Column
--             Text Block
--
-- ============================================================================
-- DAS MODELL: EINE TABELLE, EIN BAUM
-- ============================================================================
-- Kein zweiter Tabellensatz für Container. `site_blocks` trägt weiterhin ALLES,
-- nur bekommt jede Zeile eine ART und einen Elternteil. Der Grund ist
-- praktisch: Reihenfolge, Sichtbarkeit je Gerät, Abstände, Hintergrund und die
-- Herkunftsfelder (0463) gelten für Container GENAUSO wie für Bausteine. Zwei
-- Tabellen hießen, jede dieser Eigenschaften zweimal zu führen — und die zweite
-- ist die, die beim nächsten Feld vergessen wird.
--
-- Die vier Arten:
--
--   section       Ein Abschnitt über die volle Breite. Trägt Hintergrund und
--                 äußere Abstände. Nur er darf direkt an der Seite hängen.
--   column        Eine Spalte IM Abschnitt. Nebeneinander liegende Spalten
--                 teilen sich die Breite (`span`).
--   inner_column  Eine Spalte IN einer Spalte. Genau EINE Ebene tiefer, nicht
--                 beliebig — siehe Tiefenbegrenzung unten.
--   widget        Der eigentliche Inhalt (`type` sagt welcher). Hängt an einer
--                 Spalte oder inneren Spalte, nie direkt an der Seite.
--
-- ============================================================================
-- WARUM DIE TIEFE HART BEGRENZT IST
-- ============================================================================
-- Ein Selbstverweis ohne Grenze erlaubt beliebig tiefe Bäume — und jeder
-- Renderer, jede Rechteck-Messung und jede Ebenen-Ansicht müsste damit
-- rechnen. Hostaway begrenzt aus demselben Grund auf „Inner Column" und hört
-- dort auf. Die Begrenzung steht deshalb in der DATENBANK und nicht nur im
-- Anwendungscode: eine Zeile, die über den direkten PostgREST-Weg entsteht,
-- kennt den Anwendungscode nicht (Wurzel 6).
--
-- Erzwungen wird sie über `tiefe` — eine gespeicherte Zahl statt einer
-- rekursiven Prüfung. Ein CHECK kann nicht in andere Zeilen schauen; ein
-- Trigger könnte es, wäre aber bei jedem Schreibvorgang ein zusätzlicher
-- Lesezugriff. Die Zahl ist redundant zur Elternkette und genau deshalb billig
-- zu prüfen.

-- ---------------------------------------------------------------------------
-- 1. Die neuen Spalten
-- ---------------------------------------------------------------------------
alter table public.site_blocks
    -- Was diese Zeile IST. Default `widget`, damit der Bestand ohne Umschreiben
    -- gültig bleibt, bis Schritt 3 ihn einordnet.
    add column if not exists kind text not null default 'widget',
    -- Der Elternteil. NULL = hängt direkt an der Seite (nur `section` darf das).
    add column if not exists parent_id uuid
        references public.site_blocks (id) on delete cascade,
    -- Wie tief im Baum: 0 = section, 1 = column, 2 = inner_column ODER widget
    -- in einer column, 3 = widget in einer inner_column.
    add column if not exists tiefe smallint not null default 0,
    -- Breitenanteil einer Spalte in Zwölfteln. NULL bei allem, was keine Spalte
    -- ist. Zwölftel und nicht Prozent: Drittel und Viertel gehen darin glatt
    -- auf, in Prozent nicht (33,33 % dreimal ergibt 99,99 %).
    add column if not exists span smallint;

-- ---------------------------------------------------------------------------
-- 2. Der Typ-CHECK muss `container` kennen, bevor Schritt 3 einfügt
-- ---------------------------------------------------------------------------
-- Zuerst der BESTEHENDE Typ-CHECK (zuletzt 0468/0471): er zählt die erlaubten
-- Blocktypen auf und kennt `container` nicht. Ohne diese Erweiterung scheitert
-- Schritt 3 an der ersten eingefügten Zeile.
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
        'property_book_form', 'property_gallery', 'property_description',
        'property_amenities', 'property_map',
        'social_icons', 'share_button', 'whatsapp_chat', 'rss_feed',
        'facebook_feed', 'html_widget',
        -- 0472: die Container des Baums. Sie tragen keinen Inhalt, sondern
        -- Struktur — deshalb ein eigener Typ statt NULL.
        'container'
    ));

-- ---------------------------------------------------------------------------
-- 3. Der Bestand wird eingeordnet — VOR den Struktur-Regeln
-- ---------------------------------------------------------------------------
-- Jeder vorhandene Block wird zu `section > column > widget`. Kein Sonderfall
-- „Block ohne Container" bleibt übrig — sonst hätte der Renderer zwei Fälle zu
-- behandeln, und der zweite ist der, den beim nächsten Umbau niemand testet
-- (Wurzel 1: der Gegenzustand gehört mitgepflegt).
--
-- REIHENFOLGE DIESER MIGRATION: erst einordnen, dann die Regeln setzen.
-- Umgekehrt scheitert sie, und zwar sofort: der Bestand steht nach Schritt 1
-- als `kind = 'widget'` ohne Elternteil da, und genau das verbietet
-- `site_blocks_wurzel_check`. Eine Regel, die auf einen Bestand trifft, den
-- sie erst noch herstellen soll, ist immer falsch herum.
--
-- Reihenfolge der BLÖCKE bleibt erhalten: der neue Abschnitt übernimmt die `position` des
-- Blocks, Spalte und Baustein stehen darin jeweils an Position 0.
do $$
declare
    b record;
    neue_section uuid;
    neue_column uuid;
begin
    for b in
        select id, tenant_id, page_id, position, settings
          from public.site_blocks
         where kind = 'widget' and parent_id is null
         order by page_id, position
    loop
        insert into public.site_blocks
            (tenant_id, page_id, type, kind, tiefe, position, content, settings)
        values
            (b.tenant_id, b.page_id, 'container', 'section', 0, b.position,
             '{}'::jsonb,
             -- Die Darstellungs-Einstellungen des Blocks wandern an den
             -- ABSCHNITT: Hintergrund, Abstände und Gerätesichtbarkeit haben
             -- dort ihre Wirkung. Der Baustein behält sie zusätzlich, bis der
             -- Editor sie umzieht — doppelt gesetzt ist harmlos, verloren
             -- wäre es nicht.
             coalesce(b.settings, '{}'::jsonb))
        returning id into neue_section;

        insert into public.site_blocks
            (tenant_id, page_id, type, kind, tiefe, position, span,
             content, settings, parent_id)
        values
            (b.tenant_id, b.page_id, 'container', 'column', 1, 0, 12,
             '{}'::jsonb, '{}'::jsonb, neue_section)
        returning id into neue_column;

        update public.site_blocks
           set parent_id = neue_column,
               tiefe = 2,
               position = 0
         where id = b.id;
    end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Die Struktur-Regeln — jetzt, wo der Bestand ihnen genügt
-- ---------------------------------------------------------------------------
alter table public.site_blocks
    drop constraint if exists site_blocks_kind_check;
alter table public.site_blocks
    add constraint site_blocks_kind_check
    check (kind in ('section', 'column', 'inner_column', 'widget'));

-- Ein Abschnitt hängt an der SEITE, alles andere an einem Elternteil.
--
-- Das ist die Regel, die den Baum überhaupt zu einem Baum macht: ohne sie
-- könnte eine Spalte frei an der Seite hängen, und der Renderer müsste raten,
-- wie breit sie ist.
alter table public.site_blocks
    drop constraint if exists site_blocks_wurzel_check;
alter table public.site_blocks
    add constraint site_blocks_wurzel_check
    check (
        (kind = 'section' and parent_id is null)
        or (kind <> 'section' and parent_id is not null)
    );

-- Die Tiefe passt zur Art. Sie ist redundant zur Elternkette — und genau
-- deshalb prüfbar, ohne in andere Zeilen zu schauen.
alter table public.site_blocks
    drop constraint if exists site_blocks_tiefe_check;
alter table public.site_blocks
    add constraint site_blocks_tiefe_check
    check (
        (kind = 'section' and tiefe = 0)
        or (kind = 'column' and tiefe = 1)
        or (kind = 'inner_column' and tiefe = 2)
        -- Ein Baustein sitzt in einer Spalte (2) oder in einer inneren
        -- Spalte (3). Tiefer geht es nicht.
        or (kind = 'widget' and tiefe in (2, 3))
    );

-- Ein Breitenanteil ergibt nur an einer Spalte Sinn.
alter table public.site_blocks
    drop constraint if exists site_blocks_span_check;
alter table public.site_blocks
    add constraint site_blocks_span_check
    check (
        (kind in ('column', 'inner_column') and span between 1 and 12)
        or (kind not in ('column', 'inner_column') and span is null)
    );

-- Nur `widget` trägt einen Blocktyp. Ein Container mit `type = 'hero'` wäre
-- eine Zeile, die zwei Dinge gleichzeitig behauptet.
--
-- Container bekommen deshalb den eigenen Typ `container` — nicht NULL: die
-- Spalte ist NOT NULL, und sie dafür zu lockern hieße, dass ein Baustein ohne
-- Typ entstehen kann.
alter table public.site_blocks
    drop constraint if exists site_blocks_container_typ_check;
alter table public.site_blocks
    add constraint site_blocks_container_typ_check
    check (
        (kind = 'widget' and type <> 'container')
        or (kind <> 'widget' and type = 'container')
    );

-- ---------------------------------------------------------------------------
-- 5. Reihenfolge und Suchpfade
-- ---------------------------------------------------------------------------
-- Die Reihenfolge gilt jetzt INNERHALB des Elternteils, nicht mehr innerhalb
-- der Seite. Ohne diesen Index wäre jeder Baumaufbau ein Scan über alle Blöcke
-- der Seite.
create index if not exists site_blocks_eltern_idx
    on public.site_blocks (parent_id, position)
    where parent_id is not null;

-- Die Abschnitte einer Seite in ihrer Reihenfolge.
create index if not exists site_blocks_seite_wurzel_idx
    on public.site_blocks (page_id, position)
    where parent_id is null;
