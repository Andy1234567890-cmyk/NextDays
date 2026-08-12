-- 0376_verkauf_pause_kein_realtime.sql
-- Korrektur zu 0375: `property_sales_pause` aus der Realtime-Publikation
-- nehmen und `select` für anon/authenticated entziehen.
--
-- DER FEHLER IN 0375: Die Tabelle wurde der Publikation `supabase_realtime`
-- hinzugefügt, damit die Objekt-Liste live mitbekommt, wenn ein Objekt bei den
-- Portalen abgeschaltet wird. Ein Abo wirkt aber nur, wenn BEIDES stimmt:
-- `select` für `authenticated` UND Publikations-Mitgliedschaft. Die Live-Probe
-- direkt nach dem Einspielen zeigte für anon/authenticated nur `REFERENCES` —
-- also KEIN `select`, weil das pauschale Tabellen-Grant auf dieser Datenbank
-- ohnehin nicht gesetzt ist (`channex_channel_connection` hat es genauso nicht).
-- Das Abo wäre damit eine stumme Attrappe gewesen: die Oberfläche sieht live
-- aus und aktualisiert nie.
--
-- WARUM NICHT DER UMGEKEHRTE WEG (Grant öffnen): Wer den Verkauf eines Objekts
-- steuert, entscheidet über Umsatz. Ein eingeloggter cleaner oder owner darf
-- diese Zeilen nicht per anon-Key gegen `/rest/v1/property_sales_pause` lesen
-- (Wurzel 6). Für bewusst gesperrte Tabellen ist das Abo der Fehler, nicht der
-- fehlende Grant — die Oberfläche hört stattdessen auf `properties`, wo sich
-- `status`/`listed_on_marketplace` bei jedem Schaltvorgang mitändert.
--
-- `select` wird hier zusätzlich explizit entzogen, damit ein späteres pauschales
-- `grant select on all tables` die Sperre nicht still aufhebt.

revoke select on public.property_sales_pause from anon, authenticated;

do $$
begin
    if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'property_sales_pause'
    ) then
        alter publication supabase_realtime drop table public.property_sales_pause;
    end if;
end $$;
