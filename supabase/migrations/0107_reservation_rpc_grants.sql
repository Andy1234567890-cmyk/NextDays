-- 0107_reservation_rpc_grants.sql — Backend-RPCs gegen anon/authenticated
-- absperren (Nachzug zu 0104/0105/0103).
--
-- Befund (live nach 0104–0106 verifiziert, has_function_privilege):
--   next_document_number    → SECURITY DEFINER, anon=X, authenticated=X  (!!)
--   create_reservation_atomic → anon/authenticated=X
--   enqueue_job             → authenticated=X
-- Ursache: In Supabase erhalten anon/authenticated EXECUTE häufig als DIREKTES
-- Grant (nicht über PUBLIC). Das `revoke ... from public` in 0025/0103/0104
-- entfernt das NICHT — nur ein explizites `revoke from anon/authenticated`
-- wirkt (bewiesen an claim_jobs/requeue_stuck_jobs aus 0106, die korrekt
-- gesperrt sind).
--
-- Risiko:
--  * next_document_number ist SECURITY DEFINER → läuft mit Owner-Rechten und
--    umgeht RLS komplett. Über PostgREST könnte JEDER (inkl. anon) fremde
--    Nummernkreise hochzählen/erschöpfen (GoBD-Sabotage, Lücken/Dubletten).
--  * create_reservation_atomic umgeht die komplette Service-Schicht
--    (Preis-Resolver, Gast-Anlage, Masking, Owner-Scope).
--  * enqueue_job erlaubt beliebiges Einreihen von Hintergrund-Jobs.
-- Alle drei gehören ausschließlich dem Backend (service_role).

-- next_document_number(uuid, text, text)
revoke all on function public.next_document_number(uuid, text, text) from public;
revoke all on function public.next_document_number(uuid, text, text) from anon;
revoke all on function public.next_document_number(uuid, text, text) from authenticated;
grant execute on function public.next_document_number(uuid, text, text) to service_role;

-- create_reservation_atomic(jsonb, availability_source, boolean)
revoke all on function
  public.create_reservation_atomic(jsonb, public.availability_source, boolean) from public;
revoke all on function
  public.create_reservation_atomic(jsonb, public.availability_source, boolean) from anon;
revoke all on function
  public.create_reservation_atomic(jsonb, public.availability_source, boolean) from authenticated;
grant execute on function
  public.create_reservation_atomic(jsonb, public.availability_source, boolean) to service_role;

-- enqueue_job(text, jsonb, uuid, text, integer, timestamptz)
revoke all on function
  public.enqueue_job(text, jsonb, uuid, text, integer, timestamptz) from public;
revoke all on function
  public.enqueue_job(text, jsonb, uuid, text, integer, timestamptz) from anon;
revoke all on function
  public.enqueue_job(text, jsonb, uuid, text, integer, timestamptz) from authenticated;
grant execute on function
  public.enqueue_job(text, jsonb, uuid, text, integer, timestamptz) to service_role;
