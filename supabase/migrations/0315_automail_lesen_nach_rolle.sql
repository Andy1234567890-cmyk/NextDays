-- 0315 — Automail-Texte nur für die Rollen, die sie führen (Wurzel 6/9).
--
-- Ausgangslage: message_automation, message_template, automation_scheduled_message
-- und inbox_scheduled_message tragen seit 0224 einen Schreib-Entzug (kein
-- INSERT/UPDATE/DELETE für anon/authenticated) — der Schreibpfad ist dicht.
-- Das SELECT-Grant blieb aber pauschal, mit nur einer Mandanten-Policy davor.
--
-- Folge: ein eingeloggter cleaner oder owner kann mit dem öffentlichen anon-Key
-- per `curl /rest/v1/automation_scheduled_message` den KOMPLETTEN Nachrichten-
-- bestand seines Betriebs lesen — jeden Automail-Text samt allem, was die
-- Vorlagen enthalten (Anreiseanweisungen, Schlüsselboxen, Türcodes), und jede
-- geplante Nachricht. Der FastAPI-Layer erzwingt für dieselben Daten den
-- assigned-Scope; der Direktpfad umgeht ihn komplett (Wurzel 6). §4.3: staff
-- und cleaner haben keinen Vertriebs-/Gasteinblick, §4.2: owner ist read-only
-- auf seine Objekte und führt keine Nachrichtenregeln.
--
-- Deshalb: restriktive SELECT-Policy auf die vier Tabellen. Restriktiv heißt,
-- sie gilt ZUSÄTZLICH zur bestehenden Mandanten-Policy — beide müssen zutreffen.
-- Das SELECT-Grant selbst bleibt, sonst stirbt Realtime (`message_automation`
-- und `inbox_scheduled_message` werden im Posteingang abonniert); die Policy
-- entscheidet dann zeilenweise, wer wirklich etwas sieht.
--
-- current_db_role() liest die Rolle aus users.role (nicht aus dem JWT), damit
-- ein Rollenentzug sofort greift (Wurzel 7, eingeführt in 0194). Sie ist
-- fail-closed: unbekannte/fehlende Rolle → kein Treffer → kein Zugriff.

-- Nachrichtenregeln und Vorlagen führt die Betriebsleitung.
create policy message_automation_read_restrict on public.message_automation
    as restrictive for select
    using (public.current_db_role() in ('admin', 'co_admin'));

create policy message_template_read_restrict on public.message_template
    as restrictive for select
    using (public.current_db_role() in ('admin', 'co_admin'));

-- Geplante Automails tragen den fertig gerenderten Text an den Gast.
create policy automation_scheduled_read_restrict on public.automation_scheduled_message
    as restrictive for select
    using (public.current_db_role() in ('admin', 'co_admin'));

-- Manuell geplante Nachrichten: staff darf sie im Posteingang sehen — er
-- schreibt sie selbst. cleaner und owner nicht (§4.2/§4.3).
create policy inbox_scheduled_read_restrict on public.inbox_scheduled_message
    as restrictive for select
    using (public.current_db_role() in ('admin', 'co_admin', 'staff'));

comment on policy message_automation_read_restrict on public.message_automation is
    'Wurzel 6: der REST-Direktpfad umgeht den FastAPI-Scope. Nachrichtenregeln '
    'sieht nur die Betriebsleitung, nicht owner/staff/cleaner.';
comment on policy automation_scheduled_read_restrict on public.automation_scheduled_message is
    'Wurzel 6: enthaelt den fertigen Gasttext inkl. Zugangsdaten aus der Vorlage.';
