-- ============================================================================
-- 0415 — Benachrichtigung bei Vertretungsanfragen (Kategorie task_substitution)
-- ----------------------------------------------------------------------------
-- WARUM: Eine Vertretungsanfrage (`task_substitutions`, seit 0019) erreichte
-- niemanden. `request_substitution` schrieb die Zeile und schrieb eine
-- Log-Zeile — es gab weder eine Oberfläche noch eine Meldung. Wer ausfiel,
-- fragte ins Leere; die Aufgabe blieb bei ihm, während er annahm, jemand
-- übernehme sie.
--
-- WARUM EIGENE KATEGORIE und nicht `task_assigned` mitbenutzen: der EMPFÄNGER
-- ist ein anderer. `task_assigned` geht an die EINE zuständige Person; diese
-- hier geht an alle, die einspringen KÖNNTEN (und die Entscheidung zurück an
-- den Anfragenden). Zusammengelegt könnte eine Reinigungskraft die
-- Zuweisungen nur zusammen mit den Anfragen der Kollegen abschalten — dann
-- fehlt entweder die eigene Arbeit oder die Aushilfe.
--
-- WARUM MIT PUSH: hier zählt die Zeit. Jemand fällt heute aus, die Reinigung
-- ist in drei Stunden fällig. Eine Mail, die abends gelesen wird, ist wertlos;
-- die Glocke sieht nur, wer die Anwendung geöffnet hat. Push ist der einzige
-- Kanal, der jemanden erreicht, der gerade unterwegs ist — und er ist
-- abwählbar (anders als die Glocke), wie `betrieb_buchung_push` (0414).
--
-- Default TRUE für alle drei Kanäle: eine offene Vertretung ist der Fall, in
-- dem der Betrieb Hilfe braucht. Wer nicht gestört werden will, schaltet sie
-- in /konto ab.
-- ============================================================================

alter table public.notification_settings
    add column if not exists task_substitution_email boolean not null default true,
    add column if not exists task_substitution_sms boolean not null default false,
    add column if not exists task_substitution_push boolean not null default true;

comment on column public.notification_settings.task_substitution_email is
    'E-Mail bei Vertretungsanfrage/-entscheidung. Abwählbar (keine vertragliche Pflicht).';
comment on column public.notification_settings.task_substitution_sms is
    'SMS bei Vertretungsanfrage. Default AUS — SMS kostet und ist die Ausnahme.';
comment on column public.notification_settings.task_substitution_push is
    'Push bei Vertretungsanfrage. Der Kanal, der jemanden unterwegs erreicht.';
