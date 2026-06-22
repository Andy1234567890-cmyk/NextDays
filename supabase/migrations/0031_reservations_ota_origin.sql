-- 0031_reservations_ota_origin.sql — OTA-Herkunft + Dedup für reservations
--
-- Channex-Import: OTA-Buchungen (Booking.com, Airbnb, Expedia …) werden in die
-- zentrale reservations-Tabelle überführt. Damit das idempotent ist und der
-- echte Portal-Name im Kalender sichtbar bleibt (reservation_channel-Enum kennt
-- nur direct/portal/booking/airbnb/vrbo → Expedia/Agoda landen auf 'portal'),
-- ergänzen wir drei nullable Spalten. Additiv: bestehende (Direkt-)Buchungen
-- bleiben unberührt (NULL).

alter table public.reservations
    add column if not exists source_channex_booking_id text,
    add column if not exists external_ref text,   -- ota_reservation_code
    add column if not exists ota_name text;        -- echter Portal-Name (Anzeige)

-- Idempotenz: genau eine reservation je Channex-Booking. Partial unique, damit
-- Direkt-/Altbuchungen (NULL) nicht kollidieren.
create unique index if not exists reservations_source_channex_uidx
    on public.reservations (source_channex_booking_id)
    where source_channex_booking_id is not null;
