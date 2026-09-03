-- ===========================================================================
-- velk-ohne-regel-korrigieren.sql — 125 „Velk T" ohne Regel auf 14:00–18:00
-- ---------------------------------------------------------------------------
-- BEFUND (03.09.2026, Aufgaben-Popup): „Velk T · Erledigt · Von 21.08.2026,
-- 02:00 Bis 06:00". Diese Aufgaben tragen KEINE `rule_id` mehr — die
-- urspruengliche Regel wurde geloescht und neu angelegt (`on delete set
-- null`). Die Startzeit-Korrektur vom selben Tag lief ueber die Regel und
-- hat sie deshalb uebersprungen; das Ende „06:00" ist der 4-Stunden-Notnagel
-- der Zeitfenster-Korrektur fuer regellose Aufgaben.
--
-- Gemessen: 117x 02:00, 6x 01:00 (Winterzeit-Anker), 1x 10:00, 1x 18:00 —
-- alle `done`. Sie bekommen das Fenster der heutigen Empfangsregel „Velk"
-- (14:00–18:00 Ortszeit) am selben Tag, damit die Historie dieselbe Aussage
-- macht wie die laufenden Aufgaben.
-- ===========================================================================

begin;

create table if not exists tasks_velk_ohne_regel_backup_20260903 as
select t.id, t.start_at, t.end_at, t.due_at, p.timezone, now() as gesichert_am
from tasks t join properties p on p.id = t.property_id
where t.rule_id is null and t.title = 'Velk T' and t.start_at is not null
  and (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::time
      not in (time '14:00');

do $$
declare n integer;
begin
  select count(*) into n from tasks_velk_ohne_regel_backup_20260903;
  if n = 0 then raise exception 'Sicherung leer — Abbruch.'; end if;
  raise notice 'Sicherung: % Aufgaben', n;
end $$;

update tasks t
set start_at = ((t.start_at at time zone coalesce(nullif(b.timezone, ''), 'UTC'))::date
                + time '14:00') at time zone coalesce(nullif(b.timezone, ''), 'UTC'),
    end_at   = ((t.start_at at time zone coalesce(nullif(b.timezone, ''), 'UTC'))::date
                + time '18:00') at time zone coalesce(nullif(b.timezone, ''), 'UTC'),
    due_at   = ((t.start_at at time zone coalesce(nullif(b.timezone, ''), 'UTC'))::date
                + time '18:00') at time zone coalesce(nullif(b.timezone, ''), 'UTC'),
    updated_at = now()
from tasks_velk_ohne_regel_backup_20260903 b
where t.id = b.id;

do $$
declare n integer;
begin
  select count(*) into n from tasks t join properties p on p.id = t.property_id
  where t.rule_id is null and t.title = 'Velk T' and t.start_at is not null
    and (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::time <> time '14:00';
  if n > 0 then raise exception 'Noch % Velk T ohne 14:00 — Rollback.', n; end if;
  select count(*) into n from tasks where end_at < start_at;
  if n > 0 then raise exception 'Noch % mit Ende vor Start — Rollback.', n; end if;
  raise notice 'Gegenprobe: alle Velk T ohne Regel auf 14:00–18:00.';
end $$;

commit;
