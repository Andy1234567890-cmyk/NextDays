-- ===========================================================================
-- anreisecheck-termine-korrigieren.sql — 25 Anreisechecks auf den Anreisetag
-- ---------------------------------------------------------------------------
-- BEFUND (03.09.2026): 25 von 43 Aufgaben der Regel „Anreisecheck" standen
-- genau EINEN TAG VOR der Anreise. Aufgefallen in der Aufgaben-Zeitachse: die
-- Pille lag links neben ihrem Buchungsbalken.
--
-- URSACHE (im Code geschlossen): `engine._trigger_time` nahm bei den Ankern
-- `arrival_day`/`departure_day` `.date()` eines Zeitstempels, der bereits nach
-- UTC gerechnet war. Ohne gepflegte `checkin_time` setzt `_reservation_anchors`
-- den Tagesbeginn VOR ORT — in Kopenhagen im Sommer `22:00Z des Vortags`.
-- `.date()` las daraus den Vortag.
--
-- Die Korrelation war lueckenlos und deshalb tueckisch:
--   checkin_time gepflegt -> 18 von 18 richtig
--   checkin_time leer     -> 25 von 25 falsch
-- Live haben 1346 von 1531 Buchungen keine `checkin_time`.
--
-- Der Code rechnet ab jetzt mit dem KALENDERDATUM der Reservierung
-- (`reservations.check_in` ist eine `date`-Spalte). Abgesichert durch
-- `test_tages_anker_ohne_anreisezeit_bleibt_am_richtigen_TAG` (faellt ohne den
-- Fix mit `2026-08-09` statt `2026-08-10`) und die Gegenprobe westlich von
-- Greenwich, damit ein stumpfes „+1 Tag" nicht durchgeht.
--
-- Der Altbestand bleibt stehen, weil der stuendliche Abgleich
-- (`_regel_anwenden`, `verschieben=False`) nur Fehlendes anlegt und
-- Vorhandenes nie nachzieht — dieselbe Wurzel wie am 31.08.2026 bei „Velk".
--
-- NICHT ANGEFASST: die 103 Aufgaben, deren ENDE nach der Abreise liegt. Ihr
-- `start_at` ist korrekt; sie standen nur falsch, weil die Zeitachse `due_at`
-- (= das Ende) als Startspalte las. Das ist im Frontend behoben, nicht hier.
--
-- AUSFUEHREN (die Sicherung legt das Skript selbst an):
--   ssh root@65.21.144.136 "docker exec -i db-cdqxi7d0w34sxzr4wr8jy8um \
--     psql -U postgres" < scripts/diagnose/anreisecheck-termine-korrigieren.sql
-- ===========================================================================

begin;

-- Sicherung DIREKT davor, im selben Vorgang. Ohne sie gibt es keinen Rueckweg.
create table if not exists tasks_anreise_backup_20260903 as
select t.id, t.tenant_id, t.title, t.start_at, t.end_at, t.due_at,
       t.reservation_id, t.property_id, r.check_in, r.check_out,
       now() as gesichert_am
from tasks t
join reservations r on r.id = t.reservation_id
join properties p on p.id = t.property_id
where t.start_at is not null
  and (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
      < r.check_in;

do $$
declare n integer;
begin
  select count(*) into n from tasks_anreise_backup_20260903;
  if n = 0 then
    raise exception 'Sicherung ist leer — Abbruch. Nichts zu korrigieren?';
  end if;
  raise notice 'Sicherung: % Zeilen', n;
end $$;

-- Die Korrektur: Start und Ende um die gemessene Differenz nach vorn schieben,
-- damit die UHRZEIT vor Ort erhalten bleibt. Ein Setzen auf eine feste Stunde
-- waere ein erfundener Wert (Wurzel 4) — die Regel-Uhrzeit steckt schon drin.
-- Die Differenz ist eine Anzahl TAGE (`date - date` gibt `integer`), sie muss
-- als Intervall addiert werden — sonst weist Postgres den Ausdruck ab. Genau
-- daran ist der Probelauf gescheitert, bevor irgendetwas geschrieben war.
update tasks t
set start_at = t.start_at + (b.versatz_tage * interval '1 day'),
    end_at = case when t.end_at is null then null
                  else t.end_at + (b.versatz_tage * interval '1 day') end,
    due_at = case when t.due_at is null then null
                  else t.due_at + (b.versatz_tage * interval '1 day') end,
    updated_at = now()
from (
  select b.id,
         b.check_in - (b.start_at at time zone
           coalesce(nullif(p.timezone, ''), 'UTC'))::date as versatz_tage
  from tasks_anreise_backup_20260903 b
  join properties p on p.id = b.property_id
) b
where t.id = b.id
  and b.versatz_tage <> 0;

-- Gegenprobe im selben Vorgang: keine Aufgabe darf noch vor ihrer Anreise
-- liegen. Schlaegt das an, rollt `begin` alles zurueck.
do $$
declare n integer;
begin
  select count(*) into n
  from tasks t
  join reservations r on r.id = t.reservation_id
  join properties p on p.id = t.property_id
  where t.start_at is not null
    and (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
        < r.check_in;
  if n > 0 then
    raise exception 'Noch % Aufgaben vor der Anreise — Rollback.', n;
  end if;
  raise notice 'Gegenprobe: 0 Aufgaben vor ihrer Anreise.';
end $$;

commit;

-- Rueckweg (nur bei Bedarf, nicht Teil des Laufs):
--   update tasks t set start_at = b.start_at, end_at = b.end_at,
--          due_at = b.due_at
--   from tasks_anreise_backup_20260903 b where t.id = b.id;
