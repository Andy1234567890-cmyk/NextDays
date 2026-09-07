-- 0596 — CRM (Lastenheft §2.6): Lesen für admin/co_admin, Schreiben nur Server,
--        Realtime für leads / partners / deals.
--
-- AUSGANGSLAGE (nachgelesen in 0013, 0015, 0224, 0337):
--   * 0013 legte `leads`, `partners`, `deals` an, 0015 die permissiven
--     tenant-Policies (`leads_tenant`, `partners_tenant`, `deals_via_partner`).
--   * 0224 entzog INSERT/UPDATE/DELETE und setzte restriktive tenant-Guards
--     (`leads_write_restrict`, `partners_write_restrict`).
--   * 0337 entzog zusätzlich SELECT auf allen drei Tabellen und setzte
--     `deals_tenant_restrict`. Seitdem kann `authenticated` weder lesen noch
--     schreiben — der CRM-Slice hatte bis heute nur `/health`, also fiel es
--     nicht auf.
--
-- ZIEL (Wurzel 6): Lesen per RLS tenant-weit, aber NUR für admin/co_admin.
-- staff/cleaner/owner/shift_lead sehen NICHTS — Leads sind Vertriebsdaten mit
-- Personenbezug (Name, Adresse, Telefon), Deals tragen Rabattcodes. Schreiben
-- bleibt ausschließlich beim Server (service_role): der Status-Workflow, die
-- Konvertierung zum Eigentümer und die Rabattcode-Eindeutigkeit werden im
-- CrmService erzwungen; ein Direktschreiber per anon-Key würde all das umgehen.
--
-- WARUM DREI TEILE (Muster 0539): `grant select` allein öffnet die Tabelle
-- tenant-weit über die permissive Policy aus 0015 — auch für die
-- Reinigungskraft. Erst die RESTRIKTIVE Rollen-Policy (UND-verknüpft) engt das
-- auf admin/co_admin ein. `with check (false)` hält den Schreibpfad auch dann
-- geschlossen, wenn jemand später versehentlich ein Schreib-GRANT setzt.
--
-- PRÜFFRAGE (CLAUDE.md, Wurzel 6): Was kann ein eingeloggter cleaner mit dem
-- anon-Key per `curl /rest/v1/leads`? SELECT → 0 Zeilen (Rollen-Guard).
-- INSERT/UPDATE/DELETE → 42501 (kein GRANT). Genau das ist gewollt.
--
-- `lead_notes` entsteht erst in 0597 und trägt dort dieselben drei Teile
-- selbst — auf eine Tabelle, die es noch nicht gibt, lässt sich hier kein
-- GRANT setzen.

-- 1. Nur LESEN. Kein insert/update/delete — Schreiben bleibt service_role.
grant select on public.leads to authenticated;
grant select on public.partners to authenticated;
grant select on public.deals to authenticated;

-- 2. Restriktive Rollen-Policies. `current_user_role()` (0058) liest die Rolle
--    aus dem JWT; fehlt sie, ist das Ergebnis NULL und `in (...)` falsch —
--    fail-closed. `for all` statt `for select`, damit auch der Schreibpfad
--    gedeckt ist (Wurzel 6: „NICHT nur for select").
drop policy if exists leads_read_admin_only on public.leads;
create policy leads_read_admin_only on public.leads
    as restrictive for all
    using (public.current_user_role() in ('admin', 'co_admin'))
    with check (false);

drop policy if exists partners_read_admin_only on public.partners;
create policy partners_read_admin_only on public.partners
    as restrictive for all
    using (public.current_user_role() in ('admin', 'co_admin'))
    with check (false);

drop policy if exists deals_read_admin_only on public.deals;
create policy deals_read_admin_only on public.deals
    as restrictive for all
    using (public.current_user_role() in ('admin', 'co_admin'))
    with check (false);

comment on policy leads_read_admin_only on public.leads is
    'CRM (0596): Leads sind Vertriebsdaten mit Personenbezug — nur admin/co_admin lesen, '
    'Schreiben ausschließlich über die API (service_role).';
comment on policy partners_read_admin_only on public.partners is
    'CRM (0596): Partner-Kontaktdaten — nur admin/co_admin lesen, Schreiben nur Server.';
comment on policy deals_read_admin_only on public.deals is
    'CRM (0596): Rabattkonditionen und Codes — nur admin/co_admin lesen, Schreiben nur Server.';

-- 3. Realtime-Publikation. Ohne Mitgliedschaft ist jedes Abo der Oberfläche
--    eine stumme Attrappe (sieht live aus, aktualisiert nie). Idempotent.
do $$
declare
    t text;
begin
    foreach t in array array['leads', 'partners', 'deals'] loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
        ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end $$;
