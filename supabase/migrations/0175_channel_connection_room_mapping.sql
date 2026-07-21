-- 0175_channel_connection_room_mapping.sql — OTA-Zimmer-Zuordnung sichtbar machen
--
-- Bisher speicherte channex_channel_connection nur die ota_hotel_id (die HOTEL-ID
-- bei Booking, z. B. 6519420) — für ALLE Zimmer eines Hotels dieselbe. Auf welchen
-- konkreten OTA-Zimmertyp (room_type_code, z. B. 651942003 = „Double Room") ein
-- Objekt gemappt ist, lag NUR im Channex-Kanal, nicht lokal. Folge: die Detailseite
-- konnte in „Objekt bei Booking.com" nur die Hotel-ID zeigen (irreführend — sieht
-- aus, als hinge das Zimmer am ganzen Hotel).
--
-- Fix: den OTA-Zimmertyp + Klarnamen je Verbindung LOKAL festhalten (Quelle der
-- Wahrheit für die Anzeige, ohne bei jedem Aufruf Channex zu fragen). 1 Objekt =
-- 1 buchbare Einheit = 1 OTA-Zimmertyp unter der Hotel-ID (Datenmodell).
--
-- channex_channel_connection ist bereits RLS-geschützt (owner/staff/tenant-Policies)
-- — neue Spalten erben das.

alter table public.channex_channel_connection
    -- OTA-Zimmertyp-Code (Booking room_type_code, Integer als Text). Das Zimmer
    -- UNTER der ota_hotel_id, auf das dieses Objekt gemappt ist.
    add column if not exists ota_room_type_code text,
    -- Klarname des OTA-Zimmertyps (z. B. „Double Room") für die Anzeige.
    add column if not exists ota_room_title text;

comment on column public.channex_channel_connection.ota_room_type_code is
  'OTA-Zimmertyp-Code (z. B. Booking room_type_code) unter ota_hotel_id, auf den '
  'dieses Objekt gemappt ist. 1 Objekt = 1 OTA-Zimmertyp.';
