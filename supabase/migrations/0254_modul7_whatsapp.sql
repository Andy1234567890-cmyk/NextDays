-- 0254_modul7_whatsapp.sql — Zusatzmodul 7 „WhatsApp" buchbar machen
--
-- Der CHECK auf tenant_module_entitlement.module_key (0117) listet die Module
-- explizit auf. Ohne Erweiterung wäre ein Kauf des WhatsApp-Moduls ein
-- 23514-Constraint-Fehler beim Stripe-Webhook — also der Kunde zahlt, aber das
-- Entitlement wird nicht geschrieben (Wurzel 1: Gegenzustand mitpflegen).
--
-- Preis liegt in Stripe (deploy/billing/seed_stripe_prices.py,
-- lookup_key `modul7_whatsapp_staffel`, tiers_mode=volume nach Objektzahl) —
-- hier steht bewusst KEIN Betrag (Wurzel 4).
--
-- Keine neue Tabelle → kein neuer RLS-/Grant-Bedarf; die bestehenden Policies
-- und Grants von tenant_module_entitlement gelten unverändert weiter.

alter table public.tenant_module_entitlement
    drop constraint if exists tenant_module_entitlement_module_key_check;

alter table public.tenant_module_entitlement
    add constraint tenant_module_entitlement_module_key_check
    check (module_key in (
        'modul3_buchhaltung', 'modul4_mitarbeiter',
        'modul5_jobmarkt', 'modul6_hotel',
        'modul7_whatsapp'
    ));
