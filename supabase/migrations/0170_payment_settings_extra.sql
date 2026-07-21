-- 0170_payment_settings_extra.sql — fehlende Felder im Stripe-Dialog
--
-- Ergänzt die im ersten Wurf (0169) noch fehlenden Optionen des Stripe-Dialogs
-- (Lodgify, per Screenshot verifiziert):
--   * auto_charge_first_deposit — „Die Kreditkarte automatisch für die ERSTE
--     Anzahlung belasten" (separat von auto_charge_scheduled = alle folgenden).
--   * merchant_name             — „Name des Händlers" (Statement-Descriptor, der
--     dem Gast auf der Kartenabrechnung erscheint).
--
-- tenant_billing_profile ist bereits revoke/RLS/restriktiv geschützt (0169) —
-- neue Spalten erben das.

alter table public.tenant_billing_profile
    -- Erste (Sofort-)Anzahlung automatisch belasten. Default true = bisheriges
    -- Verhalten (Anzahlung wird beim Checkout kassiert).
    add column if not exists auto_charge_first_deposit boolean
        not null default true,
    -- Händlername auf der Kartenabrechnung des Gastes (Stripe statement_descriptor
    -- / Anzeigename). Kein Default — NULL heißt „Firmenname verwenden".
    add column if not exists merchant_name text;

comment on column public.tenant_billing_profile.merchant_name is
  'Name des Händlers auf der Kartenabrechnung (Stripe statement descriptor).';
