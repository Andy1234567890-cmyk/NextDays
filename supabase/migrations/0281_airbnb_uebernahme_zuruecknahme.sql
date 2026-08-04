-- 0281_airbnb_uebernahme_zuruecknahme.sql — Rücknahme von 0280
--
-- 0280 lockerte NOT-NULL-Bedingungen für einen ZWEITEN Airbnb-Import-Weg. Der
-- war unnötig: der Import existiert längst als `reconcile_properties_for_tenant`
-- (Channex→DB-Spiegelung, ausgelöst über `POST /channel-manager/reconcile` und
-- im Onboarding über den Knopf „Von Portalen holen"). Airbnb-OAuth spiegelt die
-- Listings automatisch zu Channex, der Reconcile holt sie zu uns — genau das,
-- was 0280 doppelt gebaut hätte.
--
-- Die gelockerten Spalten sind ein RISIKO, das ohne Nutzen bestehen bliebe:
-- `channex_property_id` wird an 36 Stellen gelesen, mehrere davon per direktem
-- Index-Zugriff (`mapping["channex_property_id"]`) in `ari_push.py`. Eine
-- NULL-Zeile dort erzeugt einen ARI-Push mit `property_id: null`, den Channex
-- mit „Bad Request" quittiert und der zehnmal in den Retry läuft — auf Kosten
-- des kontoweiten Anfrage-Budgets aller Betriebe (genau so passiert am
-- 01.08.2026 mit Platzhalter-IDs). Deshalb zurück auf NOT NULL.
--
-- Was BLEIBT: die zusätzliche Absicherung in `ari_push._is_managed_property`,
-- die eine Map-Zeile ohne `channex_property_id` explizit als NICHT verkaufsbereit
-- behandelt. Sie ist jetzt strukturell unerreichbar, aber fail-closed richtig
-- (Wurzel 5) — ein späterer nullable-Fall trifft auf eine Prüfung, nicht auf
-- einen Push.
--
-- Reihenfolge beachtet den Gegenzustand (Wurzel 1): erst die Zeilen prüfen, die
-- NULL tragen könnten, dann die Bedingung wieder anziehen. Da 0280 erst heute
-- lief und kein Code den neuen Weg benutzt hat, existieren keine solchen Zeilen
-- — das `where` ist die Absicherung, nicht die Erwartung.

-- 1) Konto-weite Kanal-Verbindungen (property_id IS NULL) gäbe es nur aus dem
--    zurückgenommenen Weg. Weg damit, bevor NOT NULL wieder greift.
delete from public.channex_channel_connection
    where property_id is null;

drop index if exists public.channex_channel_connection_account_uidx;

alter table public.channex_channel_connection
    alter column property_id set not null,
    alter column channex_property_id set not null,
    alter column ota_hotel_id set not null;

comment on column public.channex_channel_connection.property_id is
    'Objekt dieser Kanal-Verbindung (Pflicht).';

-- 2) Listing-Brücke entfernen: die Idempotenz des Imports trägt
--    `channex_property_id` im Reconcile, nicht eine zweite Spalte.
drop index if exists public.channex_property_map_airbnb_listing_uidx;

alter table public.channex_property_map
    drop column if exists airbnb_listing_id;

-- 3) Map-Zeilen ohne Channex-Property sind der Zustand, den 0280 erlaubt hätte.
delete from public.channex_property_map
    where channex_property_id is null;

alter table public.channex_property_map
    alter column channex_property_id set not null;

comment on column public.channex_property_map.channex_property_id is
    'Property-ID bei Channex (Pflicht) — Idempotenz-Schlüssel der '
    'Channex→DB-Spiegelung.';
