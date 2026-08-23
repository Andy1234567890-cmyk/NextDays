-- 0421 — Website-Baukasten: vom freien Canvas zum Theme + Abschnitts-Liste.
--
-- Der alte Editor war ein Framer-Nachbau (freies Canvas, Kamera/Zoom, Frames mit
-- x/y/w/h, Breakpoint-Flächen, Page-Variablen, Effects). Für Ferienvermieter war
-- das unbedienbar — und der Großteil davon wurde ohnehin nie persistiert, weil
-- site_blocks eine FLACHE, geordnete Liste ist (kein parent_id, keine Koordinaten).
--
-- Neues Modell (Branchenstandard, live abgelesen bei Lodgify am 23.08.2026):
--   Theme  = Header-/Footer-Skelett (4 Varianten, nicht bearbeitbar)
--   Tokens = Farben + Schriften + Button-Form (wenige, benannte Regler)
--   Seite  = geordnete Liste von Abschnitten (das ist site_blocks, unverändert)
-- Damit kann der Kunde nichts kaputt machen und trotzdem seine Marke setzen.
--
-- Sicherheit: beide Tabellen sind bereits per 0224/0337 dicht (revoke
-- insert/update/delete + restriktive Rollen-Policy). Neue SPALTEN erben das
-- Tabellen-GRANT, es entsteht also kein neuer Direktpfad — geprüft: ein
-- eingeloggter cleaner kann per anon-Key weder schreiben (revoke) noch
-- fremde Zeilen lesen (tenant-Policy). Kein zusätzliches revoke nötig.

-- == tenant_site_config: Theme + die restlichen Design-Tokens ==================

-- Header-/Footer-Skelett. KEIN Default: NULL = der Kunde hat nie gewählt, der
-- Renderer entscheidet dann (kein erfundener Wert in der DB, Wurzel 4).
alter table public.tenant_site_config
    add column if not exists theme text
        check (theme is null or theme in ('klar', 'mitte', 'karte', 'seitlich'));

-- Farb-Tokens. primary_color/secondary_color bestehen schon (0086); hier kommen
-- Flächen- und Schriftfarbe dazu, damit die vier CSS-Variablen des Renderers
-- (--primary/--secondary/--background/--foreground) vollständig setzbar sind.
alter table public.tenant_site_config
    add column if not exists background_color text
        check (background_color is null
               or background_color ~ '^#[0-9a-fA-F]{6}$');
alter table public.tenant_site_config
    add column if not exists foreground_color text
        check (foreground_color is null
               or foreground_color ~ '^#[0-9a-fA-F]{6}$');

-- Schriften. font_family (0086) bleibt die Absatz-/Body-Schrift; Überschrift und
-- Buttons sind getrennt wählbar (drei Achsen, wie im Markt üblich).
alter table public.tenant_site_config
    add column if not exists heading_font text;
alter table public.tenant_site_config
    add column if not exists button_font text;

-- Button-Form: zwei Achsen, jede mit endlicher Auswahl.
alter table public.tenant_site_config
    add column if not exists button_style text
        check (button_style is null or button_style in ('solid', 'outline'));
alter table public.tenant_site_config
    add column if not exists button_radius text
        check (button_radius is null
               or button_radius in ('sharp', 'rounded', 'pill'));

-- Logo-Skalierung (Faktor, wie der Slider im Markt). Sinnvolle Grenzen, damit
-- ein Tippfehler nicht die Kopfzeile sprengt.
alter table public.tenant_site_config
    add column if not exists logo_scale numeric(3, 2)
        check (logo_scale is null or (logo_scale >= 0.5 and logo_scale <= 3.0));

-- Favicon der Kunden-Site.
alter table public.tenant_site_config
    add column if not exists favicon_url text;

comment on column public.tenant_site_config.theme is
    'Header-/Footer-Skelett der Kunden-Site. NULL = nie gewählt, Renderer entscheidet.';
comment on column public.tenant_site_config.heading_font is
    'Schrift für Überschriften (Schlüssel aus dem Font-Katalog). NULL = Marken-Default.';
comment on column public.tenant_site_config.button_font is
    'Schrift für Button-Beschriftungen. NULL = Absatz-Schrift.';

-- == site_pages: wo eine Seite in der Navigation hängt ========================
-- Die Navigations-Zuordnung IST die Seitenstruktur: Kopfzeile, Fußzeile oder
-- gar nicht verlinkt (nur direkt erreichbar). Bisher gab es nur nav_order, also
-- eine Reihenfolge ohne Aussage darüber, WO die Seite auftaucht.
alter table public.site_pages
    add column if not exists nav_area text not null default 'header'
        check (nav_area in ('header', 'footer', 'none'));

comment on column public.site_pages.nav_area is
    'Navigationsbereich: header | footer | none (nicht verlinkt, nur per Direktlink).';

-- Reihenfolge gilt je Bereich, nicht global.
create index if not exists site_pages_nav_idx
    on public.site_pages (tenant_id, nav_area, nav_order);
