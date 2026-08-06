-- 0299 — Die Freitext-Spalten aus 0298 wieder entfernen
--
-- WARUM: 0298 hat acht Textspalten an `property_guest_portal` angelegt
-- (checkin_instructions, directions, house_rules …). Diese Texte gab es aber
-- BEREITS — mehrsprachig, mit eigener Pflegeoberfläche unter
-- `/objekte/{id}/nachrichten`, gespeichert in
-- `properties.type_attributes.messaging` (`web/lib/messaging-meta.ts`, acht
-- Blöcke mit genau den Lodgify-Shortcodes {{CheckinInstructions}},
-- {{RentalDirections}}, {{RentalRules}}, {{WifiInformation}}, {{LocalGuide}},
-- {{DoorInstructions}}, {{CheckoutInstructions}}, {{EmergencyContact}}).
--
-- Zwei Heimaten für denselben Text sind schlimmer als eine unpassende: der
-- Betrieb pflegt in der Oberfläche, die Nachricht liest aus der Spalte, und
-- niemand versteht, warum der gepflegte Text nicht ankommt. Zudem kann die
-- Spalte nur EINE Sprache — die vorhandene Struktur kann alle.
--
-- Gefahrlos, weil live keine einzige Zeile einen dieser Werte trug (geprüft
-- unmittelbar vor dieser Migration: 0 Zeilen).
--
-- WAS BLEIBT: `wifi_ssid`/`wifi_password` aus 0296. Die sind KEIN Freitext,
-- sondern zwei getrennte Werte, die der QR-Code des Gastportals einzeln
-- braucht — `{{WifiInformation}}` (Freitext, mehrsprachig) und
-- `{{wifi_ssid}}`/`{{wifi_password}}` (strukturiert) bedienen verschiedene
-- Zwecke und stehen bewusst nebeneinander.

alter table public.property_guest_portal
  drop column if exists checkin_instructions,
  drop column if exists checkout_instructions,
  drop column if exists door_instructions,
  drop column if exists directions,
  drop column if exists house_rules,
  drop column if exists rates_notes,
  drop column if exists rental_agreement,
  drop column if exists local_guide;
