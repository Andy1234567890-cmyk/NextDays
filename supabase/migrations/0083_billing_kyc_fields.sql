-- 0083_billing_kyc_fields.sql — KYC-Felder für Stripe Connect
--
-- Für die Aktivierung eines Stripe Connected Accounts (charges_enabled) verlangt
-- Stripe je nach Kontotyp Pflichtdaten, die im Firmenprofil bisher fehlten:
--   * account_type — Einzelperson vs. Firma (bestimmt business_type bei Stripe)
--   * owner_dob    — Geburtsdatum der natürlichen Person (Einzelperson bzw. der
--                    vertretungsberechtigten Person einer Firma)
-- tenant_billing_profile ist über 0054 bereits in der Realtime-Publication.

alter table public.tenant_billing_profile
  add column if not exists account_type text not null default 'individual'
    check (account_type in ('individual', 'company')),
  add column if not exists owner_dob date;

comment on column public.tenant_billing_profile.account_type is
  'Stripe-Kontotyp: individual (Einzelperson) | company (Firma). '
  'Bestimmt die KYC-Pflichtfelder beim Connected Account.';
comment on column public.tenant_billing_profile.owner_dob is
  'Geburtsdatum der natürlichen Person (Einzelperson bzw. vertretungs- '
  'berechtigte Person einer Firma) — Stripe-KYC-Pflicht für charges_enabled.';
