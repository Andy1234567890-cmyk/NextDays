-- =========================================================================
-- 0189 — OTP-Challenges (SMS-2FA / Nummern-Verifizierung) + phone_verified.
-- =========================================================================
-- Airbnb-„Confirm account"-Muster: ein Einmal-Code wird an die Telefonnummer
-- gesendet und muss eingegeben werden. Wir speichern NIE den Klartext-Code,
-- nur einen Hash (wie Passwörter). Der Code ist kurzlebig, einmal verwendbar,
-- mit begrenzten Fehlversuchen (Brute-Force-Schutz).
--
-- Sicherheit (Wurzel 6): nur der Server (service_role) schreibt/liest diese
-- Tabelle. anon/authenticated bekommen KEINE Grants — sonst könnte ein Client
-- per anon-Key-curl fremde Codes/Hashes lesen. Kein Realtime-Abo darauf.
-- =========================================================================

create table if not exists public.otp_challenge (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    tenant_id uuid,                                   -- Scope-Kontext
    -- Zweck: 'phone_verify' (Nummer bestätigen) | '2fa_login' (Login-Step-up).
    purpose text not null
        check (purpose in ('phone_verify', '2fa_login')),
    -- Ziel (E.164). Bei phone_verify die zu bestätigende Nummer.
    destination text not null,
    -- Nur der HASH des Codes (nie Klartext, wie Passwörter).
    code_hash text not null,
    -- Kurzlebig: nach Ablauf ungültig.
    expires_at timestamptz not null,
    -- Fehlversuche zählen → nach Limit sperren (Brute-Force-Schutz).
    attempts smallint not null default 0,
    -- Gesetzt, sobald erfolgreich eingelöst (einmal verwendbar).
    consumed_at timestamptz,
    created_at timestamptz not null default now()
);

-- Offene Challenges eines Nutzers schnell finden (pending-Wiederverwendung,
-- Aufräumen abgelaufener).
create index if not exists idx_otp_challenge_user
    on public.otp_challenge (user_id, purpose, created_at desc);

comment on table public.otp_challenge is
    'Kurzlebige Einmal-Codes (SMS-2FA / Nummern-Verifizierung). Nur code_hash, '
    'nie Klartext. Nur service_role (Wurzel 6). Kein Realtime.';

-- Nummer-Verifizierungs-Status am Nutzer (echter Status, kein Fake). NULL =
-- nicht verifiziert; Zeitpunkt = wann bestätigt.
alter table public.users
    add column if not exists phone_verified_at timestamptz;

comment on column public.users.phone_verified_at is
    'Zeitpunkt der SMS-Nummern-Verifizierung. NULL = nicht verifiziert '
    '(kein Fake-Default, Wurzel 5).';

-- --- Härtung (Wurzel 6): RLS + harter GRANT-Entzug --------------------------
alter table public.otp_challenge enable row level security;

-- Kein pauschales Grant an anon/authenticated — nur der Server (service_role)
-- greift zu. Falls durch Default-Privilegien etwas gesetzt wäre: entziehen.
revoke all on public.otp_challenge from anon, authenticated;

-- Restriktive Tenant-Guard für ALLE Operationen (nicht nur SELECT) — falls je
-- ein Grant hinzukäme, bleibt der Zugriff tenant-gescopt.
create policy otp_challenge_tenant_restrict on public.otp_challenge
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
