-- Geräteverlauf / aktive Sitzungen (Airbnb „Login & Sicherheit → Geräteverlauf").
--
-- Die aktiven Sitzungen eines Nutzers liegen in auth.sessions (GoTrue schreibt
-- user_agent, ip, created_at, refreshed_at bei jedem Login). Dieses Schema ist
-- über PostgREST NICHT erreichbar (nur public exponiert) und der API-Service
-- spricht mit service_role, nicht mit dem User-JWT. Darum drei SECURITY DEFINER-
-- Funktionen in public, die den Scope SERVERSEITIG erzwingen (Wurzel 3): jede
-- nimmt p_user_id und filtert hart darauf — der aufrufende Service reicht
-- ctx.user_id durch, nie eine Client-ID.
--
-- Härtung (Wurzel 6): search_path='', schema-qualifiziert, execute NUR für
-- service_role (anon/authenticated dürfen diese Funktionen nicht ausführen —
-- sonst könnte ein anon-Key fremde Sessions widerrufen).

-- 1) Eigene aktive Sitzungen lesen. Abgelaufene (not_after < now) werden
--    ausgeblendet — nur was wirklich noch gilt, ist ein „aktives Gerät".
create or replace function public.host_list_own_sessions(p_user_id uuid)
returns table (
  id uuid,
  user_agent text,
  ip text,
  created_at timestamptz,
  last_seen_at timestamptz,
  not_after timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    s.id,
    s.user_agent,
    host(s.ip) as ip,
    s.created_at,
    coalesce(s.refreshed_at::timestamptz, s.created_at) as last_seen_at,
    s.not_after
  from auth.sessions s
  where s.user_id = p_user_id
    and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at::timestamptz, s.created_at) desc;
$$;

-- 2) EINE eigene Sitzung widerrufen (abmelden). Der Scope auf p_user_id
--    verhindert das Löschen fremder Sitzungen selbst bei erratener session_id
--    (Wurzel 3/9 — Item-Level-Autorisierung wie die Liste). Löschen kaskadiert
--    per FK auf auth.refresh_tokens → das Refresh-Token ist sofort tot.
create or replace function public.host_revoke_session(
  p_user_id uuid,
  p_session_id uuid
)
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from auth.sessions s
    where s.id = p_session_id
      and s.user_id = p_user_id
    returning 1
  )
  select count(*)::integer from deleted;
$$;

-- 3) Alle ANDEREN eigenen Sitzungen widerrufen („Auf allen anderen Geräten
--    abmelden"). Die aktuelle Sitzung (p_keep_session_id) bleibt bestehen.
create or replace function public.host_revoke_other_sessions(
  p_user_id uuid,
  p_keep_session_id uuid
)
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from auth.sessions s
    where s.user_id = p_user_id
      and (p_keep_session_id is null or s.id <> p_keep_session_id)
    returning 1
  )
  select count(*)::integer from deleted;
$$;

alter function public.host_list_own_sessions(uuid) set search_path = '';
alter function public.host_revoke_session(uuid, uuid) set search_path = '';
alter function public.host_revoke_other_sessions(uuid, uuid) set search_path = '';

-- execute NUR service_role — der API-Server ist der einzige legitime Aufrufer.
revoke execute on function public.host_list_own_sessions(uuid)
  from anon, authenticated, public;
revoke execute on function public.host_revoke_session(uuid, uuid)
  from anon, authenticated, public;
revoke execute on function public.host_revoke_other_sessions(uuid, uuid)
  from anon, authenticated, public;
grant execute on function public.host_list_own_sessions(uuid) to service_role;
grant execute on function public.host_revoke_session(uuid, uuid) to service_role;
grant execute on function public.host_revoke_other_sessions(uuid, uuid) to service_role;
