-- 0282_airbnb_connect_ohne_objekt.sql — Airbnb verbinden, BEVOR Objekte da sind
--
-- DIE KETTE, die funktionieren muss (Wechselkunde):
--   Onboarding → Airbnb autorisieren → Listings zu Channex → Objekte zu uns
--
-- Bisher scheiterte Schritt 2: `begin_channel_oauth` verlangte ein bestehendes
-- Objekt mit Channex-Mapping, und die Verbindungszeile trägt `property_id` NOT
-- NULL. Ein Zirkelschluss — zum Importieren musste man erst anlegen, was man
-- importieren wollte. Im Kanal-Dialog äußerte sich das so, dass Airbnb sich
-- anklicken ließ, aber nur „Bitte zuerst ein Objekt anlegen" erschien.
--
-- Erlaubt ist der objektlose Kanal, weil der Channex-Katalog für Airbnb
-- `property_mapping: "multiple"` liefert (live aus `channels/list` gelesen): EIN
-- Kanal trägt mehrere Objekte. Nach dem Autorisieren spiegelt Channex die
-- Listings, und `reconcile_properties_for_tenant` legt daraus unsere Objekte an
-- — der Import-Weg, der schon existiert (Onboarding-Knopf „Von Portalen holen").
--
-- UNTERSCHIED ZU 0280 (per 0281 zurückgenommen): Dort wurden DREI Spalten in
-- ZWEI Tabellen gelockert, für einen zweiten, parallelen Import-Weg. Das war
-- gefährlich, weil `channex_property_map.channex_property_id` an 36 Stellen
-- gelesen wird — mehrere per direktem Index-Zugriff in `ari_push.py`, wo eine
-- NULL-Zeile einen ARI-Push mit `property_id: null` erzeugt hätte (Retry-
-- Schleife auf Kosten des kontoweiten Channex-Budgets).
--
-- Hier wird NUR `channex_channel_connection` angefasst, und nur so weit wie
-- nötig. `channex_property_map` bleibt unverändert NOT NULL — der Reconcile
-- schreibt dort immer eine echte Channex-ID.
--
-- `ota_hotel_id` muss mit: die Airbnb-host_id kommt erst NACH dem Autorisieren
-- (`refresh_channel_oauth_status` schreibt sie nach). `channex_property_id`
-- ebenso — beim Konto-Kanal gibt es keine.

alter table public.channex_channel_connection
    alter column property_id drop not null,
    alter column channex_property_id drop not null,
    alter column ota_hotel_id drop not null;

-- Genau EINE objektlose Verbindung je Betrieb und Portal. Der bestehende
-- UNIQUE-Index (property_id, ota_portal_code) greift hier nicht: in Postgres
-- sind NULLs voneinander verschieden, also würde jeder Klick eine weitere Zeile
-- und damit einen weiteren Kanal bei Channex anlegen (Wurzel 2).
create unique index if not exists channex_channel_connection_account_uidx
    on public.channex_channel_connection (tenant_id, ota_portal_code)
    where property_id is null;

comment on column public.channex_channel_connection.property_id is
    'Objekt der Verbindung. NULL = konto-weite Verbindung: Airbnb wurde vor dem '
    'ersten Objekt autorisiert (Wechselkunde), die Objekte entstehen durch die '
    'Channex-Spiegelung.';
comment on column public.channex_channel_connection.ota_hotel_id is
    'Kennung beim Portal (Booking.com-Hotel-ID bzw. Airbnb-host_id). NULL, '
    'solange die OAuth-Autorisierung noch aussteht.';
