-- Realtime für die Freigabe-Übersicht (Ergänzung zu 0210).
--
-- BEFUND: support_debug_sessions fehlte in der Realtime-Publication. Erteilt
-- ein Kunde eine Freigabe, erschien sie in der Backoffice-Arbeitsliste erst
-- nach manuellem Neuladen — genau in dem Moment, in dem der Support auf sie
-- wartet.
--
-- Zusätzlich fehlte dem Backoffice die Lesepolicy: es gab nur
-- support_debug_sessions_self_read (der Kunde sieht seine eigenen). Über den
-- DB-Direktpfad bekam ein Backoffice-Nutzer daher null Zeilen, das Abo wäre
-- wirkungslos geblieben.
--
-- Umfang bewusst eng: NUR SELECT, und nur für aktive Backoffice-Nutzer. Wer
-- eine Freigabe erteilt oder widerruft, bleibt allein der Kunde — geschrieben
-- wird ausschließlich vom Server (service_role) über /diagnostics/debug.
-- Die Zeile selbst enthält keine Verhaltensdaten, sondern nur den Rahmen der
-- Einwilligung (wer, ab wann, bis wann); die Ereignisse dahinter schützt
-- weiterhin die Freigabe-Bedingung aus 0210.

create policy support_debug_sessions_backoffice_read
    on public.support_debug_sessions
    for select
    using (public.is_platform_admin());

alter publication supabase_realtime add table public.support_debug_sessions;
