-- 0283_airbnb_listing_uebernahme.sql — Airbnb-Listings als Objekte übernehmen
--
-- ZWECK: Ein Wechselkunde kommt mit 0 Objekten und will seine bestehenden
-- Airbnb-Objekte hier haben, OHNE sie abzutippen. Die Übernahme liest seine
-- Listings über den Channex-Proxy von Airbnb und legt daraus Objekte an. Diese
-- Spalte ist der Wiedererkennungsschlüssel dafür: sie macht die Übernahme
-- idempotent (Wurzel 2) — zweimal ausgelöst entstehen keine Doppel-Objekte.
--
-- WARUM ÜBER AIRBNB UND NICHT ÜBER CHANNEX: der Channex-Katalog liefert für
-- AirBNB `mapping_mode: "listing"` + `rate_params.listing_id` (live aus
-- `GET channels/list`, 04.08.2026). Listings werden GEMAPPT, nicht als
-- Channex-Properties gespiegelt — aus dem Property-Reconcile entstehen also
-- keine neuen Objekte. Die Inhalte liegen bei Airbnb (`GET /listings` bei
-- Channex → 404); Channex reicht Aufrufe durch
-- (`POST channels/{id}/proxy/*path`), gedeckt vom OAuth-Scope
-- `property_management` aus demselben Katalog.
--
-- ZURÜCKNAHME VON 0282: Dort wurden `property_id`/`channex_property_id`/
-- `ota_hotel_id` in `channex_channel_connection` nullable gemacht, für einen
-- konto-weiten Airbnb-Connect ohne Objekt. Live geprüft ist dieser Weg
-- UNMÖGLICH:
--     POST meta/airbnb/connection_link ohne `properties` → 422
--     dito mit `properties: []`                          → 422
--         {"properties": ["should have at least 1 item(s)"]}
--     dito mit genau einem Property                      → 200 + OAuth-URL
-- `POST channels` selbst nimmt 0 Properties an (201), aber der Link, den der
-- Kunde öffnen muss, entsteht nie. Die Lockerung hätte also nur einen tauben
-- Kanal ermöglicht — und NULL-Objektbindungen in einer Tabelle, deren
-- property_id überall als gesetzt gelesen wird. `property_mapping: "multiple"`
-- widerspricht dem nicht: EIN Kanal darf MEHRERE Objekte tragen, muss aber mit
-- mindestens einem beginnen.
--
-- Der Zirkelschluss bleibt damit bestehen, ist aber auf EIN Objekt begrenzt: der
-- Server legt ein Gerüst-Objekt selbst an (Titel „Airbnb-Übernahme läuft",
-- status='draft'), daran hängt die Autorisierung, und das erste eintreffende
-- Listing FÜLLT dieses Gerüst statt daneben ein weiteres Objekt zu erzeugen.
-- Der Kunde gibt nichts ein.

-- 1) Rücknahme von 0282 -----------------------------------------------------
-- Reihenfolge: erst den Teil-Index weg, dann die NOT NULLs zurück. Der Index
-- gilt genau für `property_id is null` — bliebe er stehen, wäre er nach dem
-- NOT NULL dauerhaft leer und würde einen Zustand suggerieren, den es nicht
-- mehr gibt.
drop index if exists public.channex_channel_connection_account_uidx;

-- Etwaige objektlose Zeilen aus der Zeit von 0282 entfernen: sie tragen keinen
-- nutzbaren Zustand (ohne OAuth-Link wurde nie autorisiert), blockierten aber
-- das NOT NULL. Eng gescoped — nur Zeilen OHNE Objekt (Wurzel 3).
delete from public.channex_channel_connection
    where property_id is null;

alter table public.channex_channel_connection
    alter column property_id set not null,
    alter column channex_property_id set not null;

-- `ota_hotel_id` bleibt bewusst NULLABLE: bei Airbnb ist das die host_id, und
-- die kommt erst NACH dem Autorisieren (`refresh_channel_oauth_status` schreibt
-- sie nach). Das war schon vor 0282 so und ist kein Teil der Rücknahme.

comment on column public.channex_channel_connection.property_id is
    'Objekt der Verbindung. Immer gesetzt — auch bei Airbnb, wo Channex die '
    'Autorisierung zwingend an ein Property bindet (connection_link verlangt '
    'mindestens ein Property, live geprüft).';

-- 2) Der Wiedererkennungsschlüssel für die Übernahme ------------------------
alter table public.properties
    add column if not exists airbnb_listing_id text;

comment on column public.properties.airbnb_listing_id is
    'Airbnb-Listing, aus dem dieses Objekt übernommen wurde. NULL bei allen '
    'selbst angelegten Objekten. Macht die Übernahme idempotent: ein erneuter '
    'Lauf aktualisiert das Objekt statt ein zweites anzulegen.';

-- Ein Airbnb-Listing gehört zu genau EINEM Objekt je Betrieb. Teil-Index, weil
-- die Spalte bei selbst angelegten Objekten NULL ist (und NULLs in Postgres
-- voneinander verschieden sind — ein voller Unique-Index wäre wirkungslos, ein
-- NOT NULL falsch).
create unique index if not exists properties_airbnb_listing_uidx
    on public.properties (tenant_id, airbnb_listing_id)
    where airbnb_listing_id is not null;

-- RLS (Wurzel 6), live gegen die Server-DB geprüft statt angenommen:
-- `properties` gewährt `anon` KEIN select (nur REFERENCES/TRIGGER/TRUNCATE) und
-- `authenticated` nur `select` — schreiben kann dort niemand direkt, lesen nur
-- die Zeilen, die die bestehende Tenant-Policy zulässt. Eine neue Spalte erbt
-- das. Kein REVOKE nötig: die Spalte trägt eine Portal-Kennung des eigenen
-- Objekts, keine Finanz-/Geheimdaten, und sie ist für den Betrieb genauso
-- sichtbar wie der Rest seines Objekts.
