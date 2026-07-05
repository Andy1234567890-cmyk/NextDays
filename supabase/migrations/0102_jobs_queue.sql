-- 0102_jobs_queue.sql — Generische Background-Job-Queue (Skalierung 100 Betriebe)
--
-- Verallgemeinert das bewährte ari_outbox-Muster (0033) zu einer allgemeinen
-- Job-Queue. Ziel: Channex-Sync/ARI-Push/Reconcile/Recompute aus dem synchronen
-- Request-Pfad heraus in einen Worker-Prozess (src/worker.py) verlagern, der die
-- Jobs mit Concurrency-Pool und kontoweitem Channex-Token-Budget abarbeitet.
-- Grund: 1 Content-Sync = ~3 s; 800 Objekte seriell = ~40 min → der 15-min-
-- Reconcile überlappt sich sonst 3-4x (Baseline 05.07.2026).
--
-- Substrat = Postgres (nicht Redis-Stream): Persistenz/Idempotenz/Sichtbarkeit
-- wie ari_outbox, service_role-Zugriff etabliert, Reentrancy via FOR UPDATE SKIP
-- LOCKED. Redis bleibt nur für das flüchtige Channex-Token-Budget (ratelimit.py).
-- ari_outbox bleibt bestehen (Doppelbuchungsschutz zu spezifisch) und wird erst
-- in einer Folgephase in jobs eingeschmolzen.
--
-- Idempotent: create type/table/index/function via if-not-exists bzw. or-replace.

-- Status-Lebenszyklus: queued → running → done | failed | dead.
--   done   = fachlich erledigt (auch No-op, z. B. Property nicht bei Channex).
--   failed = fachlich endgültig gescheitert (reserviert; z. B. 4xx-Validierung).
--   dead   = Retry-Budget (max_attempts) erschöpft.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum
      ('queued', 'running', 'done', 'failed', 'dead');
  end if;
end
$$;

create table if not exists public.jobs (
    id           uuid primary key default gen_random_uuid(),
    -- NULL = globaler Job (z. B. tenant-übergreifender Wartungslauf). Sonst der
    -- Tenant, in dessen Scope der Handler arbeitet (Scope kommt aus dem Payload,
    -- der Worker läuft mit service_role — wie process_ari_outbox/reconcile).
    tenant_id    uuid references public.tenants (id) on delete cascade,
    job_type     text not null,
    payload      jsonb not null default '{}'::jsonb,
    status       public.job_status not null default 'queued',
    attempts     integer not null default 0,
    max_attempts integer not null default 10,
    run_after    timestamptz not null default now(),  -- Backoff/Delay-Fälligkeit
    dedup_key    text,                                 -- Coalescing (s. u.)
    locked_at    timestamptz,                          -- seit wann 'running'
    locked_by    text,                                 -- Worker-Instanz (Debug)
    last_error   text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- Claim-Pfad: nur fällige queued-Jobs, älteste zuerst (partiell = schlank).
create index if not exists jobs_claim_idx
    on public.jobs (run_after)
    where status = 'queued';

-- Coalescing: höchstens EIN offener Job je dedup_key. Verhindert, dass mehrfaches
-- Speichern desselben Objekts (oder N Worker-Instanzen beim Zeit-Tick) N Jobs
-- erzeugen. Greift nur für offene Zustände (queued|running) → erledigte Jobs
-- blockieren keinen neuen.
create unique index if not exists jobs_dedup_open_uq
    on public.jobs (dedup_key)
    where dedup_key is not null and status in ('queued', 'running');

create index if not exists jobs_tenant_idx on public.jobs (tenant_id, status);

-- updated_at automatisch pflegen (Konvention wie die Geschwister-Tabellen).
drop trigger if exists trg_jobs_updated on public.jobs;
create trigger trg_jobs_updated
    before update on public.jobs
    for each row execute function public.set_updated_at();

-- RLS: default-deny wie 0084. tenant_id kann NULL sein (globale Jobs) und
-- Enqueue/Worker laufen über service_role (rolbypassrls) — die Policy ist nur der
-- Backstop gegen anon/authenticated via PostgREST. Kein Realtime-Publication-
-- Eintrag (interne Tabelle, kein UI-Abo).
alter table public.jobs enable row level security;
drop policy if exists jobs_tenant on public.jobs;
create policy jobs_tenant on public.jobs for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Atomarer Claim mehrerer fälliger Jobs: markiert sie 'running', erhöht attempts,
-- setzt locked_at/locked_by und gibt die Zeilen zurück. FOR UPDATE SKIP LOCKED
-- macht mehrere gleichzeitige Worker-Instanzen race-frei (jeder greift disjunkte
-- Jobs). p_limit = freie Concurrency-Slots des aufrufenden Workers.
create or replace function public.claim_jobs(p_limit integer, p_worker text)
    returns setof public.jobs
    language sql
as $$
    update public.jobs j
       set status     = 'running',
           locked_at  = now(),
           locked_by  = p_worker,
           attempts   = j.attempts + 1,
           updated_at = now()
     where j.id in (
         select id
           from public.jobs
          where status = 'queued'
            and run_after <= now()
          order by run_after
          for update skip locked
          limit p_limit
     )
    returning j.*;
$$;

-- Stuck-Job-Reaper: Jobs eines abgestürzten Workers (locked_at zu alt) zurück auf
-- queued. attempts wurde beim Claim schon erhöht → Retry-Budget bleibt korrekt.
create or replace function public.requeue_stuck_jobs(p_older_than_seconds integer)
    returns integer
    language sql
as $$
    with reaped as (
        update public.jobs
           set status = 'queued', locked_at = null, locked_by = null,
               updated_at = now()
         where status = 'running'
           and locked_at < now() - make_interval(secs => p_older_than_seconds)
        returning 1
    )
    select count(*)::integer from reaped;
$$;
