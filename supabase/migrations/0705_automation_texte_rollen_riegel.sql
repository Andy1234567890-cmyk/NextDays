-- =========================================================================
-- 0705 — Sprachfassungen der Nachrichten nur für die Betriebsleitung (Wurzel 6)
--        + zwei tote Realtime-Attrappen aus der Publikation nehmen
-- =========================================================================
-- BEFUND (14.09.2026, Bug-Jagd „Automail-Thread / Versandweg"):
--
-- (a) 0315 hat die Nachrichten-Tabellen gegen den REST-Direktpfad rollenmäßig
--     geschlossen: `message_automation`, `message_template`,
--     `automation_scheduled_message` und `inbox_scheduled_message` tragen dort
--     je eine restriktive Rollen-Policy über `current_db_role()`.
--     Die Sprachfassungen aus 0363 (`message_automation_text`,
--     `message_template_text`) kamen SPÄTER und bekamen diesen Riegel nie.
--     Sie haben nur eine MANDANTEN-Policy (permissiv + restriktiv) — der
--     Mandant ist damit dicht, die ROLLE nicht.
--
--     Der Inhalt ist derselbe wie in den Tabellen von 0315, nur je Sprache:
--     Anreiseanweisungen, Schlüsselboxen, Türcodes, WLAN-Passwörter,
--     Zahlungsaufforderungen. Ein eingeloggter cleaner oder owner desselben
--     Betriebs las sie über `curl /rest/v1/message_automation_text` komplett —
--     obwohl ihm die Grundfassung derselben Regel (0315) verwehrt ist. Der
--     Riegel war also nicht falsch, nur unvollständig: die zweite Ablage
--     desselben Textes stand offen. §4.2 (owner read-only, keine
--     Nachrichtenregeln), §4.3 (staff/cleaner kein Vertriebs-/Gasteinblick).
--
--     Anders als 0315 ist der Riegel hier `as restrictive FOR ALL`, nicht
--     `for select`: das Tabellen-GRANT ist in 0363 vollständig entzogen, der
--     Schreibpfad läuft also ohnehin nur über service_role — aber ein späteres
--     `grant` (Realtime-Wunsch, Aufräum-Migration) würde bei einer reinen
--     SELECT-Policy den SCHREIB-Pfad tenant-weit öffnen. `for all` beschreibt
--     den Endzustand und überlebt so ein versehentliches Grant.
--
-- (b) `message_automation` und `automation_scheduled_message` stehen seit 0072
--     in der Publikation `supabase_realtime`. 0337 hat ihnen das SELECT-GRANT
--     für anon/authenticated entzogen; seitdem kann kein Client sie mehr
--     abonnieren. Die beiden Frontend-Abos wurden entsprechend entfernt
--     (`web/components/inbox/automations-tab.tsx`,
--     `automatisieren-panel.tsx` — beide tragen den Grund im Kommentar).
--     Übrig blieb die Publikationsmitgliedschaft: der WAL-Decoder schleppt
--     jede Änderung an beiden Tabellen weiter, obwohl niemand zuhört. Eine
--     Neuplanung schreibt pro Buchung eine Zeile in
--     `automation_scheduled_message` — das ist die lauteste Tabelle des
--     Slices. Sie kostet Decoder-Arbeit für nichts und ist zugleich eine
--     Einladung: wer später ein Grant setzt, hat sofort ein offenes Abo auf
--     dem fertig gerenderten Gasttext.
--
-- Idempotent: alle Policies mit `drop policy if exists` davor, die
-- Publikations-Änderung in einem DO-Block, der `pg_publication_tables` prüft.


-- -------------------------------------------------------------------------
-- (a) Rollen-Riegel auf den Sprachfassungen — Muster exakt wie 0315.
--     `current_db_role()` liest die Rolle aus `users.role` (nicht aus dem JWT,
--     Wurzel 7) und ist fail-closed: unbekannte/fehlende Rolle → kein Treffer.
-- -------------------------------------------------------------------------
drop policy if exists message_automation_text_rollen
    on public.message_automation_text;
create policy message_automation_text_rollen on public.message_automation_text
    as restrictive for all
    using (public.current_db_role() in ('admin', 'co_admin'))
    with check (public.current_db_role() in ('admin', 'co_admin'));

drop policy if exists message_template_text_rollen
    on public.message_template_text;
create policy message_template_text_rollen on public.message_template_text
    as restrictive for all
    using (public.current_db_role() in ('admin', 'co_admin'))
    with check (public.current_db_role() in ('admin', 'co_admin'));

comment on policy message_automation_text_rollen on public.message_automation_text is
    'Wurzel 6 (0705): dieselbe Rollen-Schranke wie 0315 auf der Grundfassung. '
    'Die Sprachfassung traegt denselben Gasttext inkl. Tuercode/WLAN — ohne '
    'diesen Riegel war sie ueber den REST-Direktpfad fuer owner/staff/cleaner '
    'lesbar, die Grundfassung aber nicht.';
comment on policy message_template_text_rollen on public.message_template_text is
    'Wurzel 6 (0705): Rollen-Schranke analog 0315 auf message_template.';


-- -------------------------------------------------------------------------
-- (b) Tote Publikationsmitgliedschaften entfernen (0072 → 0337).
--     `alter publication ... drop table` kennt kein `if exists`; deshalb
--     erst nachsehen, ob die Tabelle ueberhaupt drinsteht. So laeuft die
--     Migration auf einer frischen DB und auf der Live-DB gleich durch.
-- -------------------------------------------------------------------------
do $$
declare
    t text;
begin
    foreach t in array array['message_automation', 'automation_scheduled_message']
    loop
        if exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = t
        ) then
            execute format(
                'alter publication supabase_realtime drop table public.%I', t
            );
        end if;
    end loop;
end
$$;
