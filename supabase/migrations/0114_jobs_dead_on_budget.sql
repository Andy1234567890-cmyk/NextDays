-- 0114: Hart-crashende Jobs erreichen 'dead' statt endlos zu loopen.
--
-- Bislang war der EINZIGE Weg auf 'dead' der Python-Pfad _retry (worker.py), der
-- nur bei einer FANGBAREN Exception läuft. Stirbt der Worker-PROZESS mitten im
-- Job (OOM-Kill, Segfault einer C-Extension, harter Hänger), läuft _retry nie:
--   * requeue_stuck_jobs setzte die 'running'-Zeile bedingungslos zurück auf
--     'queued' (ohne attempts gegen max_attempts zu prüfen),
--   * claim_jobs filterte nur status='queued' (kein attempts<max_attempts-Guard).
-- Ergebnis: ein Job, dessen Ausführung den Worker zuverlässig hart tötet, wird
-- endlos requeued+neu geclaimt (attempts++ pro Runde), blockiert einen der 4 Slots
-- und erreicht nie 'dead'. Diese Migration schließt beide Lücken idempotent.

-- Reaper: ein hart-gecrashter running-Job, dessen Retry-Budget bereits erschöpft
-- ist (attempts >= max_attempts), geht auf 'dead' (mit Klartext-Fehler); nur die
-- übrigen gehen zurück auf 'queued'. attempts wurde beim Claim schon erhöht.
create or replace function public.requeue_stuck_jobs(p_older_than_seconds integer)
    returns integer
    language sql
as $$
    with stuck as (
        select id
          from public.jobs
         where status = 'running'
           and locked_at < now() - make_interval(secs => p_older_than_seconds)
    ),
    dead as (
        update public.jobs j
           set status = 'dead', locked_at = null, locked_by = null,
               last_error = 'Worker-Prozess während der Ausführung abgestürzt '
                            || '(Retry-Budget erschöpft)',
               updated_at = now()
          from stuck
         where j.id = stuck.id
           and j.attempts >= j.max_attempts
        returning 1
    ),
    reaped as (
        update public.jobs j
           set status = 'queued', locked_at = null, locked_by = null,
               updated_at = now()
          from stuck
         where j.id = stuck.id
           and j.attempts < j.max_attempts
        returning 1
    )
    -- Beide Zweige zählen als „behandelt" (Rückgabe = Anzahl aufgeräumter Jobs).
    select (select count(*) from dead)::integer
         + (select count(*) from reaped)::integer;
$$;

-- Claim: einen Job mit erschöpftem Budget NICHT mehr claimen (Backstop, falls der
-- Reaper ihn noch nicht auf 'dead' gesetzt hat) — sonst würde ein hart-crashender
-- Job zwischen zwei Reaper-Ticks weiter geclaimt und liefe erneut.
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
            and attempts < max_attempts
          order by run_after
          for update skip locked
          limit p_limit
     )
    returning j.*;
$$;

-- CREATE OR REPLACE behält bei gleicher Signatur die Grants aus 0106 bei; zur
-- Sicherheit (und als Doku) die Absperrung gegen anon/authenticated wiederholen —
-- idempotent, nur service_role darf die Worker-RPCs ausführen.
revoke all on function public.claim_jobs(integer, text) from public, anon, authenticated;
grant execute on function public.claim_jobs(integer, text) to service_role;
revoke all on function public.requeue_stuck_jobs(integer) from public, anon, authenticated;
grant execute on function public.requeue_stuck_jobs(integer) to service_role;
