-- 0106_jobs_rpc_grants.sql — Worker-RPCs gegen anon/authenticated absperren
--
-- claim_jobs und requeue_stuck_jobs (0102) wurden ohne revoke/grant angelegt →
-- Postgres-Default gibt EXECUTE an PUBLIC (inkl. anon + authenticated via
-- PostgREST /rest/v1/rpc/…). Beide Funktionen mutieren die Queue (claim flippt
-- auf 'running' + erhöht attempts; requeue setzt zurück): ein eingeloggter
-- Tenant-Nutzer konnte so die Hintergrund-Verarbeitung seines Tenants
-- sabotieren (Jobs kippen nach max_attempts auf 'dead', ohne je zu laufen).
-- enqueue_job (0103) war korrekt abgesperrt — hier dieselbe Absperrung.

revoke all on function public.claim_jobs(integer, text) from public;
revoke all on function public.claim_jobs(integer, text) from anon;
revoke all on function public.claim_jobs(integer, text) from authenticated;
grant execute on function public.claim_jobs(integer, text) to service_role;

revoke all on function public.requeue_stuck_jobs(integer) from public;
revoke all on function public.requeue_stuck_jobs(integer) from anon;
revoke all on function public.requeue_stuck_jobs(integer) from authenticated;
grant execute on function public.requeue_stuck_jobs(integer) to service_role;
