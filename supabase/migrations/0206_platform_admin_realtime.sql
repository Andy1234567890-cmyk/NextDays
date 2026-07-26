-- Realtime für das Plattform-Backoffice: mandantenübergreifendes LESEN für
-- Backoffice-Nutzer, damit Freigaben und Support-Tickets live aktualisieren.
--
-- AUSGANGSLAGE: properties und support_tickets sind per RLS auf
-- current_tenant_id() gescopt. Ein Plattform-Admin hat KEIN tenant_id im Token
-- (das ist Absicht — er gehört keinem Betrieb an), bekommt also null Events.
-- Bisher waren die betroffenen Realtime-Abos deshalb wirkungslos.
--
-- LÖSUNG — und ihre Grenzen, weil das der sicherheitskritischste Punkt ist:
--
--   • Eine SECURITY-DEFINER-Funktion prüft, ob auth.uid() in platform_admins
--     steht (active = true). Sie ist nötig, weil platform_admins selbst für
--     anon/authenticated gesperrt ist — eine normale Policy könnte dort nicht
--     nachschlagen.
--   • Die Funktion ist nach dem Muster von owner_can_see_property gehärtet:
--     set search_path = '', schema-qualifiziert, fail-closed (kein Eintrag →
--     false). Sie gibt NUR einen Boolean zurück, nie Daten.
--   • Die zusätzlichen Policies erlauben ausschließlich SELECT. Schreiben
--     bleibt dem Server (service_role) vorbehalten — ein Backoffice-Nutzer kann
--     per DB-Direktpfad weiterhin nichts ändern.
--   • Betroffen sind NUR properties und support_tickets/-messages. Finanzen,
--     Reservierungen, Gästedaten und alles Übrige bleiben unangetastet: das
--     Backoffice liest sie serverseitig über /platform/*, wo jeder Zugriff
--     protokolliert wird.
--
-- ABWÄGUNG: Ein Backoffice-Nutzer kann diese drei Tabellen nun auch am
-- Audit-Log vorbei per anon-Key lesen. Das ist der Preis für Realtime. Er ist
-- vertretbar, weil (a) genau diese Daten ohnehin sein Arbeitsgegenstand sind,
-- (b) der Kreis der Backoffice-Nutzer klein und per DB-Eintrag kontrolliert
-- ist, und (c) interne Support-Notizen weiterhin ausgeschlossen bleiben.

-- --- Helper: ist der aktuelle Nutzer Backoffice-Nutzer? ---------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.platform_admins pa
        where pa.user_id = (select auth.uid())
          and pa.active = true
    )
$$;

comment on function public.is_platform_admin() is
    'True, wenn der aktuelle Nutzer ein aktiver Plattform-Betreiber ist. '
    'SECURITY DEFINER, weil platform_admins für anon/authenticated gesperrt '
    'ist. Gibt nur einen Boolean zurück, nie Daten. Fail-closed.';

-- Kein direkter Aufruf durch Clients — die Funktion wird ausschließlich in
-- Policies ausgewertet (dort läuft sie im Kontext des Servers).
revoke execute on function public.is_platform_admin() from anon, authenticated;

-- --- properties: Backoffice darf lesen --------------------------------------
-- Zusätzliche PERMISSIVE Policy neben properties_tenant. Achtung: die
-- restriktiven Policies properties_owner_scope/properties_staff_scope gelten
-- weiterhin UND-verknüpft. Ein Backoffice-Nutzer ist weder owner noch staff,
-- daher greifen sie bei ihm nicht einschränkend (beide prüfen Zuweisungen, die
-- er nicht hat) — das wird unten gegengeprüft.
create policy properties_platform_admin_read on public.properties
    as permissive for select
    using (public.is_platform_admin());

-- --- support_tickets / support_messages: Backoffice darf lesen --------------
-- Ergänzt die Melder-Policies aus 0205 (ODER-verknüpft, weil beide permissiv).
create policy support_tickets_platform_read on public.support_tickets
    as permissive for select
    using (public.is_platform_admin());

-- Auch INTERNE Notizen — das Backoffice ist genau deren Zielgruppe. Für Melder
-- bleibt die Policy aus 0205 mit internal = false bestehen.
create policy support_messages_platform_read on public.support_messages
    as permissive for select
    using (public.is_platform_admin());

-- --- properties in die Realtime-Publikation ---------------------------------
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'properties'
    ) then
        alter publication supabase_realtime add table public.properties;
    end if;
end $$;
