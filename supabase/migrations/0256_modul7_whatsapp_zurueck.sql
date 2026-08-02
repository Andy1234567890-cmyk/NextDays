-- 0256_modul7_whatsapp_zurueck.sql — WhatsApp ist KEIN kostenpflichtiges Modul
--
-- Rücknahme von 0254. Grund ist kein Sinneswandel, sondern Metas Vertragslage:
-- Section 5 („No Resale") der Meta Business Messaging Technology Provider Terms
-- (Stand 31.07.2026) verbietet einem Tech Provider ausdrücklich
--   „charging a fee for your Customers' use of the WhatsApp Business Platform"
-- und erlaubt Gebühren nur für Leistungen, die von der Plattform-Nutzung
-- UNABHÄNGIG sind. Ein Modul, dessen einziger Effekt das Freischalten von
-- WhatsApp ist, fällt unter das Verbot — unabhängig davon, wie es heißt.
--
-- Konsequenz: Der WhatsApp-Kanal gehört zum Grundtarif (Modell wie Hostaway,
-- die für WhatsApp ebenfalls nichts extra verlangen). Das Stripe-Produkt und
-- der Preis sind archiviert, das Feature-Gate im whatsapp-Slice entfernt.
--
-- Reihenfolge beachtet den Gegenzustand (Wurzel 1): erst die Zeilen weg, dann
-- der CHECK — andersherum liefe das ALTER auf verbliebene Zeilen und schlüge fehl.

delete from public.tenant_module_entitlement
    where module_key = 'modul7_whatsapp';

alter table public.tenant_module_entitlement
    drop constraint if exists tenant_module_entitlement_module_key_check;

alter table public.tenant_module_entitlement
    add constraint tenant_module_entitlement_module_key_check
    check (module_key in (
        'modul3_buchhaltung', 'modul4_mitarbeiter',
        'modul5_jobmarkt', 'modul6_hotel'
    ));
