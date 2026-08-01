-- Zimmer-Ausstattung: eigene Achse neben der Objekt-Ausstattung.
--
-- Channex führt ZWEI Ausstattungskataloge mit EIGENEN UUIDs (live abgerufen):
--   * /property_facilities (301) → hängt an der Property   → properties.amenities
--   * /room_facilities     (191) → hängt am Room-Type      → diese neue Spalte
-- Sie überschneiden sich nur zu einem Bruchteil: 30 gleichlautende Titel, alle
-- mit UNTERSCHIEDLICHER UUID. Genau die Merkmale, nach denen Gäste auf Booking
-- und Airbnb filtern — Klimaanlage, Balkon, Küche, Aussicht, Bad — gibt es
-- ausschliesslich im Zimmer-Katalog. Eine Objekt-UUID an einem Room-Type wäre
-- ungültig, deshalb zwei Spalten statt einer.
--
-- Wie amenities: not null + Default '{}', damit "gesetzt aber leer" (Nutzer hat
-- alles abgewählt → bei Channex/OTA leeren) von "nie gepflegt" unterscheidbar
-- bleibt, ohne dass der Lesepfad NULL behandeln muss.

alter table public.properties
  add column if not exists room_amenities text[] not null default '{}'::text[];

comment on column public.properties.room_amenities is
  'Zimmer-Ausstattung (Channex /room_facilities, eigene UUIDs). Getrennt von '
  'amenities (= Objekt-Ausstattung, /property_facilities). Slugs, nicht UUIDs.';

-- Wurzel 6 / Column-REVOKE: properties trägt KEIN pauschales Tabellen-SELECT
-- mehr (0194 hat den Schreibpfad geschlossen), sondern SPALTENWEISE Grants —
-- live gegengeprüft: `authenticated` hat SELECT auf amenities, `anon` nicht.
-- Eine neue Spalte erbt das NICHT. Ohne das folgende Grant wäre room_amenities
-- für das Dashboard unlesbar (und das Realtime-Abo eine stumme Attrappe).
-- Bewusst NUR SELECT und NUR für authenticated: geschrieben wird ausschliesslich
-- serverseitig über die API (service_role), nie per anon-Key-Direktpfad.
grant select (room_amenities) on public.properties to authenticated;
