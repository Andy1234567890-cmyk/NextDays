-- 0296 — WLAN-Zugang am Objekt (`property_guest_portal.wifi_ssid/wifi_password`)
--
-- DER ANLASS (06.08.2026): Die Vorlage „Anreisetag" des Beta-Betriebs enthält
-- „Internet: {{WifiInformation}}" — ein Platzhalter, den es bei uns NICHT gibt
-- (übernommen aus dem Altsystem). Er wurde beim Senden nicht ersetzt, der Gast
-- hätte wörtlich „{{WifiInformation}}" gelesen. Im ganzen Schema gab es keine
-- einzige Spalte für WLAN — weder SSID noch Passwort.
--
-- WARUM HIER UND NICHT AN `properties`: Der WLAN-Zugang ist genau das, was der
-- Türcode auch ist — ein Zugangsgeheimnis, das ein Gast rund um die Anreise
-- braucht. `property_guest_portal` führt `door_code` bereits samt seiner
-- Schutzregeln (`show_code_only_if_paid`, `hide_code_until_checkin`,
-- `code_visible_from`). Eine zweite Heimat für dieselbe Art Geheimnis hieße,
-- diese Regeln ein zweites Mal zu bauen und beim nächsten Mal eine davon zu
-- vergessen.
--
-- ZWEI SPALTEN, NICHT EINE: Ein Feld „WLAN-Info" als Freitext klingt bequem,
-- macht aber jede maschinelle Nutzung unmöglich — der QR-Code fürs Gastportal
-- (WIFI:S:<ssid>;T:WPA;P:<passwort>;;) braucht beide Teile getrennt. Getrennt
-- gespeichert lässt sich beides zusammensetzen; zusammengeschrieben lässt es
-- sich nicht zuverlässig trennen.

alter table public.property_guest_portal
  add column if not exists wifi_ssid     text,
  add column if not exists wifi_password text;

comment on column public.property_guest_portal.wifi_ssid is
  'Name des WLAN-Netzes (SSID). NULL = nicht gepflegt; eine Vorlage mit '
  '{{wifi_ssid}} schlaegt dann bewusst fehl statt Platzhaltertext zu senden.';

comment on column public.property_guest_portal.wifi_password is
  'WLAN-Passwort. Geheimnis wie door_code — nur ueber den Server, nie per '
  'anon-Key lesbar (Wurzel 6: die REVOKEs der Tabelle gelten unveraendert).';
