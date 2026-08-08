-- 0317 — Der Thread trägt sein Objekt selbst (statt nur über das Channex-Mapping).
--
-- Bis hierher stand das Objekt einer Konversation NUR indirekt in
-- `channex_booking.property_map_id` → `channex_property_map.property_id`. Das
-- setzt voraus, dass die Buchung über den Channel-Manager kam. Für den eigenen
-- Marktplatz myBestDays stimmt das nicht: dessen Buchungen entstehen in
-- `reservations` (channel='portal', ota_name='myBestDays') und haben nie ein
-- Channex-Mapping.
--
-- Folge, live vorgefunden: die Nachrichten-Automationen planen ausschließlich
-- über `channex_booking`-Threads. Eine Marktplatz-Buchung bekam deshalb NIE
-- eine Automail — nicht einmal über eine Regel „alle Kanäle". Die Oberfläche
-- bietet „myBestDays" als Kanal aber ausdrücklich an; die Regel lief ins Leere,
-- ohne Fehler, ohne Hinweis. (Aktuell hat der Beta-Betrieb keine solche
-- Buchung, der Fehler war also noch ohne Schaden — er hätte beim ersten
-- Marktplatz-Gast zugeschlagen.)
--
-- `property_id` direkt am Thread löst beides: die Marktplatz-Buchung bekommt
-- ihr Objekt ohne Mapping, und für OTA-Buchungen ist es der direkte Weg
-- dorthin, wo bisher zwei Abfragen nötig waren.

alter table public.channex_booking
  add column if not exists property_id uuid
  references public.properties(id) on delete set null;

comment on column public.channex_booking.property_id is
  'Objekt der Konversation — direkt, ohne Umweg ueber das Channex-Mapping. '
  'Fuer Marktplatz-Buchungen (myBestDays) der EINZIGE Weg: sie haben kein '
  'channex_property_map. Bei OTA-Buchungen deckungsgleich mit '
  'property_map_id -> channex_property_map.property_id.';

-- Objekt-Filter der Posteingangsliste und die Automations-Zuweisung lesen
-- danach; ohne Index wird das mit wachsendem Bestand ein Full-Scan.
create index if not exists channex_booking_property_idx
  on public.channex_booking (tenant_id, property_id);

-- Bestand nachziehen: bei allen bestehenden OTA-Threads steht das Objekt
-- bereits im Mapping. Ohne diesen Schritt haette der neue, direkte Weg fuer
-- den gesamten Altbestand NULL geliefert.
update public.channex_booking b
   set property_id = m.property_id
  from public.channex_property_map m
 where b.property_map_id = m.id
   and b.property_id is null
   and m.property_id is not null;
