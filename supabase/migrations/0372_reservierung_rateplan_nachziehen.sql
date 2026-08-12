-- 0372 — Den vom Portal gemeldeten Preisplan an den Altbestand nachtragen
--
-- DER BEFUND (11.08.2026, live gezählt): von 226 projizierten Reservierungen
-- trug KEINE EINZIGE eine `rate_plan_id`, obwohl Channex den Plan bei 68 von 77
-- Booking-Buchungen im Payload mitliefert (`rooms[0].rate_plan_id`) und
-- `channex_rate_plan_map` ihn bei allen 68 auf einen lokalen Plan auflöst. Die
-- Information kam an und wurde beim Projizieren verworfen — der Code-Teil ist
-- mit `BookingsSyncMixin._rate_plan_der_buchung` behoben, er wirkt aber nur auf
-- NEU eingehende Buchungen.
--
-- WARUM DAS GELD KOSTET: der Preisplan ist die Vereinbarung, zu der verkauft
-- wurde (Aufschlag, Stornobedingung, Abgabenzuordnung). Ohne ihn ist an der
-- Buchung nicht belegbar, welche Rate gegolten hat; jede Rückfrage der
-- Buchhalterin („zu welchem Preis war das verkauft?") endet bei einem leeren
-- Feld, und die Steuer-/Abgabenzuordnung je Rate-Plan greift nicht.
--
-- DREI GRUPPEN, NUR EINE WIRD ANGEFASST:
--   *  68 Booking-Buchungen — Payload hat den Plan, die Map kennt ihn → wird
--      nachgetragen.
--   *   9 Booking-Buchungen — „Unmapped Rate": Channex konnte den Portal-Code
--      selbst keinem Plan zuordnen, `rooms[0].rate_plan_id` ist NULL. Hier wird
--      NICHTS geraten (Wurzel 4); die Zuordnung passiert in Channex
--      (Channels → Mapping) und kommt dann mit der nächsten Revision.
--   * 149 Airbnb-Buchungen — Airbnb kennt das Konzept nicht und meldet keinen
--      Rate-Plan-Code. Ihnen einen zu setzen wäre eine Erfindung.
--
-- Der Join läuft über `channex_booking_id` (Channex' eigene Kennung), NICHT über
-- unsere `channex_booking.id`: `reservations.source_channex_booking_id` trägt
-- die fremde Kennung. Über unsere UUID gejoint trifft die Abfrage null Zeilen —
-- geprüft, nicht angenommen. Zusätzlich auf `tenant_id` gescopt (Wurzel 3).
--
-- Der Plan muss zum OBJEKT der Reservierung gehören, nicht bloß zum Betrieb:
-- `rate_plans` hängt an `property_id` (kein `tenant_id` an der Tabelle), und ein
-- Plan eines Nachbarobjekts wäre eine falsche Vereinbarung mit richtig
-- aussehender Kennung.

update public.reservations r
   set rate_plan_id = m.local_rate_plan_id,
       updated_at   = now()
  from public.channex_booking cb
  join public.channex_rate_plan_map m
    on m.tenant_id            = cb.tenant_id
   and m.channex_rate_plan_id = (cb.raw #>> '{rooms,0,rate_plan_id}')
  join public.rate_plans rp
    on rp.id = m.local_rate_plan_id
 where cb.channex_booking_id = r.source_channex_booking_id
   and cb.tenant_id          = r.tenant_id
   -- Der Objekt-Test steht hier und nicht in der Join-Bedingung: Postgres
   -- erlaubt in einem UPDATE...FROM keinen Verweis auf die Ziel-Zeile innerhalb
   -- eines FROM-Joins ("invalid reference to FROM-clause entry").
   and rp.property_id        = r.property_id
   and r.rate_plan_id is null;

-- Gegenprobe: es darf keine Reservierung mit auflösbarem Plan offen bleiben.
-- Ein halb nachgezogener Bestand wäre schlimmer als der Ausgangszustand, weil
-- ein leeres Feld dann zwei verschiedene Dinge bedeuten könnte („Portal meldet
-- keinen" vs. „wir haben es nicht geschrieben").
do $$
declare
  offen integer;
begin
  select count(*) into offen
    from public.reservations r
    join public.channex_booking cb
      on cb.channex_booking_id = r.source_channex_booking_id
     and cb.tenant_id          = r.tenant_id
    join public.channex_rate_plan_map m
      on m.tenant_id            = cb.tenant_id
     and m.channex_rate_plan_id = (cb.raw #>> '{rooms,0,rate_plan_id}')
    join public.rate_plans rp
      on rp.id          = m.local_rate_plan_id
     and rp.property_id = r.property_id
   where cb.tenant_id = r.tenant_id
     and r.rate_plan_id is null;
  if offen > 0 then
    raise exception
      'Nachtrag unvollstaendig: % Reservierungen haben einen aufloesbaren Preisplan, tragen ihn aber nicht.',
      offen;
  end if;
end $$;
