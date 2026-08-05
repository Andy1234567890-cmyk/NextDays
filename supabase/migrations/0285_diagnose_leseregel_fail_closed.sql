-- Leseregel der zwei Diagnose-Tabellen fail-CLOSED machen (Wurzel 6).
--
-- Bisher stand in beiden Policies:
--   COALESCE(current_user_role(), 'admin') <> all (array['owner','staff','cleaner'])
--
-- `current_user_role()` liest die Rolle aus `app_metadata.role` im JWT und gibt
-- NULL zurück, wenn der Claim fehlt oder leer ist. Das COALESCE machte aus
-- „Rolle unbekannt" ein „ist admin" — also genau die fail-OPEN-Richtung, die
-- Wurzel 6 verbietet: ein Token ohne (oder mit weggelassenem) app_metadata.role
-- durfte die Diagnose-Ereignisse des eigenen Mandanten lesen. Darin stehen
-- Roh-Payloads der Portale: Gastnamen, Preise und bei den Airbnb-Anfragen aus
-- 0284 zusätzlich Nachrichtentexte.
--
-- Der Mandanten-Filter griff weiterhin, es war also keine mandantenübergreifende
-- Lücke — aber innerhalb des Betriebs entschied die Abwesenheit eines Claims
-- über Finanz-/Gastdaten-Einblick. Neu: nur explizit als admin/co_admin
-- ausgewiesene Rollen lesen; alles andere (inkl. NULL) fällt zu.
--
-- Der Server ist davon unberührt: `service_role` hat `rolbypassrls`, der
-- FastAPI-/Worker-Pfad hängt nicht an diesen Policies.

drop policy if exists channex_webhook_event_read on public.channex_webhook_event;
create policy channex_webhook_event_read
  on public.channex_webhook_event
  for select
  using (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('admin', 'co_admin')
  );

drop policy if exists channex_debug_log_read on public.channex_debug_log;
create policy channex_debug_log_read
  on public.channex_debug_log
  for select
  using (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('admin', 'co_admin')
  );
