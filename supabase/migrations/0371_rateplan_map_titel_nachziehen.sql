-- 0371 — Die Mapping-Titel dem bereinigten Plannamen nachziehen
--
-- 0367 entfernte „ (von Airbnb)" aus `rate_plans.name`. Die KOPIE des Namens in
-- `channex_rate_plan_map.title` blieb dabei stehen — sie wird beim Anlegen der
-- Zuordnung geschrieben und danach nicht mehr angefasst.
--
-- Folge, live gesehen am 11.08.2026 in der Channex-Oberfläche (Channels →
-- Booking.com → Mapping): dort steht neben einer Booking-Rate
-- „Grundpreis (von Airbnb) · BookingCom", während unser Plan längst
-- „Grundpreis · BookingCom" heißt. Zwei Namen für dieselbe Sache — und der
-- angezeigte nennt ein fremdes Portal. Wer das Mapping prüft, sieht es zuerst.
--
-- Der Titel ist reine Anzeige (die Verknüpfung läuft über
-- `channex_rate_plan_id` / `local_rate_plan_id`), deshalb ist das Nachziehen
-- gefahrlos. Es wird NICHT der Plannamen einfach überschrieben, sondern dasselbe
-- Fragment entfernt wie in 0367: der Kanalsuffix „ · BookingCom" bleibt, denn er
-- benennt das Portal, zu dem der Plan wirklich gehört.

update public.channex_rate_plan_map
   set title = trim(replace(title, ' (von Airbnb)', '')),
       updated_at = now()
 where title like '%(von Airbnb)%';

-- Dieselbe Gegenprobe wie in 0367: ein halb umbenannter Bestand wäre schlimmer
-- als der Ausgangszustand, weil niemand wüsste, welche Zeilen behandelt sind.
do $$
declare
  offen integer;
begin
  select count(*) into offen
    from public.channex_rate_plan_map
   where title like '%(von Airbnb)%';
  if offen > 0 then
    raise exception
      'Umbenennung unvollstaendig: % Zuordnungen tragen weiterhin "(von Airbnb)" im Titel.',
      offen;
  end if;
end $$;
