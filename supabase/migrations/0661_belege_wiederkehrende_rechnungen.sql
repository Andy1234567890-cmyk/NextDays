-- 0661_belege_wiederkehrende_rechnungen.sql — wiederkehrende Rechnungen (Bereich »belege«)
--
-- WARUM: Das alte `recurring_invoices/repository.py` filterte `invoices` auf
-- `is_recurring_template` und `recurring_status` — beide Spalten gab es im
-- Schema nie (docs/buchhaltung/TASKILO-BIBLIOTHEKEN-BACKEND.md, „Beobachtete
-- Abweichungen"): das Feature lief ins Leere. Hier bekommen die Vorlagen ihre
-- Spalten, wieder in `invoices` (kein Nebenmodell für denselben Beleg):
--
--   * Eine VORLAGE ist eine `invoices`-Zeile mit `invoice_type = 'recurring'`
--     und `is_recurring_template = true`. Sie trägt NIE eine Nummer und bleibt
--     `draft` (also änderbar) — sie ist kein Steuerbeleg, sondern die Schablone.
--   * Jeder LAUF erzeugt eine gewöhnliche Rechnung (`invoice_type='invoice'`,
--     `status='draft'`, ohne Nummer — die GoBD-Nummer zieht erst die
--     Finalisierung) mit `recurring_template_id` auf die Vorlage und
--     `recurring_period_start` = Fälligkeitstag, der abgearbeitet wurde.
--   * Idempotenz (Wurzel 2): UNIQUE (recurring_template_id, recurring_period_start)
--     — ein zweiter Lauf am selben Tag, ein Retry oder zwei Worker parallel
--     erzeugen keine zweite Entwurfsrechnung für dieselbe Periode. Der Service
--     fängt 23505 und zählt „übersprungen".
--   * `recurring_next_at` ist der nächste Fälligkeitstag; der Lauf rückt ihn
--     um das Intervall vor (nachholend, gedeckelt). `recurring_end_at` beendet
--     die Vorlage (`completed`).
--
-- Intervall- und Statuswerte deckungsgleich mit den Literalen in
-- apps/api/src/features/buchhaltung/bereiche/belege/schemas.py
-- (Regel „DB-CHECK und Pydantic-Literal deckungsgleich").

alter table public.invoices
    add column if not exists is_recurring_template boolean not null default false,
    add column if not exists recurring_interval text,
    add column if not exists recurring_status text,
    add column if not exists recurring_start_at date,
    add column if not exists recurring_next_at date,
    add column if not exists recurring_end_at date,
    add column if not exists recurring_template_id uuid
        references public.invoices(id) on delete set null,
    add column if not exists recurring_period_start date;

alter table public.invoices
    drop constraint if exists invoices_recurring_interval_check;
alter table public.invoices
    add constraint invoices_recurring_interval_check
    check (recurring_interval is null
           or recurring_interval in ('weekly', 'monthly', 'quarterly', 'yearly'));

alter table public.invoices
    drop constraint if exists invoices_recurring_status_check;
alter table public.invoices
    add constraint invoices_recurring_status_check
    check (recurring_status is null
           or recurring_status in ('active', 'paused', 'completed'));

-- Eine Vorlage ist nur mit Intervall, Status und nächstem Termin vollständig;
-- eine Nicht-Vorlage trägt keines dieser Felder (kein halber Zustand).
alter table public.invoices
    drop constraint if exists invoices_recurring_vorlage_check;
alter table public.invoices
    add constraint invoices_recurring_vorlage_check
    check (
        (is_recurring_template
            and invoice_type = 'recurring'
            and recurring_interval is not null
            and recurring_status is not null
            and recurring_next_at is not null
            and invoice_number is null)
        or
        (not is_recurring_template
            and recurring_interval is null
            and recurring_status is null
            and recurring_next_at is null)
    );

-- Ein Lauf-Ergebnis kennt seine Vorlage UND seine Periode — oder keines von beiden.
alter table public.invoices
    drop constraint if exists invoices_recurring_lauf_check;
alter table public.invoices
    add constraint invoices_recurring_lauf_check
    check ((recurring_template_id is null) = (recurring_period_start is null));

-- Wurzel 2: eine Rechnung je Vorlage und Periode.
create unique index if not exists invoices_recurring_lauf_uidx
    on public.invoices (recurring_template_id, recurring_period_start)
    where recurring_template_id is not null and deleted_at is null;

-- Der Lauf fragt: alle aktiven Vorlagen des Tenants mit Termin <= heute.
create index if not exists invoices_recurring_faellig_idx
    on public.invoices (tenant_id, recurring_next_at)
    where is_recurring_template and recurring_status = 'active' and deleted_at is null;
