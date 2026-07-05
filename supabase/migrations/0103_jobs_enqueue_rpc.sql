-- 0103_jobs_enqueue_rpc.sql — Atomares, coalescendes Einreihen via RPC
--
-- BUG-FIX: enqueue() rief `upsert(on_conflict="dedup_key")` über PostgREST. Der
-- Coalescing-Index jobs_dedup_open_uq (0102) ist ein PARTIELLER Unique-Index
-- (nur WHERE dedup_key is not null AND status in ('queued','running')). PostgREST
-- kann ein partielles Index-Ziel nicht per Spaltenname inferieren → Postgres warf
-- 42P10 "no unique or exclusion constraint matching the ON CONFLICT specification".
-- Folge: JEDER Enqueue mit dedup_key (Reconcile-Tick, coalesce=True-ARI-Pushes,
-- Content-Sync) schlug fehl — der Worker konnte den Reconcile-Tick nicht fahren.
--
-- Lösung: das Einreihen in eine SQL-Funktion verlagern. In reinem SQL kann das
-- ON CONFLICT das partielle Index-PRÄDIKAT mitangeben und trifft den Index sauber.
-- Semantik unverändert: höchstens EIN offener Job je dedup_key; ein bestehender
-- offener Job wird mit dem neuen Payload/run_after überschrieben ("letzter
-- gewinnt"); erledigte Jobs (done/failed/dead) blockieren keinen neuen.
--
-- Idempotent: create or replace function.

create or replace function public.enqueue_job(
    p_job_type     text,
    p_payload      jsonb,
    p_tenant_id    uuid    default null,
    p_dedup_key    text    default null,
    p_max_attempts integer default 10,
    p_run_after    timestamptz default now()
)
    returns public.jobs
    language plpgsql
as $$
declare
    v_row public.jobs;
begin
    if p_dedup_key is null then
        -- Kein Coalescing → einfacher Insert.
        insert into public.jobs
            (job_type, payload, tenant_id, dedup_key, max_attempts, run_after)
        values
            (p_job_type, p_payload, p_tenant_id, null, p_max_attempts, p_run_after)
        returning * into v_row;
        return v_row;
    end if;

    -- Coalescing gegen den PARTIELLEN Unique-Index: Conflict-Ziel inkl. dessen
    -- WHERE-Prädikat angeben, damit Postgres exakt jobs_dedup_open_uq trifft.
    insert into public.jobs
        (job_type, payload, tenant_id, dedup_key, max_attempts, run_after)
    values
        (p_job_type, p_payload, p_tenant_id, p_dedup_key, p_max_attempts, p_run_after)
    on conflict (dedup_key)
        where dedup_key is not null and status in ('queued', 'running')
    do update
        set payload      = excluded.payload,
            job_type     = excluded.job_type,
            run_after    = excluded.run_after,
            max_attempts = excluded.max_attempts,
            updated_at   = now()
    returning * into v_row;
    return v_row;
end
$$;

-- Nur service_role (Worker/Enqueue laufen darüber); anon/authenticated haben
-- keinen Grund, Jobs einzureihen. Kein GRANT an public/anon.
revoke all on function public.enqueue_job(text, jsonb, uuid, text, integer, timestamptz) from public;
grant execute on function public.enqueue_job(text, jsonb, uuid, text, integer, timestamptz) to service_role;
