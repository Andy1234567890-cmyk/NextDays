-- ===========================================================================
-- aufgaben-zeitfenster-altbestand.sql — 233 Zeitfenster auf EINEN Tag ziehen
-- ---------------------------------------------------------------------------
-- BEFUND (03.09.2026, in der Kalender-Diagnose abgelesen): Aufgaben endeten
-- einen ganzen TAG nach ihrem Start. Die Detailansicht zeigte deshalb
-- „25.08.2026, 02:00 bis 26.08.2026, 02:00" — eine Reinigung, die 24 Stunden
-- dauert und nachts um 02:00 beginnt. Gezaehlt:
--
--   Velk T  120   genau +1 Tag
--   Reng T   67   genau +1 Tag
--   Velk J   41   +1 bis +15 Tage
--   Reng J    5   genau +1 Tag
--
-- URSACHE (an der Wurzel bereits behoben): die Regeln trugen
-- `end_trigger = days_after_check_out` bzw. `end_offset_minutes = 1440` und
-- KEINE Uhrzeiten. Leere `start_clock` heisst Mitternacht UTC = 02:00 in
-- Kopenhagen, und das Ende landete einen Tag weiter. Seit
-- `aufgabenregeln-zeitfenster-korrigieren.sql` stehen beide Regeln auf
-- Tagesankern mit Ortszeit (Reinigung 10:00-14:00 am Abreisetag, Empfang
-- 14:00-18:00 am Anreisetag).
--
-- Der Altbestand bleibt stehen, weil der stuendliche Abgleich
-- (`_regel_anwenden`, `verschieben=False`) nur Fehlendes anlegt.
--
-- KORREKTUR: das Ende auf den TAG DES STARTS ziehen und die Arbeitszeit aus
-- der zugehoerigen Regel uebernehmen. Ist keine Regel hinterlegt, gilt eine
-- Dauer von vier Stunden ab Start — dieselbe Spanne, die die korrigierten
-- Regeln setzen. Das ist keine erfundene Uhrzeit, sondern die Spanne, die
-- fuer diese Aufgabenart jetzt gilt.
--
-- AUSFUEHREN:
--   ssh root@65.21.144.136 "docker exec -i db-cdqxi7d0w34sxzr4wr8jy8um \
--     psql -U postgres" < scripts/diagnose/aufgaben-zeitfenster-altbestand.sql
-- ===========================================================================

begin;

create table if not exists tasks_fenster_backup_20260903 as
select t.id, t.tenant_id, t.title, t.start_at, t.end_at, t.due_at,
       t.rule_id, t.property_id, p.timezone, now() as gesichert_am
from tasks t
join properties p on p.id = t.property_id
where t.start_at is not null and t.end_at is not null
  and (t.end_at   at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
    > (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date;

do $$
declare n integer;
begin
  select count(*) into n from tasks_fenster_backup_20260903;
  if n = 0 then raise exception 'Sicherung leer — Abbruch.'; end if;
  raise notice 'Sicherung: % Aufgaben', n;
end $$;

-- Das Ende auf denselben Tag wie der Start, mit der Uhrzeit aus der Regel.
-- `end_clock` ist nach der Regel-Korrektur gesetzt; fehlt sie, gilt Start+4h.
update tasks t
set end_at = case
      when r.end_clock is not null then
        ((t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
          + r.end_clock) at time zone coalesce(nullif(p.timezone, ''), 'UTC')
      else t.start_at + interval '4 hours'
    end,
    due_at = case
      when r.end_clock is not null then
        ((t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
          + r.end_clock) at time zone coalesce(nullif(p.timezone, ''), 'UTC')
      else t.start_at + interval '4 hours'
    end,
    updated_at = now()
from tasks_fenster_backup_20260903 b
join properties p on p.id = b.property_id
left join task_rules r on r.id = b.rule_id
where t.id = b.id;

-- Gegenprobe: kein Zeitfenster darf noch ueber Mitternacht laufen.
do $$
declare n integer;
begin
  select count(*) into n
  from tasks t join properties p on p.id = t.property_id
  where t.start_at is not null and t.end_at is not null
    and (t.end_at   at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
      > (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date;
  if n > 0 then
    raise exception 'Noch % Aufgabe(n) mit Ende am Folgetag — Rollback.', n;
  end if;
  raise notice 'Gegenprobe: 0 Aufgaben laufen ueber Mitternacht.';
end $$;

-- Gegenprobe 2: kein Ende vor dem Start (Wurzel 1).
do $$
declare n integer;
begin
  select count(*) into n from tasks
  where start_at is not null and end_at is not null and end_at < start_at;
  if n > 0 then raise exception 'Noch % mit Ende vor Start — Rollback.', n; end if;
  raise notice 'Gegenprobe: 0 Aufgaben mit Ende vor dem Start.';
end $$;

commit;

-- Rueckweg:
--   update tasks t set end_at = b.end_at, due_at = b.due_at
--   from tasks_fenster_backup_20260903 b where t.id = b.id;
