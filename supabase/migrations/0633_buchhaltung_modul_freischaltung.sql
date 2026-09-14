-- 0633 — `buchhaltung` als freischaltbares Modul (0572), nur für den Vorführbetrieb.
--
-- Anweisung vom 11.09.2026: „das buchhaltung tool muss nur bei theresa.gruber
-- frei geschaltet sein bei niemandem sonst". Der Riegel dafür ist der aus 0572
-- (`tenants.enabled_modules`, Server 404 + Sidebar blendet aus); dieses Skript
-- setzt den Wert. 0632 hat zusätzlich die unbezahlten Kauf-Entitlements der
-- anderen Betriebe deaktiviert — zwei Ebenen, die getrennt bleiben: die
-- Freischaltung sagt „gibt es für diesen Betrieb", das Entitlement „ist gebucht".
--
-- Nichts wird entfernt: `buchhaltung` stand bisher in KEINEM Betrieb, weil das
-- Modul den Riegel bis heute gar nicht kannte (alle vier Betriebe tragen nur
-- personal + website_builder, gelesen am 11.09.2026).

update public.tenants
set enabled_modules = array_append(enabled_modules, 'buchhaltung')
where ist_vorfuehrbetrieb
  and not ('buchhaltung' = any(enabled_modules));

do $$
declare
    anzahl integer;
    vorfuehr integer;
begin
    select count(*) into anzahl
    from public.tenants where 'buchhaltung' = any(enabled_modules);
    select count(*) into vorfuehr
    from public.tenants where 'buchhaltung' = any(enabled_modules) and ist_vorfuehrbetrieb;
    if anzahl <> 1 or vorfuehr <> 1 then
        raise exception '0633: erwartet genau 1 Betrieb mit buchhaltung (Vorführbetrieb), gefunden % / %.', anzahl, vorfuehr;
    end if;
end $$;
