-- ===========================================================================
-- zusatzleistung-fenster-altbestand.sql — 30 Aufgaben ohne Zeitfenster
-- ---------------------------------------------------------------------------
-- BEFUND (03.09.2026, Kalender-Diagnose): 30 Aufgaben tragen NUR `due_at`,
-- kein `start_at` und kein `end_at`:
--
--   Zusatzleistung vorbereiten: Wäschepaket      29
--   Zusatzleistung vorbereiten: Babybett faltbar  1
--
-- Eine Aufgabe ohne Start hat kein Zeitfenster — niemand sieht, WANN sie zu
-- tun ist. Die Zeitachse musste sich den Tag deshalb aus `due_at` holen, also
-- aus dem ENDE, was bei einem Ende um Mitternacht eine Spalte zu weit rechts
-- landete.
--
-- URSACHE (im Code behoben): `TasksService._task_fuer_addon` schrieb nur
-- `due_at`. Der Insert setzt jetzt `start_at` = Fälligkeit minus vier Stunden
-- und `end_at` = Fälligkeit.
--
-- KORREKTUR desselben Zuschnitts für den Altbestand. `due_at` bleibt
-- unverändert, damit sich keine Fälligkeit verschiebt.
--
-- AUSFUEHREN:
--   ssh root@65.21.144.136 "docker exec -i db-cdqxi7d0w34sxzr4wr8jy8um \
--     psql -U postgres" < scripts/diagnose/zusatzleistung-fenster-altbestand.sql
-- ===========================================================================

begin;

create table if not exists tasks_ohne_fenster_backup_20260903 as
select id, tenant_id, title, start_at, end_at, due_at, now() as gesichert_am
from tasks
where start_at is null and due_at is not null;

do $$
declare n integer;
begin
  select count(*) into n from tasks_ohne_fenster_backup_20260903;
  if n = 0 then raise exception 'Sicherung leer — Abbruch.'; end if;
  raise notice 'Sicherung: % Aufgaben', n;
end $$;

update tasks t
set start_at = b.due_at - interval '4 hours',
    end_at = b.due_at,
    updated_at = now()
from tasks_ohne_fenster_backup_20260903 b
where t.id = b.id;

do $$
declare n integer;
begin
  select count(*) into n from tasks
  where start_at is null and due_at is not null;
  if n > 0 then
    raise exception 'Noch % Aufgabe(n) ohne Startzeit — Rollback.', n;
  end if;
  raise notice 'Gegenprobe: 0 Aufgaben ohne Zeitfenster.';
end $$;

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
--   update tasks t set start_at = b.start_at, end_at = b.end_at
--   from tasks_ohne_fenster_backup_20260903 b where t.id = b.id;
