-- Bestand: fälschlich als 'portal' abgelegte OTA-Buchungen korrigieren.
--
-- Getrennt von 0222, weil Postgres einen neu angelegten Enum-Wert nicht in
-- derselben Transaktion verwenden lässt.
--
-- ABGRENZUNG: Echte Portal-Buchungen entstehen ausschließlich in der eigenen
-- Buchungs-Engine (booking_engine) und tragen KEINE Channex-Buchungs-ID.
-- Alles mit `source_channex_booking_id` kam über den Channel-Manager, ist also
-- eine externe OTA-Buchung — dort gilt 1 % monatlich, nicht 8 % all-in.

update public.reservations
   set channel = 'ota_other'
 where channel = 'portal'
   and source_channex_booking_id is not null;
