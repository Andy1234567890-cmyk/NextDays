-- 0278_modul_dynamische_preise_buchbar.sql — „Dynamische Preise" buchbar machen
--
-- Der CHECK auf tenant_module_entitlement.module_key (0117, letzter Stand 0256)
-- listet die Module explizit auf und kennt nur die vier Abo-Module. Das neue
-- nutzungsabhängige Modul `dynamische_preise` (0,5 % vom Buchungsumsatz,
-- Ledger 0277) fehlt dort — der Upsert in `SubscriptionsService.add_module`
-- läuft deshalb live in einen 23514-Constraint-Fehler: der Kunde klickt
-- „Aktivieren", bekommt einen 500 und das Modul bleibt aus. In den Tests fällt
-- das nicht auf, weil der DB-Fake keine CHECKs kennt.
--
-- Gleiche Klasse wie 0254 (WhatsApp) — jeder neue `module_key` im Code braucht
-- diesen Gegenzustand in der DB (Wurzel 1).
--
-- Der Betrag steht bewusst NICHT hier: die 0,5 % liegen als
-- `DYNPRICING_RATE` im Code und die Faktura läuft über `dynpricing_ledger`
-- mit Währung je Zeile (Wurzel 4) — kein Stripe-Preis, kein Meter.
--
-- Keine neue Tabelle → kein neuer RLS-/Grant-Bedarf; die Policies und Grants
-- von tenant_module_entitlement (0117/0224) gelten unverändert weiter.

alter table public.tenant_module_entitlement
    drop constraint if exists tenant_module_entitlement_module_key_check;

alter table public.tenant_module_entitlement
    add constraint tenant_module_entitlement_module_key_check
    check (module_key in (
        'modul3_buchhaltung', 'modul4_mitarbeiter',
        'modul5_jobmarkt', 'modul6_hotel',
        'dynamische_preise'
    ));
