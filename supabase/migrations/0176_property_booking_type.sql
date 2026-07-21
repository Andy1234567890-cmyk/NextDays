-- 0176_property_booking_type.sql — Booking.com-Unterkunftsart (PCT) je Objekt
--
-- Bisher gab es nur die grobe Weiche tenants.accommodation_type (hotel /
-- vacation_rental) und den internen properties.property_type (ferienhaus/
-- doppelzimmer/…). Für Booking.com braucht die UNTERKUNFTSART aber den offiziellen
-- Property-Class-Type-Code (PCT): Hotel(20), Guesthouse(40), Riad(5001),
-- Lodge(22) … — eine eigene, feinere Achse je Objekt (1 property = 1 buchbare
-- Einheit, kann eine eigene Unterkunftsart sein).
--
-- Recherche-belegt: developers.booking.com/connectivity/docs/codes-pct (26 aktive
-- Codes, siehe docs/BOOKING-TYPEN.md). NULL = nicht gesetzt (aus dem internen
-- property_type ableitbar; kein erzwungener Default, Wurzel 4).
--
-- properties ist bereits RLS-geschützt — die neue Spalte erbt das.

alter table public.properties
    -- Booking.com Property Class Type (PCT), Integer-Code. NULL = nicht gewählt.
    add column if not exists booking_property_type integer;

comment on column public.properties.booking_property_type is
  'Booking.com Unterkunftsart (PCT-Code, developers.booking.com/…/codes-pct). '
  'Integer, NULL = nicht gesetzt. Getrennt vom internen property_type.';
