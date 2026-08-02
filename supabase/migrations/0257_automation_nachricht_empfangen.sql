-- 0257_automation_nachricht_empfangen.sql — Auslöser „Nachricht empfangen"
--
-- Bislang kannte message_automation nur drei Auslöser, alle an einem Datum der
-- Reservierung hängend (booking_new / before_checkin / after_checkout). Damit
-- ließ sich die häufigste Automation der Branche NICHT bauen: die Abwesenheits-
-- antwort. Sie hängt an keinem Datum, sondern am Eintreffen einer Gastnachricht.
--
-- Neu:
--   trigger = 'message_received'  → feuert beim Eingang einer Gastnachricht,
--                                   Versand sofort (anchor/offset/send_time
--                                   sind für diesen Auslöser bedeutungslos)
--   only_first_message            → nur die ERSTE Gastnachricht des Threads
--   window_days / window_from/to  → Zeitfenster, in dem der Auslöser feuern DARF
--
-- Das Zeitfenster ist bewusst als „darf feuern" formuliert und nicht als
-- „Bürozeiten": für eine Abwesenheitsantwort trägt man dort die GESCHLOSSENEN
-- Zeiten ein. window_from > window_to bedeutet über Mitternacht (22:00–06:00).
--
-- Ein Doppelversand ist bereits durch automation_scheduled_unique
-- (automation_id, thread_id) ausgeschlossen: eine Automation kann je Thread nur
-- einmal einplanen (Wurzel 2). Der Auslöser braucht daher keinen eigenen Guard.

alter table public.message_automation
    add column if not exists only_first_message boolean not null default false,
    add column if not exists window_days smallint[],
    add column if not exists window_from time without time zone,
    add column if not exists window_to time without time zone;

-- Bisher gab es keinen CHECK auf `trigger` — jeder Tippfehler wäre als toter
-- Auslöser durchgegangen (die Automation feuert dann nie, ohne Fehlermeldung).
alter table public.message_automation
    drop constraint if exists message_automation_trigger_chk;

alter table public.message_automation
    add constraint message_automation_trigger_chk
    check (trigger in (
        'booking_new', 'before_checkin', 'after_checkout', 'message_received'
    ));

-- Wochentage nach ISO-Zählung der Oberfläche: 0 = Montag … 6 = Sonntag.
alter table public.message_automation
    drop constraint if exists message_automation_window_days_chk;

alter table public.message_automation
    add constraint message_automation_window_days_chk
    check (
        window_days is null
        or (
            array_length(window_days, 1) <= 7
            and window_days <@ array[0,1,2,3,4,5,6]::smallint[]
        )
    );

-- Ein halb gesetztes Fenster („ab 22:00", ohne Ende) wäre mehrdeutig: es ließe
-- offen, ob bis Mitternacht oder unbegrenzt gemeint ist. Entweder beide oder
-- keins (Wurzel 4 — keine geratene Ergänzung).
alter table public.message_automation
    drop constraint if exists message_automation_window_zeit_chk;

alter table public.message_automation
    add constraint message_automation_window_zeit_chk
    check ((window_from is null) = (window_to is null));

comment on column public.message_automation.only_first_message is
    'Nur message_received: feuert nur, wenn es die erste Gastnachricht im Thread ist.';
comment on column public.message_automation.window_days is
    'Nur message_received: Wochentage, an denen der Auslöser feuern darf (0=Mo..6=So). NULL = alle.';
comment on column public.message_automation.window_from is
    'Nur message_received: Beginn des Zeitfensters. window_from > window_to = über Mitternacht.';
