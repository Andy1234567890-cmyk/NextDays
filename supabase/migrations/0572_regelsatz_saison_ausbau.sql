-- 0572_regelsatz_saison_ausbau.sql — die Saison wird ein vollständiger Regelsatz
--
-- ANLASS (06.09.2026): Der Gastgeber-Multikalender soll das können, was das
-- Vorbild kann (docs/AIRBNB-MULTIKALENDER-ANALYSE.md, Abschnitt F/G). Dort ist
-- ein Regelsatz EIN Ding mit Name, Farbe und dreierlei Regeln:
--   1. Preisänderung pro Nacht (Prozent, Senkung oder Erhöhung)
--   2. Rabatte (Aufenthaltsdauer, Last-Minute, Frühbucher)
--   3. Verfügbarkeit (Mindest-/Höchstaufenthalt, gesperrte An-/Abreisetage)
--
-- Bei uns lagen diese drei Teile bisher an drei Stellen und ohne Verbindung:
-- `property_seasons` trug nur Name, Farbe und Preisänderung; die Rabatte
-- hingen frei am Objekt; Mindestaufenthalt gab es NUR objektweit
-- (`rate_plans.min_stay`, „Per-Tag-Min-Stay ist v2"). Eine Oberfläche, die das
-- als einen Regelsatz zeigt, hätte die Zuordnung erfinden müssen.
--
-- Diese Migration schließt die Lücke an der Wurzel:
--   * property_seasons bekommt die Verfügbarkeits-Regeln des Satzes,
--   * property_discounts bekommt eine (optionale) Zugehörigkeit zum Satz,
--   * availability bekommt min_stay/max_stay JE TAG — der Ort, an dem eine
--     Saison ihre Aufenthaltsregel materialisiert (wie den Preis in
--     price_overrides).
--
-- Bestehendes Verhalten bleibt: alle neuen Spalten sind NULL-bar, `null` heißt
-- „keine Regel" und NICHT „0" (Wurzel 4). Wer nichts setzt, merkt nichts.

begin;

-- 1) Verfügbarkeits-Regeln am Regelsatz ---------------------------------------
alter table public.property_seasons
    add column if not exists min_stay int
        check (min_stay is null or min_stay >= 1),
    add column if not exists max_stay int
        check (max_stay is null or max_stay >= 1),
    -- Wochentage, an denen im Zeitraum dieser Saison NICHT an- bzw. abgereist
    -- werden darf. 0 = Montag … 6 = Sonntag (ISO-Reihenfolge wie im Vorbild,
    -- das die Liste mit „Montage" beginnt). Leeres Feld = keine Sperre.
    add column if not exists closed_arrival_weekdays smallint[] not null default '{}',
    add column if not exists closed_departure_weekdays smallint[] not null default '{}';

alter table public.property_seasons
    drop constraint if exists property_seasons_stay_order;
alter table public.property_seasons
    add constraint property_seasons_stay_order check (
        min_stay is null or max_stay is null or max_stay >= min_stay
    );

comment on column public.property_seasons.min_stay is
    'Mindestaufenthalt dieses Regelsatzes (Nächte). NULL = keine Regel (0572).';
comment on column public.property_seasons.max_stay is
    'Höchstaufenthalt dieses Regelsatzes (Nächte). NULL = keine Regel (0572).';
comment on column public.property_seasons.closed_arrival_weekdays is
    'Wochentage ohne Anreise, 0=Mo … 6=So. Leer = keine Sperre (0572).';
comment on column public.property_seasons.closed_departure_weekdays is
    'Wochentage ohne Abreise, 0=Mo … 6=So. Leer = keine Sperre (0572).';

-- 2) Rabatt gehört zu einem Regelsatz -----------------------------------------
-- NULL bleibt gültig und ist der Bestand: ein Rabatt, der für das ganze Objekt
-- gilt, unabhängig von einer Saison. `on delete set null`, damit das Löschen
-- einer Saison den Rabatt NICHT mitreißt — er ist eine eigene Zusage an den
-- Gast (Wurzel 1: der Gegenzustand ist „gehört zu keinem Satz mehr", nicht
-- „ist weg").
alter table public.property_discounts
    add column if not exists season_id uuid
        references public.property_seasons (id) on delete set null;

create index if not exists property_discounts_season_idx
    on public.property_discounts (season_id);

comment on column public.property_discounts.season_id is
    'Regelsatz, zu dem dieser Rabatt gehört. NULL = objektweit (0572).';

-- 3) Aufenthaltsregeln je Tag --------------------------------------------------
-- Bisher konnte NUR der ganze Rate-Plan einen Mindestaufenthalt tragen. Eine
-- Saison „Hochsommer, mindestens 7 Nächte" war damit nicht abbildbar, und die
-- Oberfläche musste behaupten, der Wert gelte für den Zeitraum, während er in
-- Wahrheit das ganze Jahr traf.
alter table public.availability
    add column if not exists min_stay int
        check (min_stay is null or min_stay >= 1),
    add column if not exists max_stay int
        check (max_stay is null or max_stay >= 1);

comment on column public.availability.min_stay is
    'Mindestaufenthalt DIESER Nacht. NULL = es gilt rate_plans.min_stay (0572).';
comment on column public.availability.max_stay is
    'Höchstaufenthalt DIESER Nacht. NULL = keine Grenze (0572).';

commit;
