-- Planmäßige Aufgaben: Tages-Anker + Uhrzeitfenster (Erweiterung von 0272).
--
-- WAS GEFEHLT HAT: die vorhandenen Anker `check_in`/`check_out` hängen an der
-- UHRZEIT der Reservierung (`checkin_time`/`checkout_time`). Für die Praxis
-- „Empfang am Anreisetag von 10:00 bis 14:00" gab es damit keinen Weg: der
-- Versatz kannte nur Minuten relativ zur Gast-Uhrzeit, und die schwankt je
-- Buchung. Zwei neue Anker legen die Aufgabe auf den TAG, die Uhrzeit kommt
-- dann aus der Regel.
--
--   arrival_day    — der Tag der Anreise (Datum aus `check_in`)
--   departure_day  — der Tag der Abreise (Datum aus `check_out`)
--
-- Die Uhrzeit steht in `start_clock`/`end_clock` und gilt AUSSCHLIESSLICH für
-- diese beiden Anker: bei `check_in`/`check_out` bleibt die Uhrzeit der Buchung
-- maßgeblich, sonst hätte dieselbe Aufgabe zwei Wahrheiten.

alter table public.task_rules
    -- Uhrzeitfenster der planmäßigen Regel (nur bei den Tages-Ankern wirksam).
    -- NULL heißt ehrlich „keine Uhrzeit gepflegt" — der Motor setzt dann den
    -- Tagesbeginn und KEINE erfundene Standardstunde (Wurzel 4).
    add column if not exists start_clock time,
    add column if not exists end_clock   time;

-- Ende vor Start ist an der Regel selbst schon unmöglich zu machen; der
-- Service prüft es zusätzlich mit 422. Beides, weil der DB-Direktpfad den
-- Service umgeht (Wurzel 6).
alter table public.task_rules
    drop constraint if exists task_rules_clock_chk;
alter table public.task_rules
    add constraint task_rules_clock_chk
    check (
        start_clock is null
        or end_clock is null
        or end_clock >= start_clock
    );

-- Die Trigger-Listen aus 0272 um die zwei Tages-Anker erweitern. Neu gesetzt
-- statt ergänzt, weil ein CHECK sich nicht erweitern lässt.
alter table public.task_rules
    drop constraint if exists task_rules_start_trigger_chk;
alter table public.task_rules
    add constraint task_rules_start_trigger_chk
    check (start_trigger is null or start_trigger in (
        'booking_confirmed',      -- sofort bei Bestätigung der Buchung
        'check_in',               -- zur Check-in-UHRZEIT der Reservierung
        'after_check_in_24h',     -- Check-in + 24 h, gedeckelt auf den Check-out
        'check_out',              -- zur Check-out-UHRZEIT
        'days_before_check_in',   -- start_offset_minutes vor dem Check-in
        'days_after_check_out',   -- start_offset_minutes nach dem Check-out
        'arrival_day',            -- TAG der Anreise, Uhrzeit aus start_clock
        'departure_day'           -- TAG der Abreise, Uhrzeit aus start_clock
    ));
alter table public.task_rules
    drop constraint if exists task_rules_end_trigger_chk;
alter table public.task_rules
    add constraint task_rules_end_trigger_chk
    check (end_trigger is null or end_trigger in (
        'check_in', 'after_check_in_24h', 'check_out',
        'days_before_check_in', 'days_after_check_out',
        'arrival_day', 'departure_day'
    ));
