-- 0309_gastdaten_ort_adresse.sql — Ort/Adresse/PLZ des Gastes aufnehmen
--
-- Die Gästekarte zeigte „Ort: —", obwohl das Portal den Ort mitliefert. Der
-- Grund war nicht das Portal, sondern wir: der Buchungs-Sync las aus dem
-- `customer`-Objekt nur vier von sieben Feldern (mail, phone, language,
-- country) — `city`, `address` und `zip` fielen auf den Boden, und eine Spalte
-- dafür gab es nirgends.
--
-- Belegt, dass die Felder kommen: Booking.com überträgt in `OTA_HotelResNotif`
-- ausdrücklich `<AddressLine>`, `<CityName>`, `<PostalCode>`, `<CountryName>`
-- und `<Telephone>` (developers.booking.com, Reservations API). Channex
-- normalisiert das in `customer` mit genau diesen Schlüsseln — seine
-- Open-Channel-Spezifikation führt `city`, `address` und `zip` als reguläre
-- Felder (docs.channex.io/for-ota/open-channel-api).
--
-- Die Anzeige war bereits richtig gebaut: `_guest_location` setzt „Ort, Land"
-- aus `customer.city` + `customer.country` zusammen. Sie las nur einen Blob,
-- in dem die Werte nie ankamen.
--
-- An BEIDEN Orten, weil sie zwei verschiedene Fragen beantworten:
--   * `reservations` — die Anschrift, die zu DIESER Buchung gemeldet wurde
--     (Meldeschein, Rechnung). Sie ist Teil des Buchungsbelegs und darf sich
--     nicht rückwirkend ändern, wenn der Gast später woanders wohnt.
--   * `guests` — die zuletzt bekannte Anschrift des Gastes (Stammdaten,
--     Wiedererkennung).
-- Nur an einem Ort zu speichern hieße, entweder den Beleg zu verfälschen oder
-- die Stammdaten leer zu lassen.

alter table public.reservations
    add column if not exists guest_city text,
    add column if not exists guest_address text,
    add column if not exists guest_zip text;

comment on column public.reservations.guest_city is
    'Ort des Gastes, wie vom Portal zu DIESER Buchung gemeldet (customer.city).';
comment on column public.reservations.guest_address is
    'Straße/Anschrift des Gastes zu dieser Buchung (customer.address).';
comment on column public.reservations.guest_zip is
    'Postleitzahl des Gastes zu dieser Buchung (customer.zip).';

-- `guests` bekommt KEINE Adressspalten: die Gästemappe führt die Anschrift
-- bereits in `guest_addresses` (street/postal_code/city/country, 0046). Dort
-- wird sie ab jetzt vollständig angelegt statt nur mit dem Land — die Spalten
-- gab es längst, `_ensure_country_address` füllte nur eine davon.
--
-- Bestehende Gast-Adressen werden NICHT angefasst: kuratierte Adressdaten
-- dürfen nicht von einer OTA-Meldung überschrieben werden (dieselbe Regel, die
-- die Funktion schon für das Land anwendet).
-- `distinct on (guest_id)`: ein Gast kann mehrere Buchungen haben, bekommt hier
-- aber GENAU EINE Adresse — die aus der jüngsten Buchung. Ohne das entstünden
-- mehrere „primäre" Adressen für denselben Gast.
insert into public.guest_addresses
       (tenant_id, guest_id, type, is_primary, street, postal_code, city, country)
select distinct on (r.guest_id)
       r.tenant_id,
       r.guest_id,
       'private',
       true,
       nullif(b.raw -> 'customer' ->> 'address', ''),
       nullif(b.raw -> 'customer' ->> 'zip', ''),
       nullif(b.raw -> 'customer' ->> 'city', ''),
       nullif(b.raw -> 'customer' ->> 'country', '')
  from public.reservations r
  join public.channex_booking b
    on b.channex_booking_id = r.source_channex_booking_id
 where r.guest_id is not null
   and (b.raw -> 'customer') is not null
   and coalesce(b.raw -> 'customer' ->> 'city',
                b.raw -> 'customer' ->> 'address',
                b.raw -> 'customer' ->> 'zip',
                b.raw -> 'customer' ->> 'country', '') <> ''
   and not exists (select 1 from public.guest_addresses a
                    where a.guest_id = r.guest_id and a.tenant_id = r.tenant_id)
 order by r.guest_id, r.created_at desc
on conflict do nothing;

-- Bestand nachziehen, soweit die Werte schon bei uns liegen: die gestagte
-- Payload wurde immer vollständig gespeichert, nur nicht ausgewertet. Was das
-- Portal geliefert hat, ist damit ab sofort sichtbar — ohne einen einzigen
-- neuen Abruf.
update public.reservations r
   set guest_city    = coalesce(r.guest_city,    nullif(b.raw -> 'customer' ->> 'city', '')),
       guest_address = coalesce(r.guest_address, nullif(b.raw -> 'customer' ->> 'address', '')),
       guest_zip     = coalesce(r.guest_zip,     nullif(b.raw -> 'customer' ->> 'zip', '')),
       guest_country = coalesce(r.guest_country, nullif(b.raw -> 'customer' ->> 'country', '')),
       guest_language= coalesce(r.guest_language,nullif(b.raw -> 'customer' ->> 'language', '')),
       guest_phone   = coalesce(r.guest_phone,   nullif(b.raw -> 'customer' ->> 'phone', '')),
       guest_email   = coalesce(r.guest_email,   nullif(coalesce(b.raw -> 'customer' ->> 'mail',
                                                                 b.raw -> 'customer' ->> 'email'), ''))
  from public.channex_booking b
 where r.source_channex_booking_id is not null
   and b.channex_booking_id = r.source_channex_booking_id
   and (b.raw -> 'customer') is not null;

-- Kein Grant/RLS-Block: beide Tabellen haben RLS bereits, hier kommen nur
-- Spalten zu bestehenden Zeilen dazu (Wurzel 6 unberührt). Die Felder sind
-- Gast-PII und laufen in der Anzeige durch dieselbe Maske wie E-Mail/Telefon
-- (§4.3: staff/cleaner sehen sie nicht).
