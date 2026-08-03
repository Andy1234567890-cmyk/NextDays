-- 0272_task_regel_engine.sql — Regeln erzeugen endlich Aufgaben
--
-- Seit 0123 gibt es task_rules mit kind='auto'|'recurring', eine Oberfläche zum
-- Anlegen und sogar die Spalte last_materialized_on. Ausgewertet wurde nichts:
-- eine planmäßige oder regelmäßige Aufgabe war eine Karteikarte, die nie eine
-- Aufgabe erzeugt hat. Die einzige Automatik war ein Hardcode-Paar
-- ("Anreise-Check/Inspektion", "Endreinigung") ohne Bezug zu den Regeln.
--
-- Diese Migration liefert die Felder, die eine Regel braucht, um überhaupt
-- auslösen zu können:
--   * WANN relativ zur Buchung (start_trigger/end_trigger + Offset)
--   * WANN nach Kalender (starts_on/ends_on/start_time/duration_minutes)
--   * WAS ist zu tun (template_rule_id → die Checkliste einer Vorlage, statt
--     dieselben Punkte in jeder Regel erneut zu tippen)
-- und die Idempotenz-Backstops, ohne die ein zweiter Tick oder ein Retry die
-- Aufgabe doppelt anlegt (Wurzel 2).

-- =========================================================================
-- task_rules: Trigger, Zeitplan, Vorlagen-Verweis
-- =========================================================================

alter table public.task_rules
    -- Regel → Aufgabenvorlage (beides sind task_rules-Zeilen, die Vorlage hat
    -- kind='template'). NULL = die Regel trägt ihre Punkte selbst.
    add column if not exists template_rule_id      uuid
        references public.task_rules (id) on delete set null,

    -- kind='auto': Anker relativ zur Reservierung.
    add column if not exists start_trigger         text,
    add column if not exists end_trigger           text,
    -- Feinjustierung in Minuten, mit Vorzeichen (−120 = zwei Stunden vorher).
    add column if not exists start_offset_minutes  integer not null default 0,
    add column if not exists end_offset_minutes    integer not null default 0,

    -- kind='recurring': Kalenderfenster + Uhrzeit + Dauer.
    add column if not exists starts_on             date,
    add column if not exists ends_on               date,
    add column if not exists start_time            time,
    add column if not exists duration_minutes      integer;

-- Eine Vorlage darf keine Vorlage referenzieren und sich nicht selbst.
alter table public.task_rules
    drop constraint if exists task_rules_template_ref_chk;
alter table public.task_rules
    add constraint task_rules_template_ref_chk
    check (template_rule_id is null or template_rule_id <> id);

-- Trigger-Werte festgenagelt: ein Tippfehler darf keine Regel erzeugen, die
-- stumm nie auslöst (Wurzel 4 — lieber hart fehlschlagen als ein Fantasiewert).
alter table public.task_rules
    drop constraint if exists task_rules_start_trigger_chk;
alter table public.task_rules
    add constraint task_rules_start_trigger_chk
    check (start_trigger is null or start_trigger in (
        'booking_confirmed',      -- sofort bei Bestätigung der Buchung
        'check_in',               -- zum Check-in der Reservierung
        'after_check_in_24h',     -- Check-in + 24 h, gedeckelt auf den Check-out
        'check_out',              -- zum Check-out
        'days_before_check_in',   -- start_offset_minutes vor dem Check-in
        'days_after_check_out'    -- start_offset_minutes nach dem Check-out
    ));
alter table public.task_rules
    drop constraint if exists task_rules_end_trigger_chk;
alter table public.task_rules
    add constraint task_rules_end_trigger_chk
    check (end_trigger is null or end_trigger in (
        'check_in', 'after_check_in_24h', 'check_out',
        'days_before_check_in', 'days_after_check_out'
    ));

alter table public.task_rules
    drop constraint if exists task_rules_duration_chk;
alter table public.task_rules
    add constraint task_rules_duration_chk
    check (duration_minutes is null or duration_minutes between 1 and 43200);

-- Der Tick sucht die fälligen Regeln: aktiv, nach Art, noch nicht bis heute
-- ausgerollt.
create index if not exists task_rules_materialize_idx
    on public.task_rules (tenant_id, kind, active, last_materialized_on);

-- =========================================================================
-- tasks: Herkunftstermin + Idempotenz
-- =========================================================================

alter table public.tasks
    -- Der Kalendertermin, für den eine wiederkehrende Regel diese Aufgabe
    -- erzeugt hat. Trägt den UNIQUE-Backstop weiter unten.
    add column if not exists occurrence_on date;

-- Wurzel 2: real kommt alles doppelt. Der Reservierungs-Hook feuert bei jedem
-- Update, der Worker-Tick läuft mehrfach, ein Retry wiederholt den Insert.
-- Ohne diese beiden Indizes wächst je Regel und Buchung/Termin ein Stapel
-- identischer Aufgaben. Teil-Indizes, weil manuelle Aufgaben (rule_id is null)
-- beliebig oft dieselbe Kombination haben dürfen.
create unique index if not exists tasks_regel_reservierung_uidx
    on public.tasks (rule_id, reservation_id)
    where rule_id is not null and reservation_id is not null;
create unique index if not exists tasks_regel_termin_uidx
    on public.tasks (rule_id, occurrence_on)
    where rule_id is not null and occurrence_on is not null;

-- =========================================================================
-- checklist_items: Erklärtext je Punkt
-- =========================================================================
-- task_rule_items.description gibt es seit 0125, die materialisierte Checkliste
-- kannte sie nicht — der Erklärtext ging beim Kopieren verloren, genau dort, wo
-- ihn die Reinigungskraft braucht.
alter table public.checklist_items
    add column if not exists description text;

comment on column public.task_rules.template_rule_id is
    'Verweis auf die Aufgabenvorlage (task_rules mit kind=template), deren '
    'Punkte beim Materialisieren nach checklist_items kopiert werden.';
comment on column public.task_rules.start_trigger is
    'Anker der Startzeit relativ zur Reservierung (kind=auto). NULL = die Regel '
    'löst nicht buchungsbezogen aus.';
comment on column public.tasks.occurrence_on is
    'Kalendertermin einer wiederkehrenden Regel. Trägt den Idempotenz-Index, '
    'damit ein zweiter Tick keine zweite Aufgabe erzeugt.';
