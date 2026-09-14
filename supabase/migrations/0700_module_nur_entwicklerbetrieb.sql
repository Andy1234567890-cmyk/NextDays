-- 0700 — Pay-Module in Entwicklung (personal, website_builder, buchhaltung,
-- dac7) nur noch beim Entwickler-/Vorführbetrieb (theresa.gruber, 0630).
--
-- Anweisung vom 14.09.2026 (Betreiber): „nur bei theresa.gruber muss alles
-- frei bleiben, das ist mein Entwickler-Account". Anlass: ein zahlender
-- Betrieb sah DAC7, Personal und Website-Baukasten.
--
-- Zwei Ursachen, live gelesen am 14.09.2026:
--   1. `dac7` kannte den Riegel aus 0572 gar nicht — weder Sidebar noch Server.
--      Das ist jetzt im Code ergänzt; dieses Skript setzt den Wert.
--   2. 0572 gab personal + website_builder allein AirSmil; live trugen aber
--      ALLE vier Betriebe beide Module (Seeblick 07.09., Nordlys 10.09.,
--      Nordstrand 11.09.) — gesetzt per Hand, ohne Migration. Hier wird das
--      zurückgenommen: kein zahlender Betrieb sieht unfertige Module.
--
-- Namentlich über `ist_vorfuehrbetrieb`, nicht per Muster: welcher Betrieb ein
-- unfertiges Modul sieht, ist eine Entscheidung, keine Ableitung.

update public.tenants
   set enabled_modules = array['personal', 'website_builder', 'buchhaltung', 'dac7']
 where ist_vorfuehrbetrieb;

update public.tenants
   set enabled_modules = '{}'
 where not ist_vorfuehrbetrieb
   and enabled_modules <> '{}';

do $$
declare
    mit_modulen integer;
    vorfuehr integer;
begin
    select count(*) into mit_modulen
    from public.tenants where cardinality(enabled_modules) > 0;
    select count(*) into vorfuehr
    from public.tenants where ist_vorfuehrbetrieb and 'dac7' = any(enabled_modules);
    if mit_modulen <> 1 or vorfuehr <> 1 then
        raise exception '0700: erwartet genau 1 Betrieb mit Modulen (Vorführbetrieb), gefunden % / %.', mit_modulen, vorfuehr;
    end if;
end $$;
