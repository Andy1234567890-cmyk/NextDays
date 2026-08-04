-- 0279_platform_admin_passwort_reset.sql — „Passwort vergessen" fürs Backoffice
--
-- WARUM EIGENER WEG: GoTrue kann in diesem Setup keine Mails verschicken
-- (`GOTRUE_SMTP_HOST` ist leer, live geprüft) — `reset_password_email()` läuft
-- dort ins Leere. Der Backoffice-Reset läuft deshalb über denselben Weg wie die
-- Einladung (0237): Einmal-Token von uns, Versand über `core.mail` gegen den
-- eigenen Mailcow-Server, Passwort per GoTrue-Admin-API gesetzt.
--
-- Eigene Spalten statt Wiederverwendung der invite_*-Spalten: `accept` prüft
-- `accepted_at is null` und würde einen Reset-Token eines bereits
-- angenommenen Zugangs nie akzeptieren. Zwei Vorgänge, zwei Zustände — sonst
-- hängen Einladung und Reset aneinander (Wurzel 1).
--
-- In der DB liegt NUR der SHA-256 des Tokens (Wurzel 6): ein DB-Leser bekommt
-- damit keinen benutzbaren Link. `reset_requested_at` ist die Grundlage für die
-- Missbrauchs-Sperre im Service (eine Anfrage je Minute je Konto) und macht im
-- Protokoll sichtbar, dass jemand einen Reset angestoßen hat.
--
-- Kein neuer RLS-/Grant-Bedarf: `platform_admins` trägt die restriktive Policy
-- `platform_admins_deny_all` (USING false) und hat für anon/authenticated
-- KEINE Grants — nur service_role liest und schreibt. Neue Spalten erben das.

alter table public.platform_admins
    add column if not exists reset_token_hash text,
    add column if not exists reset_expires_at timestamptz,
    add column if not exists reset_requested_at timestamptz;

-- Ein Token gehört zu genau einem Zugang. Partiell, damit die vielen NULLs
-- (niemand hat gerade einen offenen Reset) nicht kollidieren — wie beim
-- Einladungs-Token.
create unique index if not exists platform_admins_reset_token_uq
    on public.platform_admins (reset_token_hash)
    where reset_token_hash is not null;

comment on column public.platform_admins.reset_token_hash is
    'SHA-256 des Passwort-Reset-Tokens (Klartext steht nur im Mail-Link).';
comment on column public.platform_admins.reset_expires_at is
    'Ende der Gültigkeit des Reset-Tokens; danach fail-closed abgelehnt.';
comment on column public.platform_admins.reset_requested_at is
    'Zeitpunkt der letzten Reset-Anforderung (Grundlage der Mail-Sperre).';
