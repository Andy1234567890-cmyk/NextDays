-- Upsert der Portal-Verbindung reparieren (Folgefehler aus 0304).
--
-- SYMPTOM (live gemessen 07.08.2026, jeder Verbindungsversuch):
--   channex_oauth_connection_persist_failed
--   42P10 "there is no unique or exclusion constraint matching the
--          ON CONFLICT specification"
-- Danach: „Nicht verbunden" am Objekt und 404 auf dem oauth/status-Pfad — die
-- Verbindungszeile entstand nie, also gab es nichts zu melden.
--
-- URSACHE: 0304 hat die Eindeutigkeit auf das Tripel
-- (property_id, ota_portal_code, ota_account_id) umgestellt, den Index dafür
-- aber PARTIELL angelegt (`where property_id is not null`). PostgreSQL nimmt
-- einen partiellen Index für `ON CONFLICT` nur an, wenn die Anweisung dieselbe
-- WHERE-Bedingung mitschickt — über PostgREST ist das nicht möglich. Der Index
-- erzwang die Eindeutigkeit also weiterhin korrekt, war als Konfliktziel aber
-- unbrauchbar.
--
-- LÖSUNG: ein VOLLSTÄNDIGER Index über dasselbe Tripel. Damit die Zeilen ohne
-- Konto (60 von 78 zum Zeitpunkt dieser Migration: Demo-Betriebe und
-- angefangene Verbindungen) nicht durchrutschen, kommt `nulls not distinct`
-- dazu (PostgreSQL 15+, live 15.14 — geprüft): ohne diesen Zusatz gilt jedes
-- NULL als eigener Wert, und ein Objekt könnte beliebig viele kontolose Zeilen
-- je Portal bekommen. Genau das soll der Index verhindern.
--
-- Fachlich bleibt alles wie in 0304 beschrieben: ein Objekt darf an mehreren
-- Konten desselben Portals hängen (Agentur mit zwei Airbnb-Zugängen), aber je
-- Konto nur einmal.

-- Vorbedingung prüfen statt annehmen: kollidieren bestehende Zeilen, bricht die
-- Migration mit klarer Aussage ab, statt einen halben Zustand zu hinterlassen.
do $$
declare
    doppelte int;
begin
    select count(*) into doppelte
      from (
        select 1
          from public.channex_channel_connection
         group by property_id, ota_portal_code, ota_account_id
        having count(*) > 1
      ) x;
    if doppelte > 0 then
        raise exception
            'Abbruch: % Kombinationen aus (property_id, ota_portal_code, '
            'ota_account_id) kommen mehrfach vor. Erst bereinigen.', doppelte;
    end if;
end
$$;

-- Die beiden partiellen Indizes ersetzen. Sie waren als Konfliktziel unbrauchbar
-- und werden von dem neuen vollständig abgedeckt:
--   *_property_portal_uidx       (property_id, portal, konto) where property_id not null
--   *_property_portal_null_uidx  (property_id, portal)        where konto is null
-- Der zweite ist mit `nulls not distinct` überflüssig: eine kontolose Zeile
-- belegt dort dieselbe Stelle wie jede andere.
drop index if exists public.channex_channel_connection_property_portal_uidx;
drop index if exists public.channex_channel_connection_property_portal_null_uidx;

create unique index if not exists channex_channel_connection_property_portal_uidx
    on public.channex_channel_connection
       (property_id, ota_portal_code, ota_account_id)
    nulls not distinct;

-- Der Kanal-Index (Verbindungen OHNE Objekt) bleibt partiell — er ist kein
-- Konfliktziel eines Upserts, sondern nur ein Schutz, und `where property_id is
-- null` ist dort die Bedingung selbst.

comment on index public.channex_channel_connection_property_portal_uidx is
    'Ein Objekt hängt je Portal-KONTO nur einmal. nulls not distinct, damit '
    'der Index als ON CONFLICT-Ziel taugt und kontolose Zeilen (Verbindung '
    'angefangen) nicht mehrfach entstehen (0306, Fix zu 0304).';
