-- Realtime für den Support-Bereich.
--
-- AUSGANGSLAGE (0204): support_tickets/support_messages waren komplett dicht —
-- kein Grant an anon/authenticated, Deny-all-Policy. Das ist für den
-- Schreibpfad richtig und bleibt so. Aber Realtime (Supabase WebSocket) läuft
-- über genau diese Rollen: ohne SELECT-Grant und ohne permissive Read-Policy
-- empfängt der Client 0 Events, und die UI aktualisiert sich nie.
--
-- Vorbild ist public.guest_messages: dort ist exakt SELECT (kein INSERT/UPDATE/
-- DELETE) an anon+authenticated vergeben, plus eine permissive Read-Policy, die
-- den Scope erzwingt. Geschrieben wird weiterhin ausschließlich serverseitig
-- über den FastAPI-Slice mit service_role.
--
-- WICHTIG — die Lesesicht ist ENGER als die des Servers:
--   • Ein Melder sieht nur seine EIGENEN Tickets (reporter_user_id/-guest_id).
--   • Ein Betriebs-Nutzer sieht zusätzlich Tickets SEINES Tenants (er meldet
--     im Namen des Betriebs; Kollegen dürfen den Vorgang sehen).
--   • INTERNE NOTIZEN (support_messages.internal = true) sind hier HART
--     ausgeschlossen. Das ist der kritische Punkt: der Melder-Endpunkt filtert
--     sie bereits, aber über den DB-Direktpfad wären sie ohne diese Bedingung
--     lesbar — genau die Lücke, die Wurzel 6 meint.
--   • Das Betreiber-Team liest NICHT über diesen Pfad, sondern über den
--     platform_admin-Slice mit service_role. Für sie ändert sich nichts.

-- --- Deny-all ersetzen -------------------------------------------------------
-- Die restriktive Deny-all-Policy aus 0204 würde jede permissive Policy
-- überstimmen (restriktiv + permissiv = UND). Sie muss weichen; die Absicherung
-- übernehmen ab jetzt der eng gefasste Grant (nur SELECT) und die Read-Policies.
drop policy if exists support_tickets_deny_all on public.support_tickets;
drop policy if exists support_messages_deny_all on public.support_messages;

-- --- Lesendes Grant (NUR SELECT) --------------------------------------------
-- Bewusst kein INSERT/UPDATE/DELETE: ein Client darf nie direkt schreiben,
-- sonst umginge er die Prüfungen des Service (Scope, Länge, author_kind).
grant select on public.support_tickets to anon, authenticated;
grant select on public.support_messages to anon, authenticated;

-- --- Read-Policies -----------------------------------------------------------

-- Tickets: eigene (beide Melder-Welten) oder solche des eigenen Betriebs.
create policy support_tickets_read on public.support_tickets
    as permissive for select
    using (
        reporter_user_id = auth.uid()
        or reporter_guest_id = auth.uid()
        or (
            tenant_id is not null
            and tenant_id = public.current_tenant_id()
        )
    );

-- Nachrichten: nur zu sichtbaren Tickets UND niemals interne Notizen.
-- Die internal-Bedingung steht bewusst als ERSTE Zeile — sie ist der Grund,
-- warum diese Policy existiert.
create policy support_messages_read on public.support_messages
    as permissive for select
    using (
        internal = false
        and exists (
            select 1
            from public.support_tickets t
            where t.id = support_messages.ticket_id
              and (
                  t.reporter_user_id = auth.uid()
                  or t.reporter_guest_id = auth.uid()
                  or (
                      t.tenant_id is not null
                      and t.tenant_id = public.current_tenant_id()
                  )
              )
        )
    );

-- --- Realtime-Publikation ----------------------------------------------------
-- Ohne Eintrag hier sendet Postgres keine Änderungen an Realtime.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'support_tickets'
    ) then
        alter publication supabase_realtime add table public.support_tickets;
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'support_messages'
    ) then
        alter publication supabase_realtime add table public.support_messages;
    end if;
end $$;
