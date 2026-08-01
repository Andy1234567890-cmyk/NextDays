-- 0253 — availability_source kennt 'ota_other'
--
-- Befund (live, 01.08.2026): der Buchungs-Import bricht ab mit
--   invalid input value for enum availability_source: "ota_other"
-- HTTP 400 auf /rest/v1/availability, danach channex_booking_sync_failed.
--
-- Ursache: _ota_name_to_channel bildet JEDE OTA, die nicht Booking/Airbnb/Vrbo
-- ist (Expedia, Agoda, Hostelworld …), auf den Kanal 'ota_other' ab — und genau
-- dieser Kanal wird als Belegungsquelle in availability.source geschrieben. Das
-- Enum reservation_channel kennt den Wert, availability_source nicht: beim
-- Anlegen wurde nur die Teilmenge direct/portal/booking/airbnb/vrbo/manual/ical
-- übernommen. Damit war jede Buchung eines „sonstigen" Portals nicht
-- importierbar — die Nacht blieb lokal frei und wäre doppelt verkaufbar.
--
-- Die Alternative (auf einen vorhandenen Wert abbilden) wäre falsch: dann
-- gäbe _free_ota_nights beim Storno die Nächte nicht mehr quellengenau frei
-- (es filtert auf source = Kanal, Wurzel 1).

alter type public.availability_source add value if not exists 'ota_other';
