-- 0358 — `reservations.is_imported`: der Marker, den der Buchungs-Import setzt
--
-- ANLASS (10.08.2026, unmittelbar nach 0357): Derselbe Import scheiterte weiter,
-- nur eine Spalte später:
--
--   import_booking_failed  PGRST204
--   "Could not find the 'is_imported' column of 'reservations'"
--
--   fetched=6  saved=0  skipped=6
--
-- 0357 hat `guest_address`/`guest_city`/`guest_zip` nachgezogen; `is_imported`
-- fehlte GENAUSO und kam erst zum Vorschein, als PostgREST die nächste unbekannte
-- Spalte meldete. Deshalb diesmal nicht der Fehlermeldung nachlaufen, sondern
-- ALLE Spalten geprüft, die die reservations-Schreibpfade setzen (AST über
-- src/, abgeglichen gegen information_schema): `is_imported` ist die einzige
-- verbliebene Lücke. Die übrigen Kandidaten (amount_cents, arrival_date, raw,
-- revision_id, system_id, customer, property_map_id, ota_reservation_code,
-- ota_inserted_at, channex_booking_id, departure_date) gehören zu
-- `channex_booking` und existieren dort vollständig.
--
-- WOZU DER MARKER (0308): Der Bestands-Import ist ein ANDERER, ärmerer Datenpfad
-- als der Live-Eingang. Booking.com liefert Altbuchungen über
-- `reservationssummary` mit dokumentiert „only summary information … no guest
-- details, other than the guest's name"; Channex schreibt zu seinem Import-Knopf
-- dasselbe. Ohne das Kennzeichen sehen die leeren Gastfelder einer solchen
-- Buchung wie ein Datenverlust aus — jemand würde den Import für kaputt halten
-- und ihn wieder und wieder anstoßen.
--
-- `default false`, weil eine Buchung im Normalfall live hereinkommt; der Import
-- setzt den Wert ausdrücklich. Bestehende Zeilen sind damit korrekt als „nicht
-- importiert" markiert — sie stammen alle aus dem Live-Eingang.
--
-- Der Posteingang braucht die Spalte NICHT: `inbox/service.py` leitet
-- `is_imported` zur Laufzeit aus der gestagten Payload ab (`ist_bestandsimport(raw)`).
-- Hier geht es allein um die Reservierung, die den Marker mitführen soll.

alter table public.reservations
  add column if not exists is_imported boolean not null default false;

comment on column public.reservations.is_imported is
  'Stammt aus einem Bestands-Import statt aus dem Live-Eingang (0308). Erklärt '
  'leere Gastfelder: die Portale liefern bei Altbuchungen keine Personendaten.';

-- RLS/Grants unverändert: die Spalte hängt an `reservations`, es entsteht kein
-- neues Zugriffsrecht. Der Wert ist ein Herkunfts-Kennzeichen, keine Gastdatei —
-- er braucht keine Maskierung im Rollen-Datensplit.
