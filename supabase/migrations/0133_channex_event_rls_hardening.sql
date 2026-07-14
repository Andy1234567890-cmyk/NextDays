-- 0133_channex_event_rls_hardening.sql
-- RLS-Verschärfung für channex_webhook_event (0132) und channex_debug_log (0131).
--
-- Befund (Review): die FOR-ALL-Policies waren nur tenant-, nicht rollen-gescopt.
-- anon/authenticated haben projektweit pauschale Grants (RLS ist der einzige
-- Backstop) und beide Tabellen stehen in der supabase_realtime-Publication.
-- Folgen der alten Policies:
--   1) staff/cleaner/owner desselben Tenants konnten die rohen Webhook-/Debug-
--      Payloads (Gast-PII, Beträge, Vertriebsdaten) direkt via PostgREST/
--      Realtime lesen — §4.3-Verstoß (kein Finanz-/Vertriebseinblick).
--   2) FOR ALL erlaubte Clients sogar INSERT/UPDATE/DELETE am API-Gate vorbei
--      (Events fälschen, resolved setzen, Traces löschen).
--
-- Neu:
--   - SELECT nur für privilegierte Rollen (nicht owner/staff/cleaner) im
--     eigenen Tenant — Muster wie 0058 (current_user_role(); fehlender Claim
--     verhält sich wie privilegiert, konsistent zum bestehenden Owner-Scope).
--   - KEINE Client-Schreibrechte: Schreiben macht ausschließlich der Server
--     über die Service-Role (umgeht RLS by design).

-- channex_webhook_event ------------------------------------------------------
drop policy if exists channex_webhook_event_tenant on public.channex_webhook_event;

create policy channex_webhook_event_read on public.channex_webhook_event
    for select
    using (
        tenant_id = public.current_tenant_id()
        and coalesce(public.current_user_role(), 'admin')
            not in ('owner', 'staff', 'cleaner')
    );

-- channex_debug_log (gleiche Wurzel, gleicher Fix) ----------------------------
drop policy if exists channex_debug_log_tenant on public.channex_debug_log;

create policy channex_debug_log_read on public.channex_debug_log
    for select
    using (
        tenant_id = public.current_tenant_id()
        and coalesce(public.current_user_role(), 'admin')
            not in ('owner', 'staff', 'cleaner')
    );
