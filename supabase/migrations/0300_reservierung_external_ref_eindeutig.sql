-- Doppelte OTA-Buchungen auf DB-Ebene ausschließen (Wurzel 2).
--
-- Bisher gab es nur `reservations_source_channex_uidx` auf
-- `source_channex_booking_id`. Diese Spalte füllt aber ausschließlich der
-- Channex-Feed (`bookings_sync`). Der Airbnb-Historien-Import kennt Channex
-- gar nicht — er liest direkt bei Airbnb und hat nur den Bestätigungscode,
-- den er nach `external_ref` schreibt. Für diesen Weg existierte also KEIN
-- Backstop: der Schutz vor Doppelanlage war reine Anwendungslogik
-- ("erst suchen, dann einfügen" in `_bestehende_buchung`).
--
-- Das hält genau so lange, wie nur ein Lauf gleichzeitig arbeitet. Real kommt
-- alles doppelt: Doppelklick auf „Bestehende Buchungen laden", ein Retry nach
-- Timeout, oder Feed und Historien-Import zur selben Sekunde. Dann finden
-- beide Läufe nichts, beide fügen ein — dieselbe Reservierung zweimal, die
-- Nächte doppelt belegt, der Kalender falsch.
--
-- Der Bestätigungscode ist je Betrieb eindeutig (Airbnb `HM…`, Booking-Nummer),
-- deshalb (tenant_id, external_ref). Partiell, weil Direktbuchungen keinen
-- externen Code haben und beliebig viele NULL tragen dürfen.
create unique index if not exists reservations_tenant_external_ref_uidx
  on public.reservations (tenant_id, external_ref)
  where external_ref is not null;

comment on index public.reservations_tenant_external_ref_uidx is
  'Backstop gegen doppelte OTA-Buchungen: derselbe Bestätigungscode kann je '
  'Betrieb nur einmal existieren. Greift für den Airbnb-Historien-Import, der '
  'source_channex_booking_id nicht setzt.';
