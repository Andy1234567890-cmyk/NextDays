-- 0446 — Theme: Designfarben als benannte Palette mit feldweiser Verknüpfung
--
-- Hostaway führt im Theme-Panel „bis zu 30 Designfarben", die frei benannt
-- werden; Widgets werden mit einer Farbe VERKNÜPFT und ziehen automatisch mit,
-- die Verknüpfung ist einzeln lösbar. Wir hatten neun feste Farbspalten
-- (0086/0426) und keine Palette.
--
-- WAS HIER ENTSTEHT UND WAS NICHT
--
-- Es entsteht kein zweites Farbsystem neben dem bestehenden. Die neun Spalten
-- bleiben die AUFGELÖSTE Wahrheit: dort steht immer der Wert, der gilt, und
-- Renderer, öffentlicher Resolver und Vorschau lesen weiter genau sie. Neu ist
-- eine Ebene DARÜBER:
--
--   theme_colors        die benannte Palette (bis 30 Einträge)
--   theme_color_links   welche Rolle an welchem Palettenposten hängt
--
-- Der Service (`_farbrollen_aufloesen`) schreibt beim Speichern jeden
-- verknüpften Palettenwert in seine Rolle durch. Damit ist die Palette die
-- Bearbeitungs-Ebene und die Spalte die Ausliefer-Ebene — und es gibt zu jedem
-- Zeitpunkt nur EINEN geltenden Wert.
--
-- 30 EINTRÄGE JA, 30 FREI BENANNTE ROLLEN NEIN
--
-- Hostaways Zahl wird für die PALETTE übernommen: ein Paletteneintrag ist ein
-- Listenposten und kostet keine Bedienfläche. Die ROLLEN bleiben der feste,
-- benannte Satz aus 0426 — eine Rolle sagt, WO die Farbe wirkt. Eine frei
-- benannte Rolle, zu der es im Renderer keine Stelle gibt, wäre eine Zeile in
-- der Oberfläche, die nichts tut. Hostaway kann sich freie Rollen leisten, weil
-- dort jedes einzelne Widget an eine Farbe gebunden wird; unser Renderer bindet
-- an Rollen, damit ein NEUER Abschnitt automatisch markenkonform ist, ohne dass
-- jemand daran denken muss.
--
-- WURZEL 1 — der Gegenzustand
--
-- Beide Spalten sind NOT NULL mit leerem Default, und der Backfill unten
-- überträgt die BESTEHENDEN Werte verlustfrei in die neue Form: je
-- unterschiedlicher Farbwert ein Paletteneintrag, jede Rolle darauf verknüpft.
-- Die Spaltenwerte selbst werden dabei NICHT angefasst. Eine bestehende Seite
-- sieht nach dem Deploy deshalb exakt aus wie vorher — sie hat nur zusätzlich
-- eine Palette, in der ihre eigenen Farben stehen.
--
-- Der zweite Gegenzustand steht im Service: wird ein Paletteneintrag gelöscht,
-- fällt die VERKNÜPFUNG weg und der zuletzt gültige Wert bleibt in der Spalte
-- stehen. Die Rolle mitzuleeren würde beim Aufräumen der Palette stillschweigend
-- das Aussehen der Website ändern.

alter table public.tenant_site_config
    -- Liste von {"id","name","color"}. `id` wandert in einen CSS-Variablennamen
    -- des Renderers und ist deshalb auf [a-z0-9_-] beschränkt (Prüfung im
    -- Pydantic-Schema, siehe basis._FARB_ID_RE) — ein Anführungszeichen darin
    -- wäre ein Ausbruch aus der Style-Angabe (Wurzel 8).
    add column if not exists theme_colors jsonb not null default '[]'::jsonb,
    -- Abbildung Rolle → Palette-Kennung. Rolle ist ein Schlüssel aus
    -- basis._ROLLE_ZIEL (die neun Farbspalten plus die Schriftfarben der
    -- Text-Rollen aus 0447).
    add column if not exists theme_color_links jsonb not null default '{}'::jsonb;

alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_theme_colors_form;
alter table public.tenant_site_config
    add constraint tenant_site_config_theme_colors_form check (
        jsonb_typeof(theme_colors) = 'array'
        and jsonb_array_length(theme_colors) <= 30
    );

alter table public.tenant_site_config
    drop constraint if exists tenant_site_config_theme_color_links_form;
alter table public.tenant_site_config
    add constraint tenant_site_config_theme_color_links_form check (
        jsonb_typeof(theme_color_links) = 'object'
    );

comment on column public.tenant_site_config.theme_colors is
    'Benannte Designfarben-Palette (max. 30): [{"id","name","color"}]. '
    'Bearbeitungs-Ebene; der geltende Wert steht in der jeweiligen Farbspalte.';
comment on column public.tenant_site_config.theme_color_links is
    'Rolle -> Palette-Kennung. Feldweise: eine von Hand gesetzte Rolle loest '
    'ihre Verknuepfung, die uebrigen bleiben.';

-- --------------------------------------------------------------------------
-- Backfill: bestehende Farben verlustfrei in die Palette übernehmen
-- --------------------------------------------------------------------------
--
-- `name` und `id` sind der ROLLENSCHLÜSSEL der ersten Rolle, die diesen Wert
-- führt — und ausdrücklich KEIN deutscher Klartext. Eine Migration darf keine
-- Sprache festschreiben: der Betrieb kann dänisch sein, und „Markenfarbe" stünde
-- dann für immer in seiner Palette. Die Oberfläche übersetzt einen Namen, der
-- exakt einem bekannten Rollenschlüssel entspricht (design-leiste.tsx); sobald
-- der Kunde umbenennt, gilt sein eigener Text.
--
-- Nur Zeilen mit noch leerer Palette werden angefasst — die Migration ist damit
-- wiederholbar, ohne eine bereits gepflegte Palette zu überschreiben (Wurzel 2).

with rollen as (
    select c.tenant_id, r.ord, r.rolle, r.wert
    from public.tenant_site_config c
    cross join lateral (values
        (1, 'primary_color',     c.primary_color),
        (2, 'background_color',  c.background_color),
        (3, 'foreground_color',  c.foreground_color),
        (4, 'secondary_color',   c.secondary_color),
        (5, 'brand_name_color',  c.brand_name_color),
        (6, 'header_background', c.header_background),
        (7, 'header_link_color', c.header_link_color),
        (8, 'link_color',        c.link_color),
        (9, 'footer_background', c.footer_background)
    ) as r(ord, rolle, wert)
    where r.wert is not null
      and c.theme_colors = '[]'::jsonb
),
-- Je Farbwert der Rollenschlüssel mit der kleinsten Ordnung: er benennt den
-- Paletteneintrag. Verglichen wird der Wert UNVERÄNDERT (nicht klein
-- geschrieben) — die Palette soll exakt das tragen, was in der Spalte steht.
erste as (
    select distinct on (tenant_id, wert) tenant_id, wert, rolle
    from rollen
    order by tenant_id, wert, ord
),
palette as (
    select tenant_id,
           jsonb_agg(
               jsonb_build_object('id', rolle, 'name', rolle, 'color', wert)
               order by rolle
           ) as farben
    from erste
    group by tenant_id
),
verknuepfungen as (
    select r.tenant_id, jsonb_object_agg(r.rolle, e.rolle) as verkn
    from rollen r
    join erste e on e.tenant_id = r.tenant_id and e.wert = r.wert
    group by r.tenant_id
)
update public.tenant_site_config c
set theme_colors = p.farben,
    theme_color_links = v.verkn
from palette p
join verknuepfungen v on v.tenant_id = p.tenant_id
where c.tenant_id = p.tenant_id
  and c.theme_colors = '[]'::jsonb;
