-- 0644_zahlungseingaenge_und_verknuepfungen.sql — Zahlungseingänge auf Rechnungen
-- und Verknüpfungen Bankumsatz ↔ Beleg.
--
-- ZWEI TABELLEN, EIN GEGENZUSTAND (Wurzel 1):
--   * invoice_payments   — jede Zahlung auf eine Rechnung (manuell erfasst, aus
--                          einem Bankumsatz oder aus der Kasse). Ihre Summe
--                          bestimmt `invoices.paid_amount`/`paid_at`/`status`
--                          ('paid', sobald die Summe den Bruttobetrag erreicht
--                          oder ein Differenzgrund die Restsumme erklärt).
--                          Eine Rückbuchung (delete) setzt den Status auf den
--                          in `invoice_status_before` gesicherten Wert zurück.
--   * transaction_links  — die Zuordnung eines Bankumsatzes zu GENAU EINEM Beleg
--                          (Rechnung | Ausgabe | Kassenbuch-Eintrag). Die alte
--                          Antwortform (transactionData/documentData/…) bleibt,
--                          damit `services/transaction-link.service.ts` und
--                          `SelectBankingTransactionModal.tsx` ohne Umbau
--                          weiterlaufen. Die id ist wie alt `<tx>_<doc>` —
--                          das Frontend rechnet sie für DELETE/PATCH selbst.
--
-- Rechnungsspalten, gegen die hier geschrieben wird (0023): status text,
-- paid_amount numeric(12,2), paid_at timestamptz, gross_amount, currency.
--
-- `expense_id` und `cashbook_entry_id` sind hier OHNE Fremdschlüssel: die
-- Ausgaben-Tabelle entsteht in einem parallelen Bereich (eigene Nummer), die
-- Kassenbuch-Tabelle erst in 0645. Der FK auf cashbook_entries wird in 0645
-- nachgezogen; der FK auf expenses gehört in die Migration des Ausgaben-
-- Bereichs, sobald seine Tabelle steht (im Bericht angefordert).

create table if not exists public.invoice_payments (
    id                     uuid primary key default gen_random_uuid(),
    tenant_id              uuid not null references public.tenants(id) on delete cascade,
    invoice_id             uuid not null references public.invoices(id) on delete cascade,
    -- Tag der Zahlung (Fremdereignis: Wertstellung/Buchungstag der Bank oder
    -- der vom Nutzer erfasste Zahltag), nie created_at.
    date                   date not null,
    amount                 numeric(14,2) not null check (amount <> 0),
    currency               text not null check (currency ~ '^[A-Z]{3}$'),
    method                 text not null
                           check (method in ('bank_transfer', 'cash', 'card', 'paypal',
                                             'stripe', 'other')),
    payment_account_id     uuid references public.payment_accounts(id) on delete set null,
    transaction_id         uuid references public.bank_transactions(id) on delete set null,
    cashbook_entry_id      uuid,
    note                   text,
    -- Status der Rechnung VOR dieser Zahlung — der Gegenzustand für die
    -- Rückbuchung (Wurzel 1).
    invoice_status_before  text not null,
    created_by             uuid,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);

comment on table public.invoice_payments is
    'Zahlungen auf Rechnungen. Summe je Rechnung schreibt invoices.paid_amount/'
    'paid_at/status; invoice_status_before sichert den Zustand für die Rückbuchung.';

create index if not exists invoice_payments_invoice_idx
    on public.invoice_payments (invoice_id);
create index if not exists invoice_payments_tenant_datum_idx
    on public.invoice_payments (tenant_id, date desc);
-- Ein Bankumsatz zahlt dieselbe Rechnung nur einmal (Wurzel 2: Doppelklick auf
-- „Verknüpfen" darf keine zweite Zahlung buchen).
create unique index if not exists invoice_payments_tx_invoice_idx
    on public.invoice_payments (transaction_id, invoice_id)
    where transaction_id is not null;

create table if not exists public.transaction_links (
    -- Wie alt: '<transaction_id>_<document_id>' — Unique je Kombination.
    id                        text primary key,
    tenant_id                 uuid not null references public.tenants(id) on delete cascade,
    transaction_id            uuid not null references public.bank_transactions(id) on delete cascade,
    document_type             text not null
                              check (document_type in ('beleg', 'rechnung', 'gutschrift',
                                                       'INVOICE', 'EXPENSE', 'kassenbuch')),
    -- Genau EINE der drei Beleg-Referenzen ist gesetzt.
    invoice_id                uuid references public.invoices(id) on delete cascade,
    expense_id                uuid,
    cashbook_entry_id         uuid,
    amount_allocated          numeric(14,2) not null,
    -- Alte Antwortform (1:1 für den Bestand):
    document_number           text not null default '',
    document_date             date,
    document_amount           numeric(14,2) not null default 0,
    customer_name             text not null default '',
    link_date                 timestamptz not null default now(),
    created_by                text not null default '',
    booking_status            text not null default 'booked'
                              check (booking_status in ('open', 'booked')),
    booked_at                 timestamptz,
    amount_difference         numeric(14,2),
    amount_difference_reason  text,
    booking_account           jsonb,
    transaction_data          jsonb not null default '{}'::jsonb,
    document_data             jsonb not null default '{}'::jsonb,
    -- Die Zahlung, die diese Verknüpfung auf der Rechnung gebucht hat — bei
    -- DELETE wird sie zurückgebucht (Gegenzustand).
    invoice_payment_id        uuid references public.invoice_payments(id) on delete set null,
    created_at                timestamptz not null default now(),
    updated_at                timestamptz not null default now(),
    constraint transaction_links_ein_beleg check (
        (invoice_id is not null)::int
        + (expense_id is not null)::int
        + (cashbook_entry_id is not null)::int = 1
    )
);

comment on table public.transaction_links is
    'Zuordnung Bankumsatz ↔ Beleg (Rechnung | Ausgabe | Kassenbuch). id wie alt '
    '<tx>_<doc>. Bei Rechnungen hängt die gebuchte Zahlung (invoice_payment_id) '
    'dran und wird beim Lösen zurückgebucht.';

create index if not exists transaction_links_tenant_idx
    on public.transaction_links (tenant_id, link_date desc);
create index if not exists transaction_links_tx_idx
    on public.transaction_links (transaction_id);
create index if not exists transaction_links_invoice_idx
    on public.transaction_links (invoice_id) where invoice_id is not null;
create unique index if not exists transaction_links_tx_beleg_idx
    on public.transaction_links (
        transaction_id,
        coalesce(invoice_id, expense_id, cashbook_entry_id)
    );

drop trigger if exists trg_invoice_payments_updated on public.invoice_payments;
create trigger trg_invoice_payments_updated
    before update on public.invoice_payments
    for each row execute function public.set_updated_at();

drop trigger if exists trg_transaction_links_updated on public.transaction_links;
create trigger trg_transaction_links_updated
    before update on public.transaction_links
    for each row execute function public.set_updated_at();

alter table public.invoice_payments  enable row level security;
alter table public.transaction_links enable row level security;

drop policy if exists invoice_payments_tenant on public.invoice_payments;
create policy invoice_payments_tenant on public.invoice_payments
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists transaction_links_tenant on public.transaction_links;
create policy transaction_links_tenant on public.transaction_links
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Finanzdaten: nur der Server (Wurzel 6).
revoke select, insert, update, delete on public.invoice_payments  from anon, authenticated;
revoke select, insert, update, delete on public.transaction_links from anon, authenticated;
