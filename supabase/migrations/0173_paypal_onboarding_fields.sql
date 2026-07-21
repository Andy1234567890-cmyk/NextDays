-- 0173_paypal_onboarding_fields.sql — PayPal-Multiparty-Onboarding je Tenant
--
-- Jeder Betrieb verbindet sein EIGENES PayPal-Geschäftskonto (Partner Referrals /
-- „Connected Path"). Diese Felder halten den Verbindungsstatus. Analog zum Stripe-
-- Connect-Block auf derselben Tabelle.
--
-- ABGRENZUNG zur bestehenden Spalte paypal_email (0169): jene ist die MANUELLE
-- PayPal-Adresse (Überweisungs-/PayPal.me-Kanal im Zahlungen-Tab), NICHT das
-- Multiparty-Onboarding. Der Multiparty-Verbindungsstatus ergibt sich AUSSCHLIESS-
-- LICH aus paypal_merchant_id + paypal_payments_receivable + paypal_email_confirmed
-- (fail-closed, Wurzel 5) — nie aus paypal_email.
--
-- tenant_billing_profile ist bereits revoke/RLS/restriktiv geschützt (0169) —
-- neue Spalten erben das (sensible Finanzdaten, Wurzel 6).

alter table public.tenant_billing_profile
    -- PayPal-Merchant-/Payer-ID des Verkäufers (aus dem Onboarding-Return /
    -- merchant-integrations-Status). Geht in jede Order als payee.merchant_id.
    add column if not exists paypal_merchant_id text,
    -- Unsere Tracking-ID für das Onboarding = tenant_id (Rückkanal-Zuordnung).
    add column if not exists paypal_tracking_id text,
    -- Roh-Status des Onboardings (Anzeige/Diagnose): not_started / pending /
    -- completed / revoked. Der „sellbar"-Zustand hängt NICHT hieran, sondern an
    -- den beiden Flags unten (fail-closed).
    add column if not exists paypal_onboarding_status text
        not null default 'not_started'
        check (paypal_onboarding_status in
               ('not_started', 'pending', 'completed', 'revoked')),
    -- Kann der Verkäufer Geld empfangen? (PayPal: payments_receivable) — Pflicht.
    add column if not exists paypal_payments_receivable boolean
        not null default false,
    -- Primär-E-Mail bestätigt? (PayPal: primary_email_confirmed) — Pflicht.
    add column if not exists paypal_email_confirmed boolean
        not null default false;

comment on column public.tenant_billing_profile.paypal_merchant_id is
  'PayPal-Verkäufer-Merchant-ID (Multiparty). Geht als payee.merchant_id in Orders.';
comment on column public.tenant_billing_profile.paypal_onboarding_status is
  'Roh-Status des PayPal-Onboardings. Sellbar = receivable && email_confirmed.';
