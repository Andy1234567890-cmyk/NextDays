-- OTA-kassierte Buchungen als bezahlt führen.
--
-- Kein Portal liefert ein eigenes „bezahlt"-Statusfeld (Booking.com-
-- Connectivity, Airbnb, Expedia und die komplette Aggregator-Doku geprüft):
-- übermittelt wird nur der ZahlungsWEG. payment_collect='ota' heißt laut
-- Aggregator-Doku wörtlich „guest already pay at OTA" — der Bezahlt-Status
-- muss daraus abgeleitet werden, so machen es alle gängigen PMS (Hostaway:
-- „OTA payments automatically marked as paid", Beds24 bucht den Einzug als
-- Zahlung ins Folio). Der Import (bookings_sync) leitet ab jetzt ab; diese
-- Migration zieht den Altbestand nach.

-- 1) VCC-Buchungen ohne payment_collect: Booking.com lässt das Feld auch bei
--    „Payments by Booking.com" oft leer (alle Doku-Beispiele: null). Das
--    verlässliche Signal ist dann die virtuelle Kreditkarte im guarantee-
--    Objekt — eine VCC stellt das Portal nur aus, wenn es das Geld des
--    Gastes bereits eingezogen hat.
update public.reservations r
   set payment_collect = 'ota'
  from public.channex_booking cb
 where cb.tenant_id = r.tenant_id
   and cb.channex_booking_id = r.source_channex_booking_id
   and r.payment_collect is null
   and (cb.raw -> 'guarantee' ->> 'is_virtual') = 'true';

-- 2) Portal-kassierte, nicht abgeschlossene Buchungen als bezahlt nachziehen.
--    Ausgecheckte Aufenthalte bleiben unangetastet: ihre Schlussrechnung ist
--    erstellt und darf nicht rückwirkend von den gespeicherten Beträgen
--    abweichen. Nur unberührte Zahl-Zustände (unpaid + 0) — wo Rezeption
--    oder Gateway schon gebucht haben, wird nichts überschrieben.
update public.reservations
   set paid_amount    = total_amount,
       payment_status = 'paid'
 where payment_collect = 'ota'
   and status <> 'cancelled'
   and checked_out_at is null
   and payment_status = 'unpaid'
   and paid_amount = 0;

comment on column public.reservations.payment_status is
    'Zahlstatus der Buchung. unpaid=offen; pending=PaymentIntent offen; '
    'paid=bezahlt (eigenes Gateway ODER vom Portal kassiert, '
    'payment_collect=ota); refunded=erstattet; deposit_held=Kaution '
    'vorautorisiert.';
