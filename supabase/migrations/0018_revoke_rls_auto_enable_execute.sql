-- 0018_revoke_rls_auto_enable_execute.sql — Advisor-Fix
--
-- public.rls_auto_enable() ist eine Event-Trigger-Funktion (ensure_rls), die nach
-- jedem CREATE TABLE automatisch RLS aktiviert — ein sinnvoller Schutz. Sie ist
-- SECURITY DEFINER und war zusätzlich per REST-RPC für anon/authenticated
-- aufrufbar (Supabase-Advisor: anon/authenticated_security_definer_function_executable).
--
-- Als Event-Trigger-Funktion soll sie NICHT von außen aufrufbar sein. Wir entziehen
-- daher das EXECUTE-Recht für public/anon/authenticated. Der Event-Trigger läuft
-- davon unberührt weiter (Trigger nutzen die Funktion intern, nicht über EXECUTE-Grants).

-- Defensiv: die Event-Trigger-Funktion wird nicht von jeder Umgebung erzeugt
-- (sie stammt aus dem Supabase-Advisor-Setup). Existiert sie nicht, sind die
-- REVOKEs ohnehin gegenstandslos – daher in einen bedingten Block kapseln,
-- damit frische DBs nicht abbrechen.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public;
    revoke execute on function public.rls_auto_enable() from anon;
    revoke execute on function public.rls_auto_enable() from authenticated;
  end if;
end $$;
