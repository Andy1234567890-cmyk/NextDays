-- 0116: requeue_stuck_jobs dedup-sicher machen.
--
-- Lücke: requeue_stuck_jobs (0114) setzt einen stuck running-Job bedingungslos
-- zurück auf 'queued'. Der partielle Unique-Index jobs_dedup_queued_uq (0108:
-- dedup_key WHERE status='queued') erlaubt aber, dass während ein Job mit
-- dedup_key K 'running' war, ein neuer enqueue_job(K) eine ZWEITE 'queued'-Zeile
-- anlegt (genau das Ziel von 0108). Wird der stuck Job danach auf 'queued'
-- gesetzt, existieren zwei 'queued'-Zeilen mit demselben dedup_key → 23505; der
-- gesamte requeue-CTE bricht ab und der Reaper macht keinen Fortschritt mehr.
--
-- Fix: Ein stuck Job, für dessen dedup_key bereits eine ANDERE 'queued'-Zeile
-- existiert, wird auf 'done' (übersprungen) gesetzt statt requeued — der bereits
-- eingereihte Zwilling erledigt die Arbeit (idempotente Handler). Nur Jobs OHNE
-- Zwilling (oder ohne dedup_key) werden regulär requeued. Idempotent (replace).

create or replace function public.requeue_stuck_jobs(p_older_than_seconds integer)
    returns integer
    language sql
as $$
    with stuck as (
        select id, dedup_key, attempts, max_attempts
          from public.jobs
         where status = 'running'
           and locked_at < now() - make_interval(secs => p_older_than_seconds)
    ),
    -- Budget erschöpft → 'dead' (mit Klartext-Fehler).
    dead as (
        update public.jobs j
           set status = 'dead', locked_at = null, locked_by = null,
               last_error = 'Worker-Prozess während der Ausführung abgestürzt '
                            || '(Retry-Budget erschöpft)',
               updated_at = now()
          from stuck
         where j.id = stuck.id
           and stuck.attempts >= stuck.max_attempts
        returning 1
    ),
    -- dedup-Zwilling bereits eingereiht → diesen Job als übersprungen abschließen
    -- (kein Requeue → keine 23505-Kollision; der Zwilling arbeitet ihn ab).
    superseded as (
        update public.jobs j
           set status = 'done', locked_at = null, locked_by = null,
               last_error = 'übersprungen — bereits neu eingereiht (dedup_key)',
               updated_at = now()
          from stuck
         where j.id = stuck.id
           and stuck.attempts < stuck.max_attempts
           and stuck.dedup_key is not null
           and exists (
               select 1 from public.jobs q
                where q.dedup_key = stuck.dedup_key
                  and q.status = 'queued'
                  and q.id <> stuck.id
           )
        returning 1
    ),
    -- Rest (kein Budget-Aus, kein Zwilling) → regulär auf 'queued'.
    reaped as (
        update public.jobs j
           set status = 'queued', locked_at = null, locked_by = null,
               updated_at = now()
          from stuck
         where j.id = stuck.id
           and stuck.attempts < stuck.max_attempts
           and (
               stuck.dedup_key is null
               or not exists (
                   select 1 from public.jobs q
                    where q.dedup_key = stuck.dedup_key
                      and q.status = 'queued'
                      and q.id <> stuck.id
               )
           )
        returning 1
    )
    select (select count(*) from dead)::integer
         + (select count(*) from superseded)::integer
         + (select count(*) from reaped)::integer;
$$;

-- Grants unverändert beibehalten (CREATE OR REPLACE lässt sie bei gleicher
-- Signatur bestehen; zur Sicherheit wiederholt, idempotent).
revoke all on function public.requeue_stuck_jobs(integer) from public, anon, authenticated;
grant execute on function public.requeue_stuck_jobs(integer) to service_role;

-- defer_count: Zähler für Budget-bedingte Verzögerungen (ChannexBudgetExhausted).
-- _defer verbraucht bewusst KEIN attempts (Warten ist kein Fehlversuch) — dadurch
-- erreicht ein Job bei DAUERHAFT totem Redis (Budget liefert nie ein Token) NIE
-- 'dead' und läuft in einen Endlos-Defer-Livelock. Der Worker deckelt daher die
-- Defers separat über diese Spalte und gibt nach einem Maximum auf ('dead').
alter table public.jobs add column if not exists defer_count integer not null default 0;
