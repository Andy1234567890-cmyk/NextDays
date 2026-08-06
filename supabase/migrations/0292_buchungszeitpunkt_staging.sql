-- 0292 — `booked_at` auch in der Staging-Tabelle (`channex_booking`)
--
-- Nachtrag zu 0291: Der Posteingang liest seine Threads aus `channex_booking`,
-- nicht aus `reservations`. Ohne die Spalte hier bliebe die Anzeige beim
-- Feed-Eingangszeitpunkt — genau dem Fehler, den 0291 beheben sollte
-- (22 Airbnb-Buchungen aus März/Juni/Juli standen alle als „heute 10:48").
--
-- Gleiche Regel wie in 0291: nullable, KEIN Default. Wo das Portal den
-- Zeitpunkt nicht liefert, bleibt die Spalte leer und die Oberfläche sagt
-- „Eingang bei uns", statt einen plausiblen falschen Wert zu behaupten.

alter table public.channex_booking
  add column if not exists booked_at timestamptz;

comment on column public.channex_booking.booked_at is
  'Wann der Gast beim Portal gebucht hat (Airbnb `booked_at`). NULL = Portal '
  'liefert es nicht — dann NICHT durch ota_inserted_at oder created_at '
  'ersetzen: das sind Eingangszeiten, keine Buchungszeiten (0291/0292).';

-- Der Posteingang sortiert nach „letzter Aktivität"; die ist jetzt der echte
-- Buchungszeitpunkt statt der Sekunde, in der der Feed lief.
create index if not exists channex_booking_booked_at_idx
  on public.channex_booking (tenant_id, booked_at desc)
  where booked_at is not null;
