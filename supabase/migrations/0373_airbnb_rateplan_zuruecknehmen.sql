-- 0373 — Preisplan zurücknehmen, wo das Portal keinen gemeldet hat
--
-- WAS ICH ZUERST ANNAHM UND WAS FALSCH WAR: Nach 0372 trugen 16
-- Airbnb-Reservierungen einen Preisplan, und ich hielt das für erfunden — mit der
-- Begründung „Airbnb kennt keine Rate-Plans". Die Live-Daten sagen etwas anderes:
--
--   ota_name   | Buchungen | rooms[0].rate_plan_id | meta.rate_plan_code
--   AirBNB     |        22 |                    16 |                   0
--   BookingCom |        55 |                    52 |                  55
--
-- Airbnb meldet keinen eigenen Rate-Plan-CODE, aber Channex löst die Buchung
-- trotzdem einem seiner Pläne zu und schickt die aufgelöste `rate_plan_id` mit.
-- Die 16 Werte sind also BELEGT: Payload → Mapping-Tabelle → Plan am richtigen
-- Objekt, an allen 16 nachgeprüft. 0372 war korrekt.
--
-- Die Migration bleibt trotzdem stehen, weil ihre Bedingung richtig ist und einen
-- echten Fall abdeckt: ein Preisplan an einer Portal-Buchung, deren Payload
-- keinen nennt, wäre geraten (Wurzel 4). Aktuell trifft sie null Zeilen — das ist
-- der gewünschte Zustand, nicht ein Fehlschlag. Sie ist damit die dauerhafte
-- Gegenprobe zu 0372: sollte ein künftiger Backfill wieder über die
-- kanalübergreifende Mapping-Tabelle auflösen statt über den Payload, holt dieser
-- Lauf die geratenen Werte zurück.

update public.reservations r
   set rate_plan_id = null,
       updated_at   = now()
  from public.channex_booking cb
 where cb.channex_booking_id = r.source_channex_booking_id
   and cb.tenant_id          = r.tenant_id
   and r.rate_plan_id is not null
   -- Das Portal hat keinen Plan gemeldet → wir dürfen keinen führen.
   and (cb.raw #>> '{rooms,0,rate_plan_id}') is null;

-- Gegenprobe: keine Reservierung darf einen Plan tragen, den ihre Buchung nicht
-- gemeldet hat.
do $$
declare
  offen integer;
begin
  select count(*) into offen
    from public.reservations r
    join public.channex_booking cb
      on cb.channex_booking_id = r.source_channex_booking_id
     and cb.tenant_id          = r.tenant_id
   where r.rate_plan_id is not null
     and (cb.raw #>> '{rooms,0,rate_plan_id}') is null;
  if offen > 0 then
    raise exception
      'Ruecknahme unvollstaendig: % Reservierungen fuehren einen Preisplan, den das Portal nie gemeldet hat.',
      offen;
  end if;
end $$;
