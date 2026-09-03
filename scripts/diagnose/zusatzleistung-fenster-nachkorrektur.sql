-- ===========================================================================
-- zusatzleistung-fenster-nachkorrektur.sql — Fenster auf den Anreisetag
-- ---------------------------------------------------------------------------
-- MEIN FEHLER (03.09.2026): `zusatzleistung-fenster-altbestand.sql` setzte
-- `start_at = due_at - 4h`. Bei diesen Aufgaben ist `due_at` aber
-- `00:00:00Z` — in Kopenhagen 02:00 ORTSZEIT des Anreisetags. Vier Stunden
-- davor ist 22:00Z, also der VORTAG:
--
--   start_at 2026-08-20 20:00Z   end_at 2026-08-21 00:00Z   check_in 2026-08-21
--
-- Damit standen 30 Aufgaben vor ihrer Anreise und 30 Fenster liefen über
-- Mitternacht — genau die zwei Klassen, die das Skript beseitigen sollte. Ein
-- Offset in Stunden auf einen Wert, der selbst schon Mitternacht ist, kann
-- den Tag nur verlassen.
--
-- RICHTIG: das Fenster am ANREISETAG vor Ort, 08:00-12:00. Die
-- Zusatzleistung muss vor dem Eintreffen des Gastes im Objekt sein; der
-- Anreisetag kommt aus `reservations.check_in` (eine `date`-Spalte, also
-- zonenfest) und nicht aus einem umgerechneten Zeitstempel.
--
-- `due_at` wird auf das Fensterende gezogen, damit Fälligkeit und Ende
-- dieselbe Aussage machen. Aufgaben ohne Reservierung behalten ihren
-- bisherigen Tag, nur mit Uhrzeiten statt Mitternacht.
--
-- AUSFUEHREN:
--   ssh root@65.21.144.136 "docker exec -i db-cdqxi7d0w34sxzr4wr8jy8um \
--     psql -U postgres" < scripts/diagnose/zusatzleistung-fenster-nachkorrektur.sql
-- ===========================================================================

begin;

update tasks t
set start_at = ((coalesce(r.check_in,
        (t.due_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date)
      + time '08:00') at time zone coalesce(nullif(p.timezone, ''), 'UTC')),
    end_at = ((coalesce(r.check_in,
        (t.due_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date)
      + time '12:00') at time zone coalesce(nullif(p.timezone, ''), 'UTC')),
    due_at = ((coalesce(r.check_in,
        (t.due_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date)
      + time '12:00') at time zone coalesce(nullif(p.timezone, ''), 'UTC')),
    updated_at = now()
from tasks_ohne_fenster_backup_20260903 b
join properties p on p.id = (select property_id from tasks where id = b.id)
left join reservations r on r.id = (select reservation_id from tasks where id = b.id)
where t.id = b.id;

do $$
declare n integer;
begin
  -- „Endreinigung nach Abreise" gehoert per Definition HINTER den Auszug —
  -- sie ist die einzige Aufgabenart, fuer die ein Termin nach `check_out`
  -- richtig ist. Sie hier mitzuzaehlen hiesse, einen korrekten Datensatz als
  -- Fehler zu melden und das ganze Skript daran zu blockieren.
  select count(*) into n from tasks t
    join reservations r on r.id = t.reservation_id
    join properties p on p.id = t.property_id
  where t.start_at is not null
    and t.title not ilike '%nach Abreise%'
    and ((t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date < r.check_in
      or (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date > r.check_out);
  if n > 0 then
    raise exception 'Noch % Aufgabe(n) ausserhalb ihrer Buchung — Rollback.', n;
  end if;
  raise notice 'Gegenprobe: 0 Aufgaben ausserhalb ihrer Buchung.';
end $$;

do $$
declare n integer;
begin
  select count(*) into n from tasks t join properties p on p.id = t.property_id
  where t.start_at is not null and t.end_at is not null
    and (t.end_at   at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date
      > (t.start_at at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date;
  if n > 0 then
    raise exception 'Noch % Fenster ueber Mitternacht — Rollback.', n;
  end if;
  raise notice 'Gegenprobe: 0 Fenster ueber Mitternacht.';
end $$;

commit;
