-- 0178_property_ical_export_token.sql — iCal-EXPORT-Feed pro Objekt
--
-- Gegenstück zum Import (0119): der Kunde exportiert die Belegung EINES Objekts
-- als öffentlichen .ics-Feed, den externe Kalender (Airbnb/Booking/Google …)
-- abonnieren. Der Feed enthält NUR belegte Nächte (Buchungen + eigene Sperren),
-- keine Gast-/Preis-/Stammdaten.
--
-- Der Feed-Endpunkt ist NICHT eingeloggt (ein Kalender-Client schickt kein JWT)
-- → der Zugang läuft über ein unratbares Token in der URL. Das Token liegt pro
-- Objekt, ist rotierbar (Rotation macht die alte URL sofort ungültig) und wird
-- NIE an anon/authenticated ausgeliefert (Wurzel 6): der Feed wird serverseitig
-- (service_role) über das Token aufgelöst.

-- =========================================================================
-- 1. Export-Token pro Objekt
-- =========================================================================
-- 32 zufällige Bytes als URL-sicheres Hex — unratbar, aber stabil, solange der
-- Kunde nicht rotiert. NULL = Export noch nicht aktiviert (kein Feed).
alter table public.properties
    add column if not exists ical_export_token text;

-- Token muss eindeutig sein (Feed → genau ein Objekt) und schnell auflösbar.
create unique index if not exists properties_ical_export_token_idx
    on public.properties (ical_export_token)
    where ical_export_token is not null;

-- =========================================================================
-- 2. Wurzel 6 — Token ist ein Geheimnis, NIE an anon/authenticated ausliefern
-- =========================================================================
-- Ein eingeloggter Client mit anon-Key könnte sonst per curl /rest/v1/properties
-- die Export-Token FREMDER Tenants lesen und deren Belegung abgreifen. Das
-- pauschale Tabellen-GRANT verhindert ein Spalten-REVOKE — daher erst das
-- breite SELECT entziehen und dann gezielt alle Spalten AUSSER dem Token wieder
-- gewähren (Muster wie totp_secret). Geschrieben/gelesen wird das Token
-- ausschließlich serverseitig über service_role.
do $$
declare
    col text;
    cols text := '';
begin
    for col in
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'properties'
          and column_name <> 'ical_export_token'
        order by ordinal_position
    loop
        cols := cols || format('%I, ', col);
    end loop;
    cols := left(cols, length(cols) - 2);  -- letztes ", " entfernen

    execute 'revoke select on public.properties from anon, authenticated';
    execute format(
        'grant select (%s) on public.properties to anon, authenticated',
        cols
    );
end $$;

comment on column public.properties.ical_export_token is
  'Unratbares Token für den öffentlichen iCal-EXPORT-Feed dieses Objekts. '
  'Geheim: nie an anon/authenticated ausliefern, serverseitig über service_role '
  'auflösen. Rotierbar (macht die alte Feed-URL ungültig).';
