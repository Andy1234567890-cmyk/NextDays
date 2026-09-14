-- 0703_angebot_gast_stammdaten.sql
-- Kalender-Angebot: Stammdaten des Empfängers (Person/Organisation, Anschrift).
--
-- Befund 14.09.2026: „Angebot senden" im Kalender fragte nur Name, E-Mail und
-- Telefon. Die Brücke 0699 legte daraus einen Debitor OHNE Anschrift an, und
-- der Beleg-Editor zeigte den Gast als „Organisation" (sein Vorgabewert) —
-- der Betrieb musste die Anschrift jedes Angebotsempfängers in der Buchhaltung
-- nachtragen. Ein Angebot ist ein Beleg; sein Empfänger braucht Stammdaten.
--
-- `guest_country` trägt denselben Wert wie `customers.address.country` und
-- das Land-Feld des Editors (historisch der deutsche Landesname, siehe
-- web/constants/countries.ts) — eine Konvention, kein zweiter Wertevorrat.
alter table public.booking_offers
  add column if not exists guest_type text not null default 'private',
  add column if not exists guest_company text,
  add column if not exists guest_street text,
  add column if not exists guest_postal_code text,
  add column if not exists guest_city text,
  add column if not exists guest_country text;

alter table public.booking_offers
  drop constraint if exists booking_offers_guest_type_check;
alter table public.booking_offers
  add constraint booking_offers_guest_type_check
  check (guest_type in ('private', 'business'));

comment on column public.booking_offers.guest_type is
  'private = Privatperson, business = Organisation (dann guest_company Pflicht).';
comment on column public.booking_offers.guest_country is
  'Land wie customers.address.country / Editor-Landfeld (gespeicherter Anzeigewert).';
