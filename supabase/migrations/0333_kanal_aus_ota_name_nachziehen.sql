-- Bestand: `channel` an den echten `ota_name` angleichen.
--
-- BEFUND (08.08.2026): Eine Booking.com-Buchung (external_ref 6942965119,
-- „Harald Wiesendanger") stand als `channel='ota_other'` in der DB, obwohl
-- `ota_name='BookingCom'` daneben lag. Im Belegungsplan war der Balken deshalb
-- grau statt Booking-blau und der Kanal-Chip sagte „Anderes Portal", während
-- die Kopfzeile derselben Karte „Booking.com" zeigte — zwei Felder, zwei
-- Wahrheiten in einer Ansicht.
--
-- URSACHE: 0223 hat den Altbestand pauschal von 'portal' auf 'ota_other'
-- gesetzt (richtig für die Provision — es ist eine externe Buchung), ohne
-- `ota_name` auszuwerten. Ein späterer Lauf hat fünf der sechs BookingCom-
-- Buchungen nachgezogen; diese eine wurde acht Minuten danach einzeln
-- angefasst und blieb zurück. `_ota_name_to_channel` in bookings_sync.py
-- kennt „bookingcom" korrekt — neue Importe sind also richtig, nur der
-- Bestand hatte diesen Rest.
--
-- Die Zuordnung unten spiegelt `_OTA_CHANNEL_MAP`/`_OTA_PREFIX_KANDIDATEN`
-- (apps/api/src/features/channel_manager/bookings_sync.py): Vergleich auf der
-- normalisierten Form (nur Buchstaben/Ziffern), damit „Booking.com",
-- „BookingCom" und „Booking.com B.V." dasselbe Portal treffen. Präfix, weil
-- Rechtsformen hinten anhängen.
--
-- Es wird NICHTS geraten: nur Namen, die eindeutig auf ein bekanntes Portal
-- zeigen, werden angefasst. Unbekannte OTAs bleiben 'ota_other' — das ist
-- ihr richtiger Kanal, kein Ersatzwert (Wurzel 4). 'ota_other' trägt dieselbe
-- Provisionsbehandlung wie booking/airbnb/vrbo, die Korrektur verschiebt also
-- keine Beträge; sie stellt nur die Anzeige-Wahrheit her.

update public.reservations r
   set channel = k.soll::public.reservation_channel
  from (
    select id,
           case
             when schlank like 'bookingcom%' or schlank like 'booking%'
               then 'booking'
             when schlank like 'airbnb%' then 'airbnb'
             when schlank like 'vrbo%' then 'vrbo'
           end as soll
      from (
        select id,
               regexp_replace(lower(ota_name), '[^a-z0-9]', '', 'g') as schlank
          from public.reservations
         where ota_name is not null
      ) n
  ) k
 where r.id = k.id
   and k.soll is not null
   and r.channel::text <> k.soll;
