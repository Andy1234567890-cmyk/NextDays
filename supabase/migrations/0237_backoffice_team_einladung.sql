-- Backoffice-Team: Kolleg:innen einladen, statt Zeilen von Hand einzutragen.
--
-- AUSGANGSLAGE (0202): `platform_admins` vergibt den einzigen mandanten-
-- übergreifenden Zugang der Plattform — aber es gibt KEINEN Weg, jemanden
-- aufzunehmen. Ein neuer Support-Mitarbeiter brauchte bisher zwei manuelle
-- Schritte auf dem Server: einen GoTrue-Nutzer anlegen (Selbstregistrierung ist
-- per GOTRUE_DISABLE_SIGNUP aus) und eine Zeile per psql einfügen. Das ist kein
-- Betriebsmodell, sondern eine offene Baustelle.
--
-- Diese Migration ergänzt genau das Fehlende:
--   • einen EINMAL-Einladungstoken je Zeile (nur als Hash gespeichert),
--   • die Möglichkeit, eine E-Mail auf ihre Auth-Identität aufzulösen, ohne das
--     auth-Schema für PostgREST zu öffnen.
--
-- Der Zugang selbst bleibt, wie er ist: kein anon/authenticated-Grant, Deny-all,
-- Prüfung bei jedem Request gegen die Tabelle (Wurzel 6/7).

-- --- Einladung ---------------------------------------------------------------
alter table public.platform_admins
    -- SHA-256 des Einmal-Tokens. Der Klartext existiert nur im Link, den die
    -- eingeladene Person per Mail bekommt — nie in der Datenbank (Wurzel 6:
    -- ein DB-Leak darf keinen Zugang verschaffen).
    add column if not exists invite_token_hash text,
    add column if not exists invite_expires_at timestamptz,
    add column if not exists invited_at timestamptz,
    -- Zeitpunkt der Annahme; danach ist der Token verbraucht (single-use).
    add column if not exists accepted_at timestamptz;

create unique index if not exists platform_admins_invite_token_uq
    on public.platform_admins (invite_token_hash)
    where invite_token_hash is not null;

comment on column public.platform_admins.invite_token_hash is
    'SHA-256 des Einmal-Einladungstokens. Einmal verwendbar, danach NULL. '
    'Klartext wird nie gespeichert.';

-- --- E-Mail → Auth-Identität -------------------------------------------------
-- Das auth-Schema ist für PostgREST nicht freigegeben (und soll es nicht
-- werden). Für die Einladung muss der Server aber wissen, ob eine Adresse schon
-- ein Konto hat — sonst legt er ein zweites an oder scheitert mit „E-Mail
-- vergeben", ohne den bestehenden Zugang freischalten zu können.
--
-- Die Funktion gibt AUSSCHLIESSLICH eine uuid zurück, nie Nutzerdaten, und ist
-- für anon/authenticated gesperrt: nur der Server (service_role) darf sie
-- aufrufen. Vergleich case-insensitiv, weil GoTrue Adressen kleinschreibt.
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select u.id
    from auth.users u
    where lower(u.email) = lower(trim(p_email))
    limit 1
$$;

comment on function public.auth_user_id_by_email(text) is
    'E-Mail → auth.users.id für die Backoffice-Einladung. Gibt nur eine uuid '
    'zurück, nie Nutzerdaten. SECURITY DEFINER, nur service_role darf sie '
    'ausführen.';

revoke execute on function public.auth_user_id_by_email(text) from public;
revoke execute on function public.auth_user_id_by_email(text) from anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;
