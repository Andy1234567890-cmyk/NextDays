-- 0357 — Gast-Anschrift an der Reservierung: die drei Spalten, die der
--        Buchungs-Import schon füllt
--
-- ANLASS (10.08.2026, live gemessen): Der Booking.com-Bestandsimport eines
-- Beta-Objekts scheiterte an JEDER einzelnen Buchung:
--
--   import_booking_failed  PGRST204
--   "Could not find the 'guest_address' column of 'reservations'"
--
-- Sechs Buchungen kamen von Channex herein, keine wurde gespeichert. Von außen
-- sah es aus, als liefere das Portal nichts — der Betrieb drückte „Voll-
-- Abgleich" und „Buchungen synchronisieren" und bekam nie eine Buchung zu
-- sehen. Der Import ist idempotent, also blieb der Fehler auch bei jedem
-- weiteren Versuch derselbe.
--
-- URSACHE: `channel_manager/common.py` bildet den `customer`-Block einer
-- OTA-Buchung vollständig auf Reservierungsspalten ab (`_GAST_FELD_QUELLEN`)
-- und führt dort sieben Felder. In `public.reservations` existieren aber nur
-- vier davon (live geprüft: guest_email, guest_phone, guest_language,
-- guest_country). `guest_city`, `guest_address` und `guest_zip` gibt es in
-- keiner Migration — obwohl der Code-Kommentar sie ausdrücklich als Fix
-- einführt („city, address und zip fielen auf den Boden … sichtbar als
-- 'Ort: —' in der Gästekarte").
--
-- Solange keine Buchung MIT Anschrift durchlief, fiel das nicht auf: Channex'
-- Import-Knopf liefert bei Altbuchungen bewusst keine Personendaten. Erst als
-- `load_future_reservations` echte Reservierungen samt Adresse holte, kippte
-- jede davon.
--
-- WARUM HIER ANLEGEN UND NICHT IM CODE ENTFERNEN: Die Anschrift ist ein echtes
-- Feld der Buchung. Booking.com überträgt sie in `OTA_HotelResNotif`
-- (`<AddressLine>`, `<CityName>`, `<PostalCode>`), Channex normalisiert sie im
-- `customer`. Sie wegzuwerfen, um den Fehler zu beseitigen, würde Daten
-- verlieren, die das Portal liefert — die Rechnung braucht die Anschrift des
-- Gastes, und die Gästekarte zeigt den Ort.
--
-- ABGRENZUNG zu `guest_addresses` (0046): Dort steht die KURATIERTE
-- Wohnanschrift der Gästemappe, die niemand überschreiben darf
-- (`_ensure_country_address` schreibt nur, wenn der Gast noch keine hat). Hier
-- steht, was DIESE Buchung mitgebracht hat — der Beleg-Stand zum Zeitpunkt der
-- Reservierung, unabhängig davon, wie die Mappe später gepflegt wird. Beides
-- ist gewollt; die Reservierung ist ein Dokument, kein Verweis.

alter table public.reservations
  add column if not exists guest_address text,
  add column if not exists guest_city    text,
  add column if not exists guest_zip     text;

comment on column public.reservations.guest_address is
  'Straße/Hausnummer aus der Buchung (OTA customer.address, Booking <AddressLine>). '
  'Beleg-Stand dieser Buchung — nicht die kuratierte Anschrift aus guest_addresses.';
comment on column public.reservations.guest_city is
  'Ort aus der Buchung (OTA customer.city, Booking <CityName>).';
comment on column public.reservations.guest_zip is
  'Postleitzahl aus der Buchung (OTA customer.zip, Booking <PostalCode>).';

-- RLS/Grants: keine Änderung nötig. Die Spalten hängen an `reservations`, deren
-- Policies und Grants unverändert weitergelten — es kommt kein neues
-- Zugriffsrecht hinzu. Gast-Anschriften bleiben damit genauso geschützt wie die
-- übrigen Gastfelder der Reservierung (guest_email/guest_phone), und der
-- Rollen-Datensplit greift an derselben Stelle wie bisher.
--
-- FÜR DEN, DER SIE ANZEIGT: Heute werden die drei Felder nur GESCHRIEBEN —
-- `reservations/reads.py` gibt sie nicht aus. Wer sie in eine Antwort aufnimmt,
-- muss sie wie `guest_email`/`guest_phone` durch `mask.contact_value` schicken;
-- eine Wohnanschrift ist mindestens so schutzwürdig wie eine Telefonnummer und
-- hat in der Reinigungs-/Mitarbeitersicht nichts zu suchen (§4.3).
