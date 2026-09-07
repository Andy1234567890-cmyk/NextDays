-- 0576_regelsatz_min_stay_je_wochentag.sql — Mindestaufenthalt je ANREISETAG
--
-- ANLASS (06.09.2026, am Vorbild gemessen): Airbnbs Regel-Editor hat unter
-- „Länge des Aufenthalts" einen Schalter „Passe den Mindestaufenthalt an den
-- Tag des Check-in an". Ist er an, steht dort je Wochentag ein eigenes Feld
-- („Montage einchecken … Nächte"). In den Regelsätzen des Beta-Betriebs steht
-- die Regel als `min_nights: {"UNSPECIFIED": 2}` — derselbe Behälter, nur ohne
-- Wochentagsschlüssel.
--
-- Genau das fehlte bei uns: 0572 gab dem Regelsatz EINEN `min_stay` für alle
-- Tage. Ein Haus, das samstags sieben Nächte verlangt und mittwochs drei — der
-- Normalfall in der Ferienhausvermietung — war damit nicht abbildbar; die
-- Oberfläche hätte einen der beiden Werte unterschlagen müssen.
--
-- Form: jsonb-Objekt mit den Schlüsseln "0".."6" (0 = Montag … 6 = Sonntag,
-- dieselbe Zählung wie `closed_arrival_weekdays` aus 0572) und ganzen Zahlen
-- >= 1. Ein FEHLENDER Schlüssel heißt „für diesen Anreisetag gilt der
-- allgemeine `min_stay`", NICHT „0" (Wurzel 4). `{}` ist der Bestand und
-- ändert nichts.
--
-- Warum jsonb und keine sieben Spalten: die Regel ist eine Abbildung
-- Wochentag → Nächte, und sie wird als Ganzes gesetzt oder gelöscht. Sieben
-- Spalten würden bei jeder Änderung sieben Gegenzustände verlangen (Wurzel 1),
-- ohne dass je einzeln danach gefragt wird.
--
-- KEIN `begin;`/`commit;` in dieser Datei: `apply-migrations.sh` fährt jede
-- Migration bereits in einer eigenen Transaktion. Ein zweites `begin` erzeugt
-- nur die Warnung „there is already a transaction in progress" (so beim ersten
-- Anlauf am 06.09.2026 gesehen).

alter table public.property_seasons
    add column if not exists min_stay_by_weekday jsonb not null default '{}'::jsonb;

-- Der CHECK ist die eigentliche Zusage: nur die Schlüssel "0".."6", nur ganze
-- Zahlen >= 1. Ohne ihn könnte ein Direktschreiber am PostgREST (Wurzel 6)
-- `{"Montag": "viel"}` ablegen, und der Materialisierer bekäme beim Lesen
-- einen Wert, mit dem er nicht rechnen kann.
--
-- Ausgeschrieben statt als `not exists (select …)`: ein CHECK darf KEINE
-- Unterabfrage enthalten (`ERROR: cannot use subquery in check constraint`).
-- Der `-`-Operator entfernt die erlaubten Schlüssel; bleibt etwas übrig, ist
-- ein unerlaubter dabei. Die Werte prüft je Wochentag ein `case` — es
-- garantiert die Auswertungsreihenfolge, während ein `and` das nicht tut und
-- der Cast einer Zeichenkette nach numeric sonst selbst werfen könnte.
alter table public.property_seasons
    drop constraint if exists property_seasons_min_stay_by_weekday_form;
alter table public.property_seasons
    add constraint property_seasons_min_stay_by_weekday_form check (
        jsonb_typeof(min_stay_by_weekday) = 'object'
        and (min_stay_by_weekday - array['0','1','2','3','4','5','6']) = '{}'::jsonb
        and (case when min_stay_by_weekday ? '0'
             then jsonb_typeof(min_stay_by_weekday->'0') = 'number'
                  and (min_stay_by_weekday->>'0')::numeric >= 1
                  and (min_stay_by_weekday->>'0')::numeric
                      = trunc((min_stay_by_weekday->>'0')::numeric)
             else true end)
        and (case when min_stay_by_weekday ? '1'
             then jsonb_typeof(min_stay_by_weekday->'1') = 'number'
                  and (min_stay_by_weekday->>'1')::numeric >= 1
                  and (min_stay_by_weekday->>'1')::numeric
                      = trunc((min_stay_by_weekday->>'1')::numeric)
             else true end)
        and (case when min_stay_by_weekday ? '2'
             then jsonb_typeof(min_stay_by_weekday->'2') = 'number'
                  and (min_stay_by_weekday->>'2')::numeric >= 1
                  and (min_stay_by_weekday->>'2')::numeric
                      = trunc((min_stay_by_weekday->>'2')::numeric)
             else true end)
        and (case when min_stay_by_weekday ? '3'
             then jsonb_typeof(min_stay_by_weekday->'3') = 'number'
                  and (min_stay_by_weekday->>'3')::numeric >= 1
                  and (min_stay_by_weekday->>'3')::numeric
                      = trunc((min_stay_by_weekday->>'3')::numeric)
             else true end)
        and (case when min_stay_by_weekday ? '4'
             then jsonb_typeof(min_stay_by_weekday->'4') = 'number'
                  and (min_stay_by_weekday->>'4')::numeric >= 1
                  and (min_stay_by_weekday->>'4')::numeric
                      = trunc((min_stay_by_weekday->>'4')::numeric)
             else true end)
        and (case when min_stay_by_weekday ? '5'
             then jsonb_typeof(min_stay_by_weekday->'5') = 'number'
                  and (min_stay_by_weekday->>'5')::numeric >= 1
                  and (min_stay_by_weekday->>'5')::numeric
                      = trunc((min_stay_by_weekday->>'5')::numeric)
             else true end)
        and (case when min_stay_by_weekday ? '6'
             then jsonb_typeof(min_stay_by_weekday->'6') = 'number'
                  and (min_stay_by_weekday->>'6')::numeric >= 1
                  and (min_stay_by_weekday->>'6')::numeric
                      = trunc((min_stay_by_weekday->>'6')::numeric)
             else true end)
    );

comment on column public.property_seasons.min_stay_by_weekday is
    'Mindestaufenthalt je ANREISETAG: {"0".."6" (0=Mo) -> Nächte >= 1}. '
    'Fehlender Schlüssel = es gilt min_stay. {} = keine Wochentagsregel (0576).';
