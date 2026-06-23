-- 0049_reservation_details.sql
-- Reservierungs-Detailfelder für die Enterprise-Gästekarte/Kalender-Detailansicht
-- (rechter Slider, Hostaway-Niveau): Gästezahl, Quote-Aufschlüsselung,
-- Zahlungsstand, Policy-Zeiten, Notizen + denormalisierte Gast-Kontaktdaten für
-- OTA-Buchungen (deren Gast nicht zwingend einen guests-Eintrag hat).
-- Alle Felder nullable/Default → bestehende Zeilen bleiben gültig.

alter table public.reservations
    -- Belegung (Gästezahl). num_guests = Summe für die schnelle Balken-Anzeige.
    add column if not exists num_guests   integer not null default 1 check (num_guests >= 1),
    add column if not exists adults       integer not null default 1 check (adults >= 0),
    add column if not exists children     integer not null default 0 check (children >= 0),
    add column if not exists infants      integer not null default 0 check (infants >= 0),
    add column if not exists pets         integer not null default 0 check (pets >= 0),
    -- Zahlungsstand (in derselben currency wie total_amount).
    add column if not exists paid_amount  numeric(12, 2) not null default 0 check (paid_amount >= 0),
    -- Quote-Positionen: [{label, amount}] (Room rate, Reinigung, Gebühren, …).
    -- jsonb statt eigener Tabelle: read-mostly, immer komplett mit der Buchung.
    add column if not exists quote_items  jsonb not null default '[]'::jsonb,
    -- Policy-/Ankunftszeiten (Strings wie "16:00", kanal-/policy-abhängig).
    add column if not exists checkin_time  text,
    add column if not exists checkout_time text,
    -- Interne Notiz (frei).
    add column if not exists note         text,
    -- Externe Quote-/Buchungs-URL (z. B. "Edit reservation in Booking.com").
    add column if not exists external_url text,
    -- Denormalisierte Gast-Kontaktdaten (für OTA-Buchungen ohne guests-Eintrag;
    -- DSGVO: werden wie Gastdaten maskiert ausgeliefert).
    add column if not exists guest_email    text,
    add column if not exists guest_phone    text,
    add column if not exists guest_language text,
    add column if not exists guest_country  text;
