-- ===========================================================================
-- aufgaben-startzeit-altbestand.sql — Startzeit aus der Regel, nicht 02:00
-- ---------------------------------------------------------------------------
-- MEIN FEHLER (03.09.2026): `aufgaben-zeitfenster-altbestand.sql` zog das
-- ENDE auf den Starttag, liess den START aber bei `00:00Z` stehen — in
-- Kopenhagen 02:00. Die Detailansicht zeigte weiter „Von 02:00".
--
-- Der Start kommt jetzt aus `task_rules.start_clock` der zugehoerigen Regel
-- (Reinigung 10:00, Empfang 14:00 Ortszeit), am selben Tag wie bisher.
-- Aufgaben ohne Regel oder ohne `start_clock` bleiben unangetastet.
-- ===========================================================================

begin;

create table if not exists tasks_startzeit_backup_20260903 as
select t.id, t.start_at, t.end_at, t.due_at, now() as gesichert_am
from tasks t
join task_rules r on r.id = t.rule_id
join properties p on p.id = t.property_id
where t.start_at is not null and r.start_clock is not null
  and (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::time
      <> r.start_clock;

do $$
declare n integer;
begin
  select count(*) into n from tasks_startzeit_backup_20260903;
  if n = 0 then raise exception 'Sicherung leer — Abbruch.'; end if;
  raise notice 'Sicherung: % Aufgaben', n;
end $$;

-- Start UND Ende aus der Regel: der erste Probelauf setzte nur den Start und
-- liess 139 Aufgaben mit einem Ende VOR dem Start zurueck — ihr Ende stand
-- noch auf dem alten 02:00. Beide Kanten muessen aus derselben Quelle kommen.
update tasks t
set start_at = ((t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
                + r.start_clock) at time zone coalesce(nullif(p.timezone, ''), 'UTC'),
    end_at = case when r.end_clock is null then t.end_at else
             ((t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
                + r.end_clock) at time zone coalesce(nullif(p.timezone, ''), 'UTC') end,
    due_at = case when r.end_clock is null then t.due_at else
             ((t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
                + r.end_clock) at time zone coalesce(nullif(p.timezone, ''), 'UTC') end,
    updated_at = now()
from tasks_startzeit_backup_20260903 b
join task_rules r on r.id = (select rule_id from tasks where id = b.id)
join properties p on p.id = (select property_id from tasks where id = b.id)
where t.id = b.id;

do $$
declare n integer;
begin
  select count(*) into n from tasks
  where start_at is not null and end_at is not null and end_at < start_at;
  if n > 0 then raise exception 'Noch % mit Ende vor Start — Rollback.', n; end if;
  raise notice 'Gegenprobe: 0 Aufgaben mit Ende vor dem Start.';
end $$;

do $$
declare n integer;
begin
  select count(*) into n from tasks t
    join task_rules r on r.id = t.rule_id
    join properties p on p.id = t.property_id
  where t.start_at is not null and r.start_clock is not null
    and (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::time
        <> r.start_clock;
  if n > 0 then raise exception 'Noch % mit fremder Startzeit — Rollback.', n; end if;
  raise notice 'Gegenprobe: alle Regel-Aufgaben starten zur Regelzeit.';
end $$;

commit;
