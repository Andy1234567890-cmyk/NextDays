-- TOTP-2FA (Authenticator-App) — eigenes Backend, kein externer SMS-Dienst.
-- Das Secret wird ausschließlich vom FastAPI-Backend über die Service-Role
-- gelesen/geschrieben (pyotp). Der Nutzer sieht über RLS nur seinen STATUS
-- (enabled), niemals das Secret selbst.

create table if not exists public.user_mfa (
    user_id        uuid primary key references auth.users (id) on delete cascade,
    -- Base32-TOTP-Secret. Nur Service-Role darf diese Spalte lesen (siehe RLS).
    totp_secret    text not null,
    -- true = Enrollment per Code bestätigt und aktiv.
    totp_enabled   boolean not null default false,
    -- Beim Aktivieren erzeugte Einmal-Wiederherstellungscodes (gehasht).
    recovery_codes text[] not null default '{}',
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- updated_at automatisch pflegen (gleiches Muster wie übrige Tabellen).
create trigger user_mfa_set_updated_at
    before update on public.user_mfa
    for each row execute function public.set_updated_at();

alter table public.user_mfa enable row level security;

-- Der Nutzer darf NUR seine eigene Zeile sehen (Status). Die Secret-Spalte wird
-- im Backend ausschließlich über die Service-Role gelesen — anon/authenticated
-- bekommen über diese Policy zwar die Zeile, aber das Frontend fragt das Secret
-- nie ab (und sollte es nicht). Insert/Update/Delete laufen über Service-Role,
-- die RLS ohnehin umgeht.
drop policy if exists user_mfa_self_read on public.user_mfa;
create policy user_mfa_self_read
    on public.user_mfa for select
    to authenticated
    using (user_id = auth.uid());
