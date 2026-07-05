-- 0108_jobs_coalesce_queued_only.sql — Coalescing NUR gegen wartende Jobs
--
-- BUG (Loop-Fund): Der Coalescing-Index jobs_dedup_open_uq (0102) umfasste
-- status IN ('queued','running'). Ein enqueue_job mit demselben dedup_key,
-- während der Job schon 'running' ist, machte daher ein DO UPDATE auf die
-- laufende Zeile (payload/run_after überschrieben, status bleibt 'running').
-- Der bereits im Worker laufende Handler hat seine payload aber schon gelesen
-- und arbeitet mit dem ALTEN Stand weiter; bei Abschluss setzt _finish die
-- Zeile hart auf 'done'. Die zwischenzeitlich hineingemergte NEUE payload wird
-- damit endgültig verworfen, OHNE je zu laufen — „letzter gewinnt" galt nur,
-- solange der Job 'queued' war; bei 'running' gewann in Wahrheit der ERSTE und
-- die letzte Änderung ging lautlos verloren (betraf reconcile_tenant,
-- sync_property_content, coalescte push_ari).
--
-- FIX: Das Coalescing NUR noch gegen wartende ('queued') Jobs führen. Ist der
-- Job bereits 'running', entsteht ein NEUER queued-Job mit der neuen payload —
-- der Worker arbeitet ihn nach dem laufenden ab, die Änderung geht nie verloren.
-- Höchstens EIN wartender Job je dedup_key bleibt garantiert (Queue-Stau-Schutz).

-- 1) Index auf nur 'queued' umstellen.
drop index if exists public.jobs_dedup_open_uq;
create unique index if not exists jobs_dedup_queued_uq
    on public.jobs (dedup_key)
    where dedup_key is not null and status = 'queued';

-- 2) RPC: ON CONFLICT-Ziel auf das neue Prädikat (nur queued). Trifft ein
--    laufender Job denselben dedup_key, greift der Index NICHT (er deckt nur
--    'queued' ab) → es entsteht sauber ein neuer queued-Job.
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
        insert into public.jobs
            (job_type, payload, tenant_id, dedup_key, max_attempts, run_after)
        values
            (p_job_type, p_payload, p_tenant_id, null, p_max_attempts, p_run_after)
        returning * into v_row;
        return v_row;
    end if;

    insert into public.jobs
        (job_type, payload, tenant_id, dedup_key, max_attempts, run_after)
    values
        (p_job_type, p_payload, p_tenant_id, p_dedup_key, p_max_attempts, p_run_after)
    on conflict (dedup_key)
        where dedup_key is not null and status = 'queued'
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

revoke all on function public.enqueue_job(text, jsonb, uuid, text, integer, timestamptz) from public;
revoke all on function public.enqueue_job(text, jsonb, uuid, text, integer, timestamptz) from anon;
revoke all on function public.enqueue_job(text, jsonb, uuid, text, integer, timestamptz) from authenticated;
grant execute on function public.enqueue_job(text, jsonb, uuid, text, integer, timestamptz) to service_role;
