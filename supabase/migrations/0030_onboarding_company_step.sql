-- 0030_onboarding_company_step.sql
-- Firmendaten-Schritt im Onboarding: neues Status-Flag, ob der Kunde seine
-- Firmen-/Rechnungsstammdaten (tenant_billing_profile) ausgefüllt hat. Der
-- Wizard verlangt diese als ERSTEN Schritt (Konto vollständig + nötig für die
-- Channel-Anbindung: OTA-Property braucht Adresse/Kontakt).

alter table public.tenant_onboarding
    add column if not exists company_data_set boolean not null default false;
