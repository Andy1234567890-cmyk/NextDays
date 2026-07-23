-- =========================================================================
-- 0188 — Gastgeber-Profilfelder + Identitätsprüfung (Stripe Identity).
-- =========================================================================
-- Neue personengebundene Konto-Felder auf public.users (Airbnb-„Persönliche
-- Informationen"): bevorzugter Vorname, Wohn-/Postadresse, Notfallkontakt.
-- Plus der ECHTE Identitätsprüfungs-Status aus Stripe Identity (kein Fake-
-- „Verifiziert", Wurzel 4/5): identity_status ist entweder unverified /
-- processing / requires_input / verified — nie ein plausibler Default.
--
-- Ablageort: public.users, weil alle Felder personen- (nicht mandanten-)
-- gebunden sind und über den bestehenden update_profile/get_account-Pfad
-- laufen. users ist bereits per 0187 gehärtet (revoke von anon/authenticated,
-- restriktive Self-Read-Policy) → die neuen Spalten sind automatisch nicht per
-- anon-Key-curl lesbar; der Server liest/schreibt via service_role.
--
-- DSGVO/DE: Wir speichern KEINE Ausweisbilder/-nummern. Nur Status + die
-- Stripe-Session-ID (zum Rückmapping des Webhooks) und der Verifizierungs-
-- zeitpunkt. Ausweisdaten bleiben bei Stripe; Löschung via redact-Endpoint.
-- =========================================================================

alter table public.users
    -- Profil (Airbnb „Persönliche Informationen")
    add column if not exists preferred_first_name text,
    add column if not exists residential_street text,
    add column if not exists residential_postal_code text,
    add column if not exists residential_city text,
    add column if not exists residential_country text,          -- ISO-2
    add column if not exists mailing_street text,
    add column if not exists mailing_postal_code text,
    add column if not exists mailing_city text,
    add column if not exists mailing_country text,               -- ISO-2
    add column if not exists emergency_contact_name text,
    add column if not exists emergency_contact_phone text,
    -- Identitätsprüfung (Stripe Identity). Status ist die Quelle der Wahrheit.
    add column if not exists identity_status text not null default 'unverified'
        check (identity_status in
            ('unverified', 'processing', 'requires_input', 'verified')),
    add column if not exists identity_session_id text,           -- Stripe VerificationSession-ID
    add column if not exists identity_verified_at timestamptz;

comment on column public.users.preferred_first_name is
    'Bevorzugter Vorname (Anzeigename gegenüber Gästen).';
comment on column public.users.residential_country is
    'Wohnadresse-Land als ISO-2 (kein €/EU-Hardcode, Wurzel 4).';
comment on column public.users.emergency_contact_phone is
    'Notfallkontakt-Telefon (E.164). Personengebunden.';
comment on column public.users.identity_status is
    'Stripe-Identity-Status: unverified|processing|requires_input|verified. '
    'Nie ein Fake-Default „verified" (Wurzel 5) — wird ausschließlich vom '
    'Stripe-Webhook gesetzt.';
comment on column public.users.identity_session_id is
    'Stripe VerificationSession-ID zum idempotenten Rückmapping im Webhook. '
    'KEINE Ausweisdaten/-bilder — die bleiben bei Stripe (DSGVO/DE).';
