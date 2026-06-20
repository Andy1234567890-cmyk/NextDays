-- Firmenprofil erweitern: tenant_billing_profile bekommt die Felder, die für
-- Rechnungskopf + GoBD-Pflichtfooter nötig sind (Adresse, Kontakt, Register,
-- Geschäftsführer, Logo). Name/Steuer/Bank/E-Rechnung existieren bereits (0023).

alter table public.tenant_billing_profile
    add column if not exists company_street      text,
    add column if not exists company_house_number text,
    add column if not exists company_postal_code text,
    add column if not exists company_city        text,
    add column if not exists company_country     text,
    add column if not exists email               text,
    add column if not exists phone_number        text,
    add column if not exists website             text,
    add column if not exists company_register    text,   -- HRB-Nummer
    add column if not exists district_court      text,   -- Amtsgericht
    add column if not exists legal_form          text,   -- GmbH, e.K, …
    add column if not exists managing_director_first_name text,
    add column if not exists managing_director_last_name  text,
    add column if not exists company_logo_url    text;
