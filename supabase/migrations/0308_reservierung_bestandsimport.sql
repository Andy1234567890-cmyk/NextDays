-- 0308_reservierung_bestandsimport.sql — Bestands-Import als solchen kennzeichnen
--
-- Eine importierte Altbuchung und eine live eingegangene Reservierung sahen bei
-- uns gleich aus. Das ist eine Falschaussage, weil es zwei verschiedene
-- Datenpfade mit verschiedenem Umfang sind — und der Unterschied ist genau der,
-- über den ein Betrieb stolpert: bei der importierten Buchung stehen E-Mail,
-- Telefon und Adresse leer, und das sieht nach Datenverlust aus.
--
-- Es ist keiner. Booking.com holt Bestandsbuchungen über einen EIGENEN Endpunkt
-- (`reservationssummary`), und der liefert dokumentiert nur den Namen:
-- „only provides summary information and doesn't include guest details, other
-- than the guest's name" (developers.booking.com, Reservations API). Channex
-- sagt dasselbe für den Import-Knopf: „The data you get from imported bookings
-- will lack some details compared to normal booking, it will not include …
-- Personal Details like email, address, telephone etc."
-- (docs.channex.io/channel-mapping-guides/booking.com).
--
-- Live nachgemessen am 07.08.2026: alle 6 Booking-Buchungen der FeWo
-- *Stjerneskud* tragen bei Channex `meta.is_imported = true` und
-- `notes: "Imported Booking"`, ihr `customer`-Objekt hat exakt zwei Felder
-- (name, surname). Es gibt an diesem Kanal noch keine einzige live eingegangene
-- Reservierung.
--
-- Die Spalte trägt diese Unterscheidung, damit die Oberfläche „Bestands-Import"
-- sagen kann, statt einen leeren Wert wie einen Fehler aussehen zu lassen
-- (Wurzel 4: kein erfundener Ersatzwert — aber auch keine unerklärte Lücke).
-- Sie gilt portalunabhängig: Airbnbs Historien-Import hat dieselbe Eigenschaft.

alter table public.reservations
    add column if not exists is_imported boolean not null default false;

comment on column public.reservations.is_imported is
    'Aus einem Bestands-Import, nicht live über den Kanal eingegangen. '
    'Portale liefern beim Import weniger Gastdaten (Booking.com: nur den Namen) '
    '— fehlende Felder sind hier erwartet, kein Datenverlust.';

-- Bestand nachziehen: was Channex als importiert führt, ist importiert. Der
-- Marker steht in der gestagten Buchung, nicht in der Reservierung — deshalb
-- über die Verbindung zurückschreiben statt zu raten.
update public.reservations r
   set is_imported = true
  from public.channex_booking b
 where r.source_channex_booking_id is not null
   and b.channex_booking_id = r.source_channex_booking_id
   and coalesce((b.raw -> 'meta' ->> 'is_imported')::boolean, false)
   and r.is_imported is distinct from true;

-- Kein Grant/RLS-Block nötig: `reservations` hat beides bereits, und die Spalte
-- erweitert nur eine bestehende Zeile (keine neue Tabelle, Wurzel 6 unberührt).
