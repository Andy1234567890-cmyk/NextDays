-- Türcode und WLAN-Passwort dürfen nicht am DB-Direktpfad lesbar sein (Wurzel 6).
--
-- Live gemessen (08.08.2026): `anon` UND `authenticated` hatten SELECT auf ALLE
-- Spalten von `property_guest_portal`, darunter `door_code` und
-- `wifi_password`. Ein eingeloggter cleaner mit Objekt-Assignment konnte also
--     GET /rest/v1/property_guest_portal?select=door_code,wifi_password
-- gegen PostgREST fahren und die Geheimnisse im Klartext lesen — der
-- FastAPI-Layer mit seinen Rollenprüfungen wird dabei komplett umgangen.
--
-- Warum das bisher niemand sah: Die Tabelle stammt aus 0121, also aus der Zeit
-- VOR 0187 (keine Default-Grants mehr für neue Tabellen) und trägt das
-- pauschale SELECT-Grant seither unverändert. 0229 entzog nur
-- `insert, update, delete`; 0155 begrenzt per restriktiver Policy die ZEILEN
-- (owner-/staff-Scope), nicht die Spalten. Der Kommentar in 0296 behauptet
-- ausdrücklich das Gegenteil ("nur ueber den Server, nie per anon-Key lesbar
-- (Wurzel 6: die REVOKEs der Tabelle gelten unveraendert)") — die bestehenden
-- REVOKEs decken SELECT gerade nicht ab. Wurzel 6 nennt Türcodes namentlich als
-- service_role-only-Klasse.
--
-- Reihenfolge ist entscheidend: Ein Spalten-REVOKE greift NICHT, solange das
-- pauschale Tabellen-GRANT besteht. Deshalb erst das Tabellen-GRANT entziehen,
-- dann die unkritischen Spalten gezielt wieder gewähren.

revoke select on public.property_guest_portal from anon, authenticated;

-- Alles außer den beiden Geheimnissen bleibt lesbar. Das hält die bestehende
-- Realtime-Verdrahtung am Leben: `guest-module-form.tsx` abonniert die Tabelle,
-- benutzt aber keine Spaltenwerte aus dem Event — es lädt bei jeder Änderung
-- über die API neu, die weiterhin mit service_role liest und die Rollenprüfung
-- selbst vornimmt.
grant select (
  id,
  property_id,
  enabled,
  contact_name,
  contact_phone,
  self_checkin,
  show_code_only_if_paid,
  hide_code_until_checkin,
  code_visible_from,
  maintenance_phone,
  header_image_path,
  created_at,
  updated_at,
  wifi_ssid
) on public.property_guest_portal to anon, authenticated;

comment on column public.property_guest_portal.door_code is
  'Geheimnis. Nur service_role liest es (0314) — der Server entscheidet anhand '
  'von show_code_only_if_paid/hide_code_until_checkin, wer ihn wann sieht.';
comment on column public.property_guest_portal.wifi_password is
  'Geheimnis. Nur service_role liest es (0314), nie per anon-Key.';
