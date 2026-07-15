-- 0145_stop_sell_channel_scope.sql — Stop-Sell pro Vertriebskanal
--
-- Bisher war Stop-Sell GLOBAL: eine Zeile je (property, date) sperrte den Tag
-- auf ALLEN Kanälen (eigene Plattform + Rezeption + alle OTAs). Das ist der
-- Standardfall und bleibt der einfache Default. Neu: ein Stop-Sell kann gezielt
-- nur bestimmte Kanäle sperren (z. B. nur Booking.com, eigene Plattform offen).
--
-- Modelliert additiv auf der bestehenden Zeile (unique(property_id,date) BLEIBT
-- erhalten — die Upserts des Channex-Imports und von set_stop_sell brauchen
-- keine Constraint-Änderung):
--   scope='all'      → wie bisher: alle Kanäle gesperrt (Default, Altdaten).
--   scope='channels' → nur die in channels[] genannten Kanäle.
-- Kanal-Tokens (kein DB-Enum, weil OTAs dynamisch sind):
--   'platform'        eigene Plattform (booking_engine)
--   'reception'       Rezeption/Direktbuchung (reservations)
--   'ota:<code>'      ein einzelnes OTA, code = channex_channel_connection.ota_portal_code
--   'ota:*'           alle OTAs gesammelt
--
-- Altzeilen bleiben scope='all' (Default) → das bisherige Verhalten ändert sich
-- für keine bestehende Sperre. stop_sell hat bereits RLS (0084) — hier werden
-- nur Spalten ergänzt, daher keine neue Policy nötig.

alter table public.stop_sell
    add column if not exists scope text not null default 'all'
        check (scope in ('all', 'channels'));

alter table public.stop_sell
    add column if not exists channels text[] not null default '{}';

-- scope='channels' mit leerem Set wäre ein Stop-Sell, der nichts sperrt
-- (fail-open-Falle) — verbieten. scope='all' ignoriert channels.
alter table public.stop_sell
    add constraint stop_sell_channels_nonempty
        check (scope <> 'channels' or cardinality(channels) > 0);
