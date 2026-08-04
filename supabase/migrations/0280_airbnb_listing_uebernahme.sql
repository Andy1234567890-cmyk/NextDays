-- 0280_airbnb_listing_uebernahme.sql — bestehende Airbnb-Listings übernehmen
--
-- PROBLEM: Ein Wechselkunde mit 20 Airbnb-Objekten musste sie bei uns von Hand
-- neu anlegen. Der Weg dahin (`meta/airbnb/{channel}/full_sync_listing` +
-- `channels/{channel}/proxy/hosting/listings`) existiert bei Channex, das
-- Datenmodell konnte ihn aber nicht abbilden. Drei Hindernisse, alle live gegen
-- die Server-DB geprüft:
--
-- 1) `channex_channel_connection.property_id` ist NOT NULL. Der Airbnb-Connect
--    des Wechselkunden hängt aber am KONTO, nicht an einem Objekt — die Objekte
--    entstehen ja erst durch die Übernahme. Der Kanal-Katalog von Channex
--    liefert dafür `property_mapping: "multiple"`: EIN Kanal trägt mehrere
--    Objekte. Also muss property_id nullable werden.
-- 2) `channex_property_id` und `ota_hotel_id` sind NOT NULL. Beide kennt man
--    beim Konto-Connect noch nicht (die Property gibt es bei Channex noch
--    nicht, die host_id kommt erst nach dem OAuth).
-- 3) Es fehlte die Brücke Listing → unser Objekt. Ohne sie kann „Alle
--    übernehmen" nicht idempotent sein (Wurzel 2) und ein zweiter Klick legt
--    dieselben Objekte doppelt an.
--
-- Der UNIQUE-Index (property_id, ota_portal_code) greift bei NULL nicht (in
-- Postgres sind NULLs verschieden) — der Konto-Kanal braucht deshalb einen
-- EIGENEN partiellen Unique-Index über (tenant_id, ota_portal_code), sonst
-- entstehen bei Doppelklick zwei Konto-Kanäle bei Channex (Wurzel 2).
--
-- Kein neuer RLS-/Grant-Bedarf: beide Tabellen tragen ihre tenant-Policies
-- bereits, neue Spalten erben sie.

-- 1) Konto-weiter Kanal: property_id/channex_property_id/ota_hotel_id optional.
alter table public.channex_channel_connection
    alter column property_id drop not null,
    alter column channex_property_id drop not null,
    alter column ota_hotel_id drop not null;

-- 2) Genau EIN Konto-Kanal je Betrieb und Portal (property_id IS NULL).
--    Partiell, damit die objektgebundenen Verbindungen unberührt bleiben.
create unique index if not exists channex_channel_connection_account_uidx
    on public.channex_channel_connection (tenant_id, ota_portal_code)
    where property_id is null;

comment on column public.channex_channel_connection.property_id is
    'Objekt der Verbindung. NULL = konto-weiter Kanal (Airbnb-Übernahme, ein '
    'Kanal für mehrere Objekte laut property_mapping="multiple").';

-- 3) Brücke Airbnb-Listing → unser Objekt. Trägt die Idempotenz der Übernahme:
--    ein zweiter Lauf findet das Objekt wieder statt ein zweites anzulegen.
alter table public.channex_property_map
    add column if not exists airbnb_listing_id text;

create unique index if not exists channex_property_map_airbnb_listing_uidx
    on public.channex_property_map (tenant_id, airbnb_listing_id)
    where airbnb_listing_id is not null and deleted_at is null;

comment on column public.channex_property_map.airbnb_listing_id is
    'Airbnb-Listing, aus dem dieses Objekt übernommen wurde (Dedup-Schlüssel '
    'der Übernahme und Rückweg zum Listing).';

-- 4) Beim Übernehmen ist noch keine Channex-Property angelegt — die entsteht
--    erst beim Verkaufsstart. Bis dahin trägt die Map nur die Listing-Brücke.
alter table public.channex_property_map
    alter column channex_property_id drop not null;

comment on column public.channex_property_map.channex_property_id is
    'Property-ID bei Channex. NULL, solange ein übernommenes Objekt noch nicht '
    'zum Verkauf registriert ist.';
