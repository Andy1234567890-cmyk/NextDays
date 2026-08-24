-- 0433 — Seitentypen: externer Menüpunkt, Navigations-Ordner, 404-Seite
--
-- Etappe C aus docs/WEBSITE-BAUKASTEN-PLAN.md. Abgelesen an Hostaways
-- „+ Add Page"-Dropdown, das fünf Typen anbietet — wir hatten einen.
--
-- Bisher war JEDE Zeile in `site_pages` eine Seite mit Blöcken. Drei Fälle
-- passten nicht hinein und fehlten deshalb:
--
--   1. Ein Menüpunkt, der nach AUSSEN führt („Bewertungen bei Google",
--      „Anfahrt bei Maps"). Als normale Seite angelegt bräuchte er eine leere
--      Seite mit einem Button darauf — zwei Klicks für den Gast statt einem.
--   2. Ein Navigations-ORDNER: ein Menüpunkt, der selbst keine Seite ist,
--      sondern Untereinträge gruppiert („Umgebung ▾ Wandern · Strand · Museen").
--      Ohne ihn ist die Kopfzeile bei zehn Seiten eine Reihe von zehn Links.
--   3. Die 404-Seite. Sie ist eine Seite mit Blöcken, darf aber in keiner
--      Navigation und in keiner Sitemap auftauchen und hat keinen Slug.
--
-- Warum EINE Tabelle mit `page_type` und nicht drei Tabellen: alle drei sind
-- Einträge derselben geordneten Liste (`nav_order`), und die Navigation muss sie
-- in EINER Abfrage sortieren können. Drei Tabellen hieße drei Abfragen und eine
-- Sortierung in Python — und die Reihenfolge wäre nicht mehr eine Wahrheit.

alter table public.site_pages
    add column if not exists page_type text not null default 'normal',
    -- Ziel eines externen Menüpunkts. NULL bei allen anderen Typen.
    add column if not exists external_url text,
    -- Übergeordneter Ordner. Genau EINE Ebene tief (siehe CHECK unten): bei
    -- drei Ebenen verliert der Gast die Orientierung, und die Kopfzeile einer
    -- Website ist kein Datei-Explorer.
    add column if not exists parent_id uuid
        references public.site_pages (id) on delete set null;

-- `on delete set null` und NICHT `cascade`: wird ein Ordner gelöscht, sollen
-- seine Seiten BLEIBEN und in die oberste Ebene rutschen. Ein `cascade` würde
-- mit dem Ordner den Inhalt mitnehmen — genau die Art Datenverlust, die man erst
-- merkt, wenn es zu spät ist.

alter table public.site_pages
    drop constraint if exists site_pages_page_type_check;
alter table public.site_pages
    add constraint site_pages_page_type_check
    check (page_type in ('normal', 'external', 'folder', 'error404'));

-- Ein externer Menüpunkt braucht ein Ziel, alle anderen dürfen keines haben.
-- Ohne diese Prüfung entsteht ein Menüpunkt, der ins Leere zeigt — und der
-- Renderer müsste raten, ob er ihn weglässt oder eine leere Seite baut.
alter table public.site_pages
    drop constraint if exists site_pages_external_url_stimmig;
alter table public.site_pages
    add constraint site_pages_external_url_stimmig check (
        (page_type = 'external' and external_url is not null)
        or (page_type <> 'external' and external_url is null)
    );

-- Ein Ordner kann nicht in einem Ordner liegen (genau eine Ebene), und die
-- 404-Seite hängt an keinem.
alter table public.site_pages
    drop constraint if exists site_pages_parent_nur_eine_ebene;
alter table public.site_pages
    add constraint site_pages_parent_nur_eine_ebene check (
        parent_id is null or page_type in ('normal', 'external')
    );

-- Höchstens EINE 404-Seite je Betrieb. Als partieller UNIQUE-Index und nicht im
-- Service: der Doppelklick auf „404-Seite anlegen" ist real, und der Backstop
-- gehört in die DB (Wurzel 2). Dasselbe Muster wie `is_home` (0087).
create unique index if not exists site_pages_tenant_404_uniq
    on public.site_pages (tenant_id) where page_type = 'error404';

-- Die 404-Seite hat KEINEN Slug — sie ist über keine Adresse erreichbar,
-- sondern die Antwort auf eine falsche. Der bestehende UNIQUE (tenant_id, slug)
-- lässt nur EINE Zeile mit leerem Slug zu, und die ist die Startseite. Deshalb
-- trägt die 404-Seite den festen Slug '404' — er taucht nie in einer Adresse
-- auf, weil der Renderer sie über `page_type` findet, nicht über den Pfad.

comment on column public.site_pages.page_type is
    'normal = Seite mit Blöcken · external = Menüpunkt auf eine fremde Adresse '
    '· folder = Gruppe im Menü, selbst keine Seite · error404 = die Fehlerseite '
    '(höchstens eine je Betrieb, in keiner Navigation, in keiner Sitemap).';
comment on column public.site_pages.external_url is
    'Ziel eines externen Menüpunkts. Nur bei page_type=external gesetzt; die '
    'Schema-Whitelist (nur http(s)) erzwingt das Backend.';
comment on column public.site_pages.parent_id is
    'Übergeordneter Ordner. Genau eine Ebene tief. Beim Löschen des Ordners '
    'wird NULL gesetzt, damit die Seiten bleiben.';
