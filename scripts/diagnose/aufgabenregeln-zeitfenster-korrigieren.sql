-- ===========================================================================
-- aufgabenregeln-zeitfenster-korrigieren.sql — drei Regeln auf Tagesanker
-- ---------------------------------------------------------------------------
-- BEFUND (03.09.2026, im Messgitter des Kalenders abgelesen): Buchung endet
-- am 14.09. (Spalte 56), die Reinigung sitzt auf dem 15. (Spalte 57). Ein Tag
-- zu weit. Dazu zeigte die Detailansicht „25.08.2026, 02:00 bis 26.08.2026,
-- 02:00" — eine Reinigung, die 24 Stunden dauert und um 02:00 nachts beginnt.
--
-- URSACHE, aus der Regel-Konfiguration gelesen:
--
--   Reng   start check_out            (start_clock LEER)
--          end   days_after_check_out (end_clock LEER, offset 0)
--   Velk   start days_before_check_in (start_clock LEER)
--          end   check_in             (end_offset_minutes 1440 = +24 h)
--
-- Drei Fehler in diesen zwei Zeilen:
--   1. `days_after_check_out` als ENDE erzeugt bei leerer Uhrzeit ein Ende
--      einen ganzen TAG nach dem Start. Gemessen: start 13.09. 10:00Z,
--      end 14.09. 10:00Z.
--   2. Leere `start_clock`/`end_clock` heisst Mitternacht UTC. In Kopenhagen
--      sind das 02:00 Ortszeit — daher „02:00" in der Detailansicht. Der
--      Tagesbeginn ist keine Arbeitszeit.
--   3. `end_offset_minutes = 1440` bei Velk legt das Ende des Empfangs auf
--      den Tag NACH der Anreise.
--
-- KORREKTUR: dieselbe Form, die bei „Anreisecheck" nachweislich richtig
-- arbeitet — Tagesanker plus gepflegte Ortszeit, Start und Ende am SELBEN Tag:
--
--   Reng  departure_day 10:00 -> departure_day 14:00   (Reinigung am Abreisetag)
--   Velk  arrival_day   14:00 -> arrival_day   18:00   (Empfang am Anreisetag)
--
-- Die Uhrzeiten sind die branchenueblichen Wechselzeiten (Abreise vormittags,
-- Anreise nachmittags) und decken sich mit den bereits gepflegten
-- `checkin_time`-Werten der Buchungen (15:00/16:00). Sie sind bewusst als
-- ORTSZEIT gesetzt; `engine._at` rechnet sie ueber die Objekt-Zeitzone nach
-- UTC.
--
-- Der Code ist bereits geschlossen: `_trigger_time` nimmt bei den Tagesankern
-- das Kalenderdatum der Reservierung statt `.date()` eines UTC-Zeitstempels
-- (sonst stand die Aufgabe einen Tag zu frueh, 25 Faelle live).
--
-- AUSFUEHREN:
--   ssh root@65.21.144.136 "docker exec -i db-cdqxi7d0w34sxzr4wr8jy8um \
--     psql -U postgres" < scripts/diagnose/aufgabenregeln-zeitfenster-korrigieren.sql
-- ===========================================================================

begin;

-- Sicherung DIREKT davor, im selben Vorgang.
create table if not exists task_rules_backup_20260903 as
select id, tenant_id, name, start_trigger, start_clock, start_offset_minutes,
       end_trigger, end_clock, end_offset_minutes, duration_minutes,
       now() as gesichert_am
from task_rules
where start_trigger is not null;

do $$
declare n integer;
begin
  select count(*) into n from task_rules_backup_20260903;
  if n = 0 then
    raise exception 'Sicherung ist leer — Abbruch.';
  end if;
  raise notice 'Sicherung: % Regeln', n;
end $$;

-- Reinigung: am Abreisetag, 10:00-14:00 vor Ort.
update task_rules
set start_trigger = 'departure_day',
    start_clock = '10:00',
    start_offset_minutes = 0,
    end_trigger = 'departure_day',
    end_clock = '14:00',
    end_offset_minutes = 0,
    updated_at = now()
where name = 'Reng'
  and start_trigger = 'check_out';

-- Empfang: am Anreisetag, 14:00-18:00 vor Ort.
update task_rules
set start_trigger = 'arrival_day',
    start_clock = '14:00',
    start_offset_minutes = 0,
    end_trigger = 'arrival_day',
    end_clock = '18:00',
    end_offset_minutes = 0,
    updated_at = now()
where name = 'Velk'
  and start_trigger = 'days_before_check_in';

-- Gegenprobe: keine aktive Regel darf mehr ohne Uhrzeit oder mit einem Ende
-- an einem ANDEREN Tagesanker als dem Start stehen.
do $$
declare n integer;
begin
  select count(*) into n
  from task_rules
  where start_trigger is not null
    and (start_clock is null or end_clock is null
         or end_offset_minutes <> 0
         or end_trigger <> start_trigger);
  if n > 0 then
    raise exception 'Noch % Regel(n) mit unstimmigem Zeitfenster — Rollback.', n;
  end if;
  raise notice 'Gegenprobe: alle aktiven Regeln haben ein stimmiges Zeitfenster.';
end $$;

commit;

-- Rueckweg (nur bei Bedarf):
--   update task_rules t set start_trigger = b.start_trigger,
--          start_clock = b.start_clock,
--          start_offset_minutes = b.start_offset_minutes,
--          end_trigger = b.end_trigger, end_clock = b.end_clock,
--          end_offset_minutes = b.end_offset_minutes
--   from task_rules_backup_20260903 b where t.id = b.id;
