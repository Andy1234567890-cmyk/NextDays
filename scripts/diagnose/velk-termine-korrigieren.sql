-- ===========================================================================
-- velk-termine-korrigieren.sql — die 161 falsch datierten Aufgaben richten
-- ---------------------------------------------------------------------------
-- BEFUND (31.08.2026): 161 von 234 anreisebezogenen Aufgaben standen am
-- falschen Tag, 151 davon genau EINEN Tag zu früh — der Empfang („Velk") lag
-- vor dem Gast. Neun trugen ein Ende bis zu 64 Tage VOR ihrem Start.
-- Aufgefallen im Kalender: die Aufgaben eines Wechsels standen auf zwei Tagen.
--
-- URSACHE: eine Regel-Konfiguration mit `days_before_check_in` und Offset 0.
-- Sie ist seit dem 31.08.2026 um 07:12 Uhr korrigiert (durch den Betrieb
-- selbst) — seither entstehen richtige Aufgaben. Der Altbestand blieb stehen,
-- weil der stündliche Abgleich nur Fehlendes anlegt und Vorhandenes nicht
-- anfasst.
--
-- Die Wiederholung ist im Code geschlossen:
--   * `TasksService._pruefe_zeitfenster` weist eine Regel ab, deren Ende vor
--     ihrem Start liegt (422, beim Anlegen UND beim Ändern).
--   * `engine._regel_zeitfenster` verwirft ein unmögliches Ende, statt es zu
--     schreiben, und protokolliert es.
--   * `scripts/diagnose/aufgaben-agenda-pruefen.sh` findet beides (3b/3c).
--
-- VORHER LÄUFT DIE SICHERUNG. Sie ist bereits angelegt:
--   tasks_zeitfenster_backup_20260831  (161 Zeilen, mit alten Werten)
-- Ohne sie NICHT ausführen — der Rückweg hängt an ihr.
--
-- AUSFÜHREN:
--   ssh root@65.21.144.136 "docker exec -i db-cdqxi7d0w34sxzr4wr8jy8um \
--     psql -U postgres" < scripts/diagnose/velk-termine-korrigieren.sql
-- ===========================================================================

begin;

-- Sicherung muss stehen, sonst gibt es keinen Rückweg.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_name = 'tasks_zeitfenster_backup_20260831'
  ) then
    raise exception 'Sicherung fehlt — Abbruch. Erst das Backup anlegen.';
  end if;
end $$;

-- Neu berechnet aus der Buchung und der HEUTIGEN Regel-Konfiguration, nicht
-- aus einer hier abgeschriebenen Formel: so schreibt die Korrektur genau das,
-- was der Motor beim nächsten Lauf auch schreiben würde.
update tasks t
set start_at = r.check_in::timestamptz
               + (coalesce(tr.start_offset_minutes, 0) || ' minutes')::interval,
    end_at   = r.check_in::timestamptz
               + (coalesce(tr.end_offset_minutes, 1440) || ' minutes')::interval,
    -- `due_at` ist die Fälligkeit und im Motor immer `end or start`. Ohne
    -- Nachziehen sortierte jede Liste weiter nach dem alten Termin (Wurzel 1).
    due_at   = r.check_in::timestamptz
               + (coalesce(tr.end_offset_minutes, 1440) || ' minutes')::interval
from reservations r, task_rules tr
where r.id = t.reservation_id
  and tr.id = t.rule_id
  and t.id in (select id from tasks_zeitfenster_backup_20260831);

-- Gegenprobe IN derselben Transaktion: bleibt eine Aufgabe daneben, wird
-- zurückgerollt statt halb korrigiert.
do $$
declare offen int;
begin
  select count(*) into offen
  from tasks t
  join reservations r on r.id = t.reservation_id
  join task_rules tr on tr.id = t.rule_id
  where t.start_at is not null
    and tr.start_trigger in ('check_in', 'days_before_check_in')
    and t.start_at::date <> r.check_in;
  if offen > 0 then
    raise exception 'Nach der Korrektur stehen noch % Aufgaben daneben — Rollback.', offen;
  end if;
  raise notice 'Alle anreisebezogenen Aufgaben stehen jetzt am Anreisetag.';
end $$;

commit;
