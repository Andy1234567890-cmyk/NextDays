-- Migration 0081: Stripe Connect Account ID pro Tenant
-- Speichert die Stripe Connected Account ID (acct_...) am Tenant-Profil,
-- damit Zahlungen und Auszahlungen korrekt geroutet werden können.

ALTER TABLE tenant_billing_profile
  ADD COLUMN IF NOT EXISTS stripe_account_id        text,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_at     timestamptz;

COMMENT ON COLUMN tenant_billing_profile.stripe_account_id IS
  'Stripe Connect Custom Account ID (acct_...). NULL = noch nicht onboardet.';
COMMENT ON COLUMN tenant_billing_profile.stripe_charges_enabled IS
  'Stripe: Konto kann Zahlungen empfangen.';
COMMENT ON COLUMN tenant_billing_profile.stripe_payouts_enabled IS
  'Stripe: Konto kann Auszahlungen erhalten.';
COMMENT ON COLUMN tenant_billing_profile.stripe_details_submitted IS
  'Stripe: KYC vollständig eingereicht.';
COMMENT ON COLUMN tenant_billing_profile.stripe_onboarding_at IS
  'Zeitpunkt an dem das Stripe-Onboarding abgeschlossen wurde.';
