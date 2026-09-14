-- 0656_ausgaben_expenses.sql — Ausgaben/Eingangsbelege (Bereich »ausgaben«)
--
-- WARUM: Das alte Taskilo-Werkzeug hatte eine `expenses`-Tabelle mit
-- `amount_cents`, `tax_rate default 19.00`, `USING (true)`-RLS und ohne
-- Beleg-Datei im eigenen Speicher (nur eine `receipt_url` ins Blaue). Hier
-- entsteht die Tabelle neu, mit den Regeln auf dem Server:
--
--   * Beträge als numeric(12,2): `net_amount + tax_amount = gross_amount`
--     wird per CHECK erzwungen. Der Service rechnet aus Brutto + Steuersatz
--     (oder Netto + Steuersatz); der Client liefert nie alle drei als
--     Wahrheit.
--   * `tax_rate` NOT NULL OHNE Default — 27 EU-Länder, kein 19 (Wurzel 4).
--   * `currency` NOT NULL OHNE Default: aus dem Body, sonst aus `tenants`.
--     Fehlt beides, 422 (Wurzel 4).
--   * Kategorie doppelt: `category_id` (FK, `on delete set null`) UND
--     `category_name` als Schnappschuss. Der Schnappschuss bleibt lesbar,
--     wenn die Kategorie gelöscht/umbenannt wird — ein GoBD-Beleg darf sich
--     nicht rückwirkend ändern, nur weil eine Stammdaten-Zeile weg ist. Ein
--     XRechnung-Import bringt nur einen Namen ("Sonstiges") mit, kein FK.
--   * Wiederkehrend: `is_recurring` + `recurring_interval` + `next_due_date`
--     an der VORLAGE. Der Lauf `POST /expenses/recurring/run` erzeugt je
--     fälligem Termin EINE Kopie mit `template_id` = Vorlage und
--     `expense_date` = Fälligkeit. `unique (tenant_id, template_id,
--     expense_date)` fängt Doppel-Läufe (Retry, zwei Worker, Doppelklick —
--     Wurzel 2). Eine erzeugte Kopie ist selbst nie wiederkehrend
--     (CHECK), sonst vervielfältigt sie sich beim nächsten Lauf.
--   * Beleg-Datei im PRIVATEN Bucket `ausgaben-belege` (0657): nur Pfad,
--     Name, MIME, Größe. Zugriff ausschließlich über signierte URLs vom
--     Server. `ocr_raw` = die ungefilterte Antwort des Belegauslesers (jsonb),
--     damit ein falsch übernommener Wert nachvollziehbar bleibt.
--   * GoBD: `is_locked` — gesperrte Belege lassen sich nicht mehr löschen und
--     ihre Fach-Felder (Beträge, Datum, Lieferant, Belegnummer, Währung,
--     Steuersatz) nicht mehr ändern. Der Trigger `expenses_gobd_sperre`
--     erzwingt das auch gegen den DB-Direktpfad; der Service prüft es vorher
--     mit klarer 409-Meldung. Zahlstatus/Notizen/Kategorie bleiben änderbar.
--   * `payment_status` deckungsgleich mit dem Pydantic-Literal in
--     bereiche/ausgaben/schemas.py: open | paid | cancelled.
--
-- Nachzug aus 0644: `invoice_payments.expense_id` und
-- `transaction_links.expense_id` waren dort ohne FK angelegt („gehört in die
-- Migration des Ausgaben-Bereichs, sobald seine Tabelle steht"). Hier
-- nachgezogen, `on delete set null`, `not valid` + `validate` in zwei
-- Schritten, damit ein Altbestand mit fremden Werten die Migration nicht
-- kippt, sondern sichtbar beim Validieren scheitert.
--
-- Finanzdaten sind server-only (Wurzel 6): RLS + revoke, KEINE Realtime.

create table if not exists public.expenses (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    -- Lieferant = Kunde mit is_supplier (0023). Optional: ein Tankbeleg hat
    -- keine Lieferanten-Akte.
    supplier_id         uuid references public.customers(id) on delete set null,
    supplier_name       text,
    supplier_address    text,
    supplier_vat_id     text,
    supplier_email      text,
    supplier_phone      text,
    title               text not null check (length(btrim(title)) between 1 and 200),
    description         text,
    receipt_number      text,
    expense_date        date not null,
    due_date            date,
    payment_terms       text,
    net_amount          numeric(12,2) not null,
    tax_amount          numeric(12,2) not null,
    gross_amount        numeric(12,2) not null,
    tax_rate            numeric(5,2)  not null check (tax_rate >= 0 and tax_rate <= 100),
    currency            text not null check (currency ~ '^[A-Z]{3}$'),
    tax_deductible      boolean,
    category_id         uuid references public.expense_categories(id) on delete set null,
    category_name       text,
    booking_account     text,
    cost_center         text,
    payment_status      text not null default 'open'
                        check (payment_status in ('open', 'paid', 'cancelled')),
    payment_method      text,
    paid_at             date,
    is_recurring        boolean not null default false,
    recurring_interval  text
                        check (recurring_interval is null or recurring_interval in
                               ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    next_due_date       date,
    template_id         uuid references public.expenses(id) on delete set null,
    receipt_path        text,
    receipt_filename    text,
    receipt_mime        text,
    receipt_size_bytes  integer,
    ocr_raw             jsonb,
    is_locked           boolean not null default false,
    locked_at           timestamptz,
    notes               text,
    source              text not null default 'manual'
                        check (source in ('manual', 'xrechnung', 'ocr', 'recurring')),
    created_by          uuid,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    constraint expenses_summe_stimmt
        check (net_amount + tax_amount = gross_amount),
    constraint expenses_wiederkehrend_vollstaendig
        check (not is_recurring or (recurring_interval is not null and next_due_date is not null)),
    constraint expenses_kopie_nie_vorlage
        check (template_id is null or not is_recurring),
    constraint expenses_lauf_eindeutig unique (tenant_id, template_id, expense_date)
);

create index if not exists expenses_tenant_datum_idx
    on public.expenses (tenant_id, expense_date desc);
create index if not exists expenses_tenant_status_idx
    on public.expenses (tenant_id, payment_status);
create index if not exists expenses_tenant_kategorie_idx
    on public.expenses (tenant_id, category_id);
create index if not exists expenses_faellige_vorlagen_idx
    on public.expenses (tenant_id, next_due_date)
    where is_recurring;

drop trigger if exists trg_expenses_updated on public.expenses;
create trigger trg_expenses_updated
    before update on public.expenses
    for each row execute function public.set_updated_at();

-- GoBD-Sperre auf DB-Ebene. Vergleich mit `is distinct from`, damit NULL
-- korrekt behandelt wird; KEIN coalesce auf Enum-/Check-Spalten (Lehre aus
-- 0418→0424: ein Trigger, der beim Auswerten seiner Bedingung wirft, killt
-- jede Änderung an der Tabelle).
create or replace function public.expenses_gobd_sperre()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if old.is_locked then
        if tg_op = 'DELETE' then
            raise exception 'Ausgabe % ist GoBD-gesperrt und kann nicht gelöscht werden.', old.id
                using errcode = 'check_violation';
        end if;
        if new.is_locked is distinct from true then
            raise exception 'Die GoBD-Sperre der Ausgabe % kann nicht aufgehoben werden.', old.id
                using errcode = 'check_violation';
        end if;
        if new.net_amount     is distinct from old.net_amount
        or new.tax_amount     is distinct from old.tax_amount
        or new.gross_amount   is distinct from old.gross_amount
        or new.tax_rate       is distinct from old.tax_rate
        or new.currency       is distinct from old.currency
        or new.expense_date   is distinct from old.expense_date
        or new.receipt_number is distinct from old.receipt_number
        or new.supplier_name  is distinct from old.supplier_name
        or new.supplier_id    is distinct from old.supplier_id
        or new.receipt_path   is distinct from old.receipt_path
        or new.title          is distinct from old.title then
            raise exception 'Ausgabe % ist GoBD-gesperrt: Beleg-Fachdaten sind unveränderlich.', old.id
                using errcode = 'check_violation';
        end if;
    end if;
    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

revoke execute on function public.expenses_gobd_sperre() from anon, authenticated, public;

drop trigger if exists trg_expenses_gobd_sperre on public.expenses;
create trigger trg_expenses_gobd_sperre
    before update or delete on public.expenses
    for each row execute function public.expenses_gobd_sperre();

alter table public.expenses enable row level security;

drop policy if exists expenses_tenant on public.expenses;
create policy expenses_tenant on public.expenses
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: Direktpfad zu. Nur der Server (service_role) liest und schreibt.
revoke select, insert, update, delete on public.expenses from anon, authenticated;

-- --------------------------------------------------------------------------
-- Nachzug der FKs aus 0644 (Zahlungen/Verknüpfungen → Ausgabe)
-- --------------------------------------------------------------------------
do $$
begin
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'invoice_payments'
                 and column_name = 'expense_id')
       and not exists (select 1 from pg_constraint
                       where conname = 'invoice_payments_expense_fk') then
        alter table public.invoice_payments
            add constraint invoice_payments_expense_fk
            foreign key (expense_id) references public.expenses(id) on delete set null
            not valid;
        alter table public.invoice_payments validate constraint invoice_payments_expense_fk;
    end if;
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'transaction_links'
                 and column_name = 'expense_id')
       and not exists (select 1 from pg_constraint
                       where conname = 'transaction_links_expense_fk') then
        alter table public.transaction_links
            add constraint transaction_links_expense_fk
            foreign key (expense_id) references public.expenses(id) on delete set null
            not valid;
        alter table public.transaction_links validate constraint transaction_links_expense_fk;
    end if;
end $$;
