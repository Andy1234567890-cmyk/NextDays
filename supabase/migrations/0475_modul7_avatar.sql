-- 0475_modul7_avatar.sql — Zusatzmodul 7 „Avatar" buchbar machen
--
-- Der CHECK auf tenant_module_entitlement.module_key (0117, letzter Stand 0278)
-- listet die Module explizit auf. Ohne diese Erweiterung liefe der Upsert im
-- Stripe-Webhook (`_sync_module_entitlements`) in einen 23514: der Kunde zahlt,
-- das Entitlement wird nicht geschrieben (Wurzel 1: Gegenzustand mitpflegen).
--
-- Die Nummer 7 war früher WhatsApp; das Modul wurde mit 0256 zurückgenommen
-- (Metas No-Resale-Klausel) und seine Zeilen dabei gelöscht — die Nummer ist
-- also frei und trägt keinen Altbestand.
--
-- Preis liegt in Stripe (deploy/billing/seed_stripe_prices.py, lookup_key
-- `modul7_flat`, 89,90 EUR je Betrieb und Monat) — hier steht bewusst KEIN
-- Betrag (Wurzel 4).
--
-- Keine neue Tabelle → kein neuer RLS-/Grant-Bedarf; die Policies und Grants
-- von tenant_module_entitlement (0117/0224/0337) gelten unverändert weiter.

alter table public.tenant_module_entitlement
    drop constraint if exists tenant_module_entitlement_module_key_check;

alter table public.tenant_module_entitlement
    add constraint tenant_module_entitlement_module_key_check
    check (module_key in (
        'modul3_buchhaltung', 'modul4_mitarbeiter',
        'modul5_jobmarkt', 'modul6_hotel',
        'modul7_avatar',
        'dynamische_preise'
    ));
