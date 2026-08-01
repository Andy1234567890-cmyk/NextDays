-- 0252 — die zweite, tote Saison-Welt entfernen
--
-- Es gab zwei Saison-Modelle nebeneinander:
--
--   A (tot)      season_templates(tenant) → seasons(percent) → season_periods,
--                dem Objekt zugewiesen über season_assignments.
--                Gelesen wurde A an genau EINER Stelle —
--                pricing/recompute.py::_season_pct_by_date, als Prozent-Aufschlag
--                im Dynamic Pricing. Einen SCHREIBpfad gibt es in der gesamten
--                Codebasis nicht: keine API-Route, kein Service, keine UI.
--                Folglich standen alle vier Tabellen auf 0 Zeilen und der
--                Saison-Faktor war immer 1.0. Eine stumme Attrappe.
--
--   B (in Betrieb) property_seasons(property, name, farbe, mode, amount) +
--                property_season_assignments(zeitraum). Voller CRUD im
--                calendar-Slice, Jahres-Kalender mit Drag & Drop, Realtime-Abo.
--                Wirkt auf die Preise über calendar._materialize: die Tagespreise
--                der Saison gehen als price_overrides raus und werden zu Channex
--                gepusht.
--
-- A auf B umzubiegen waere falsch gewesen: B materialisiert seinen Aufschlag
-- bereits in price_overrides: derselbe Prozentsatz zusaetzlich als
-- Dynamic-Pricing-Faktor haette ihn DOPPELT gezaehlt.
--
-- Der Lesepfad ist im selben Zug aus recompute.py entfernt worden.
--
-- Wurzel 1/5: der DO-Block bricht ab, statt Daten zu verlieren, falls in einer
-- Umgebung doch etwas in den Tabellen steht.

begin;

do $$
declare
  belegt text;
begin
  select string_agg(t.name || '=' || t.anzahl, ', ')
    into belegt
  from (
    select 'season_templates'   as name, count(*) as anzahl from public.season_templates
    union all
    select 'seasons',           count(*) from public.seasons
    union all
    select 'season_periods',    count(*) from public.season_periods
    union all
    select 'season_assignments', count(*) from public.season_assignments
  ) t
  where t.anzahl > 0;

  if belegt is not null then
    raise exception
      'Abbruch: die als tot angenommenen Saison-Tabellen sind nicht leer (%). '
      'Erst pruefen, wer sie befuellt hat.', belegt;
  end if;
end $$;

-- Reihenfolge entlang der Fremdschluessel: Zuweisung → Zeitraum → Saison → Vorlage.
drop table if exists public.season_assignments;
drop table if exists public.season_periods;
drop table if exists public.seasons;
drop table if exists public.season_templates;

commit;
