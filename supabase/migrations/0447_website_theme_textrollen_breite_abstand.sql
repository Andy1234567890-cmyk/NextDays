-- 0447 — Theme: Text-Rollen (DFLT · PAR · H1–H6), Breiteneinheit, Abschnitts-Abstand
--
-- Der zweite Teil des Theme-Gleichzugs mit Hostaway (0446 war die Farbpalette).
-- Drei Dinge aus deren Panel:
--
--   1. „Text" — Rollen DFLT (alles ohne eigene Zuordnung, samt Linkfarbe und
--      den drei Zuständen normal/hover/besucht), PAR und H1–H6, je mit
--      Schriftart, Größe getrennt für Desktop und Mobil, „Text skalieren",
--      Farbe, Stärke, Zeilenhöhe, Laufweite, Großbuchstaben und Schatten.
--   2. „Breite & Abstand" — Seitenbreite in px ODER vw, dazu der Schalter
--      „Full width".
--   3. Abschnitts-Abstand, vertikal und horizontal.
--
-- WAS BEWUSST ANDERS IST ALS BEI HOSTAWAY
--
--   · Ausrichtung („Schriftformat") ist KEINE Theme-Einstellung. Dieselbe H2
--     steht im Hero zentriert und im Textabschnitt links; als Theme-Wert wäre
--     sie an einer der beiden Stellen immer falsch. Sie gehört an den Abschnitt.
--   · Textrichtung gibt es nicht. Sie folgt der SPRACHE, nicht dem Geschmack.
--     Unsere 24 Sprachen sind alle LTR; ein Schalter dafür täte entweder nichts
--     oder machte die Seite kaputt (Wurzel 4).
--   · Textschatten sind DREI benannte Stufen (keiner/weich/hart) statt vier
--     Zahlenfeldern. Der einzige legitime Zweck des Effekts ist Lesbarkeit auf
--     einem Foto; die freie Form ist die häufigste Art, eine Überschrift
--     unlesbar zu machen.
--   · „Spaltenabstand" und „Innerer Spaltenabstand" fehlen. Unser Renderer
--     stapelt ABSCHNITTE; eine allgemeine Spalten-Ebene gibt es nicht (Spalten
--     entstehen innerhalb eines Abschnitts-Typs und gehören zu dessen
--     Gestaltung). Zwei Regler, die auf nichts wirken, wären Attrappen.
--
-- WURZEL 1
--
-- `text_styles` ist eine LEERE Tabelle als Default, und jedes Feld darin ist
-- optional. Fehlt eine Rolle oder eine Eigenschaft, greift im Renderer der
-- var()-Rückfall, und der ist genau das, was heute gilt (globals.css). Die
-- beiden Abstände sind NULL-fähig und wirken ZUSÄTZLICH — sie ersetzen nichts.
-- `content_width_unit` bekommt 'px' als Default, weil die vorhandenen Werte
-- bereits Pixel SIND (theme.ts schrieb `${content_width}px`): das ist kein
-- erfundener Ersatzwert, sondern die Einheit der Bestandsdaten.

alter table public.tenant_site_config
    -- {"h1": {"size_desktop":48, "weight":700, ...}, ...}
    add column if not exists text_styles jsonb not null default '{}'::jsonb,
    add column if not exists content_width_unit text not null default 'px',
    add column if not exists content_full_width boolean not null default false,
    -- Zusätzlicher Abstand JE ABSCHNITT, in px. NULL = wie bisher (kein Zusatz).
    add column if not exists section_spacing_y smallint,
    add column if not exists section_spacing_x smallint;

-- Nur die acht bekannten Rollen. `jsonb - text[]` entfernt die erlaubten
-- Schlüssel; bleibt danach ein leeres Objekt übrig, waren alle erlaubt. Ein
-- Unterabfrage-CHECK wäre in Postgres nicht möglich, ein Regex über den
-- JSON-Text wäre die schlechtere Antwort (Wurzel 8: nie per Zeichenkette).
alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_text_styles_form;
alter table public.tenant_site_config
    add constraint tenant_site_config_text_styles_form check (
        jsonb_typeof(text_styles) = 'object'
        and (text_styles - '{dflt,par,h1,h2,h3,h4,h5,h6}'::text[]) = '{}'::jsonb
    );

alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_content_width_unit;
alter table public.tenant_site_config
    add constraint tenant_site_config_content_width_unit check (
        content_width_unit in ('px', 'vw')
    );

-- Der Bereich hängt an der Einheit: 960–1920 px oder 50–100 vw (Hostaways
-- Bereiche). Der CHECK aus 0435 kannte nur px und muss deshalb WEICHEN — nicht
-- geändert, sondern ersetzt: eine eingespielte Migration nachträglich zu
-- bearbeiten wirkt nicht.
alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_content_width_range;
alter table public.tenant_site_config
    add constraint tenant_site_config_content_width_range check (
        content_width is null
        or (content_width_unit = 'px' and content_width between 960 and 1920)
        or (content_width_unit = 'vw' and content_width between 50 and 100)
    );

alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_section_spacing_range;
alter table public.tenant_site_config
    add constraint tenant_site_config_section_spacing_range check (
        (section_spacing_y is null or section_spacing_y between 0 and 200)
        and (section_spacing_x is null or section_spacing_x between 0 and 200)
    );

comment on column public.tenant_site_config.text_styles is
    'Text-Rollen DFLT/PAR/H1-H6 mit Schrift, Groesse (Desktop+Mobil), Skalierung, '
    'Farbe, Staerke, Zeilenhoehe, Laufweite, Grossbuchstaben, Schatten. '
    'Fehlendes Feld = der heutige Renderer-Wert.';
comment on column public.tenant_site_config.content_width_unit is
    'Einheit von content_width: px (960-1920) oder vw (50-100).';
comment on column public.tenant_site_config.content_full_width is
    'true = Inhalt ueber die ganze Breite, unabhaengig von content_width.';
comment on column public.tenant_site_config.section_spacing_y is
    'ZUSAETZLICHER vertikaler Abstand je Abschnitt in px. NULL = kein Zusatz.';
comment on column public.tenant_site_config.section_spacing_x is
    'ZUSAETZLICHER horizontaler Abstand je Abschnitt in px. NULL = kein Zusatz.';
