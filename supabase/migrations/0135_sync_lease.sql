-- 0135_sync_lease.sql
-- Poolsichere Lease ersetzt die Advisory-Lock-RPCs aus 0134.
--
-- Befund (Review): pg_try_advisory_lock über PostgREST ist SESSION-scoped —
-- die Session gehört aber dem PostgREST-Connection-Pool, nicht dem Aufrufer.
-- Der Lock landete auf einem beliebigen Pool-Backend, das Release traf mit
-- hoher Wahrscheinlichkeit ein ANDERES Backend (No-op) → der Lock leakte
-- dauerhaft und legte den Buchungs-Feed-Pull still (bzw. Fremd-Release hob
-- das Single-Flight auf). Zusätzlich fehlten die Grants-Absperrungen (anon
-- konnte die RPCs aufrufen → DoS auf den Feed).
--
-- Ersatz: eine Lease-Zeile mit Ablaufzeit. Atomar per UPDATE … WHERE
-- claimed_until < now(); crash-selbstheilend (Timeout), poolsicher (reiner
-- Datenzugriff, keine Session-Semantik).

-- Alte, kaputte Advisory-RPCs entfernen (0134 superseded).
drop function if exists public.try_channex_feed_lock(bigint);
drop function if exists public.release_channex_feed_lock(bigint);

create table if not exists public.sync_lease (
    name          text primary key,
    claimed_until timestamptz not null default '-infinity',
    claimed_by    text
);

-- Kein Client-Zugriff: nur der Server (service_role) verwaltet Leases.
alter table public.sync_lease enable row level security;
-- (keine Policies → anon/authenticated sehen/ändern nichts; service_role
--  umgeht RLS by design.)

create or replace function public.try_acquire_sync_lease(
    p_name text, p_seconds integer, p_owner text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    got boolean := false;
begin
    insert into public.sync_lease(name, claimed_until, claimed_by)
    values (p_name, now() + make_interval(secs => p_seconds), p_owner)
    on conflict (name) do update
        set claimed_until = excluded.claimed_until,
            claimed_by    = excluded.claimed_by
        where public.sync_lease.claimed_until < now();
    -- Bei Konflikt ohne Update (Lease noch aktiv) ändert sich nichts →
    -- prüfen, ob WIR jetzt der Halter sind.
    select (claimed_by = p_owner and claimed_until > now())
      into got
      from public.sync_lease
     where name = p_name;
    return coalesce(got, false);
end;
$$;

create or replace function public.release_sync_lease(
    p_name text, p_owner text
) returns boolean
language sql
security definer
set search_path = ''
as $$
    update public.sync_lease
       set claimed_until = '-infinity'
     where name = p_name
       and claimed_by = p_owner
    returning true;
$$;

-- Grants-Konvention wie 0106: RPCs nur für den Server.
revoke execute on function public.try_acquire_sync_lease(text, integer, text)
    from public, anon, authenticated;
revoke execute on function public.release_sync_lease(text, text)
    from public, anon, authenticated;
grant execute on function public.try_acquire_sync_lease(text, integer, text)
    to service_role;
grant execute on function public.release_sync_lease(text, text)
    to service_role;
