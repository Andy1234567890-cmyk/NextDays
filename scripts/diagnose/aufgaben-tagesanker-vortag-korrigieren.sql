-- ===========================================================================
-- aufgaben-tagesanker-vortag-korrigieren.sql — Tages-Anker-Aufgaben vom
-- Vortag zurueck auf Anreise- bzw. Abreisetag
-- ---------------------------------------------------------------------------
-- BEFUND (03.09.2026, 20:48 Ortszeit): Vier Regel-Speicherungen im deployten
-- Dashboard riefen `_regel_nachziehen(verschieben=True)` und rechneten alle
-- offenen Aufgaben der Regeln „Anreisecheck" und „Reinigung" mit dem NOCH
-- NICHT deployten Motor neu — `engine._trigger_time` nahm `.date()` des nach
-- UTC gerechneten Ankers (lokal 00:00 = 22:00Z des Vortags). Ergebnis: 25
-- Anreise- und 17 Abreise-Aufgaben genau EINEN Tag zu frueh, ausnahmslos bei
-- Buchungen ohne checkin_time/checkout_time (Booking.com, Website). Die
-- Korrektur von 19:13 (`anreisecheck-termine-korrigieren.sql`) war damit
-- rueckgaengig gemacht.
--
-- VORAUSSETZUNG: der Motor-Fix (610279d4) ist auf api UND worker deployt —
-- sonst schreibt der naechste Regel-Speicher oder Portal-Sync den Vortag
-- erneut. Geprueft am 03.09.2026, 21:24 (beide Container tragen die Zeile
-- `tag = _as_date(reservation.get("check_in"))`).
--
-- WAS GENAU: nur Aufgaben mit Regel-Trigger arrival_day/departure_day ohne
-- Minuten-Versatz, offen, deren Tag in der Objekt-Zone GENAU EINEN Tag vor
-- dem Anreise- bzw. Abreisetag liegt (das Muster des Fehlers). Groessere
-- Abstaende bleiben stehen: das koennen bewusste Verschiebungen von Hand
-- sein (Drag & Drop, Popover), und die zurueckzuschnappen waere ein zweiter
-- Fehler. Ende und Faelligkeit wandern um denselben Tag mit (Wurzel 1).
--
-- AUSFUEHREN (die Sicherung legt das Skript selbst an):
--   ssh root@65.21.144.136 "docker exec -i \$(docker ps --format '{{.Names}}' | grep '^db-' | head -1) \
--     psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1" \
--     < scripts/diagnose/aufgaben-tagesanker-vortag-korrigieren.sql
-- ===========================================================================
begin;

-- Sicherung DIREKT davor, im selben Vorgang: genau die Zeilen, die geaendert werden.
create table tasks_tagesanker_backup_20260903b as
select t.id, t.tenant_id, t.title, t.start_at, t.end_at, t.due_at, t.reservation_id,
       tr.start_trigger, r.check_in, r.check_out, p.timezone, now() as gesichert_am
from tasks t
join reservations r on r.id = t.reservation_id
join task_rules tr on tr.id = t.rule_id
join properties p on p.id = t.property_id
where tr.start_trigger in ('arrival_day', 'departure_day')
  and coalesce(tr.start_offset_minutes, 0) = 0
  and t.status not in ('done', 'cancelled')
  and t.start_at is not null
  and (case tr.start_trigger when 'arrival_day' then r.check_in else r.check_out end)
      - (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date = 1;

do $$
declare n integer;
begin
  select count(*) into n from tasks_tagesanker_backup_20260903b;
  if n = 0 then
    raise exception 'Sicherung ist leer — Abbruch. Nichts zu korrigieren?';
  end if;
  raise notice 'Sicherung: % Aufgaben', n;
end $$;

update tasks t
set start_at   = t.start_at + interval '1 day',
    end_at     = case when t.end_at is null then null else t.end_at + interval '1 day' end,
    due_at     = case when t.due_at is null then null else t.due_at + interval '1 day' end,
    updated_at = now()
from tasks_tagesanker_backup_20260903b b
where b.id = t.id;

-- Gegenprobe: keine korrigierte Aufgabe darf noch neben ihrem Tag liegen.
do $$
declare n integer;
begin
  select count(*) into n
  from tasks t
  join tasks_tagesanker_backup_20260903b b on b.id = t.id
  join properties p on p.id = t.property_id
  where (case b.start_trigger when 'arrival_day' then b.check_in else b.check_out end)
        <> (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date;
  if n > 0 then
    raise exception 'Noch % Aufgabe(n) neben ihrem Tag — Rollback.', n;
  end if;
  raise notice 'Gegenprobe: alle korrigierten Aufgaben liegen auf ihrem Tag.';
end $$;

commit;

-- Stand danach: Versatz aller offenen Tages-Anker-Aufgaben mit Zukunft (0 = richtig).
select tr.start_trigger,
       (case tr.start_trigger when 'arrival_day' then r.check_in else r.check_out end)
       - (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date as versatz_tage,
       count(*)
from tasks t
join reservations r on r.id = t.reservation_id
join task_rules tr on tr.id = t.rule_id
join properties p on p.id = t.property_id
where tr.start_trigger in ('arrival_day', 'departure_day')
  and coalesce(tr.start_offset_minutes, 0) = 0
  and t.status not in ('done', 'cancelled')
  and r.check_out >= current_date
group by 1, 2
order by 1, 2;
