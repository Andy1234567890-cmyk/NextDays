-- 0163_billing_company_state.sql — Bundesland/Region im Firmenprofil
--
-- Das Onboarding (Schritt „Firmendaten") und /konto zeigen ein Feld
-- „Bundesland / Region", das bisher KEINE DB-Spalte hatte → der Wert wurde nie
-- gespeichert und konnte nicht zwischen Onboarding und /konto geteilt werden.
-- Manche Länder-/Stripe-KYC-Anforderungen (state/province der Firmenadresse)
-- brauchen die Region; diese Spalte gibt ihr ein Zuhause.
--
-- Nullable, kein Default — nicht jedes Land/keine jede Rechtsform braucht eine
-- Region; leer bleibt leer (kein erfundener Wert). tenant_billing_profile hat
-- bereits RLS + Grants; eine neue Textspalte erbt sie (nicht sensibler als
-- company_city/company_street, die schon da sind).

alter table public.tenant_billing_profile
    add column if not exists company_state text;

comment on column public.tenant_billing_profile.company_state is
    'Bundesland/Region der Firmenadresse (Onboarding + /konto). Nullable — nicht '
    'jedes Land braucht sie. Wird bei Bedarf an Stripe (company.address.state) '
    'weitergereicht.';
