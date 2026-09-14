-- 0643_bankumsaetze_import.sql — Bankumsätze per Datei-Import (CSV, CAMT.053, MT940).
--
-- WARUM DATEI-IMPORT UND KEINE BANK-API: myNextDays hat keine finAPI-Zugangs-
-- daten (apps/api/.env.example kennt kein FINAPI_*). Der alte Taskilo-Proxy
-- (`features/finapi`) antwortete ohne Credentials still mit leeren Listen —
-- eine Attrappe, die hier NICHT portiert wird. Stattdessen lädt der Betrieb den
-- Kontoauszug seiner Bank hoch; die Umsätze landen in DIESER Tabelle, und die
-- Oberfläche liest sie unter den alten Pfaden (`/finapi/transactions`,
-- `/finapi/accounts-enhanced`) in derselben Antwortform.
--
-- ZEITPUNKTE (Wurzel 5b): `booking_date`/`value_date` kommen aus der Datei und
-- sind die Fremdereignisse. `created_at` ist nur UNSER Eingang und wird nie als
-- Buchungszeit angezeigt.
--
-- DOPPEL-IMPORT (Wurzel 2): derselbe Auszug wird real zweimal hochgeladen.
-- `import_hash` = sha256 über (Konto, Buchungstag, Betrag, Währung, Gegenpartei,
-- Verwendungszweck, Referenz) ist je Betrieb eindeutig — die zweite Zeile wird
-- als Dublette gezählt, nicht gebucht. Der Unique-Index ist der DB-Backstop.

create table if not exists public.bank_import_batches (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    payment_account_id  uuid not null references public.payment_accounts(id) on delete restrict,
    format              text not null check (format in ('csv', 'camt053', 'mt940')),
    file_name           text not null,
    file_sha256         text not null,
    row_count           integer not null default 0,
    imported_count      integer not null default 0,
    duplicate_count     integer not null default 0,
    error_count         integer not null default 0,
    -- Spaltenzuordnung des CSV-Imports (bei CAMT/MT940 leer), zur Nachvollzieh-
    -- barkeit: welche Spalte wurde als Betrag/Datum/Zweck gelesen.
    column_mapping      jsonb,
    created_by          uuid,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table public.bank_import_batches is
    'Ein Datei-Import von Bankumsätzen (CSV/CAMT.053/MT940) je Zahlungskonto; '
    'zählt gebuchte, doppelte und fehlerhafte Zeilen.';

create index if not exists bank_import_batches_tenant_idx
    on public.bank_import_batches (tenant_id, created_at desc);

create table if not exists public.bank_transactions (
    id                  uuid primary key default gen_random_uuid(),
    tenant_id           uuid not null references public.tenants(id) on delete cascade,
    payment_account_id  uuid not null references public.payment_accounts(id) on delete restrict,
    import_batch_id     uuid references public.bank_import_batches(id) on delete set null,
    -- Fremdereignis-Zeitpunkte aus der Datei (Wurzel 5b).
    booking_date        date not null,
    value_date          date,
    -- Vorzeichen trägt die Richtung: > 0 Eingang, < 0 Ausgang.
    amount              numeric(14,2) not null,
    currency            text not null check (currency ~ '^[A-Z]{3}$'),
    counterpart_name    text,
    counterpart_iban    text,
    counterpart_bic     text,
    purpose             text,
    -- Bank-Referenz (End-to-End-ID, Auszugsnummer, Primanota …), falls die
    -- Datei eine liefert.
    reference           text,
    -- Buchungsart der Bank (SEPA-Code, ZKA/SWIFT-Schlüssel, CAMT BkTxCd), roh.
    transaction_code    text,
    import_hash         text not null,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table public.bank_transactions is
    'Bankumsätze aus Datei-Importen. booking_date/value_date sind die Zeitpunkte '
    'der Bank (Fremdereignis), created_at nur unser Eingang. import_hash je '
    'Betrieb eindeutig — Doppel-Import wird zur Dublette, nicht zur Buchung.';

create unique index if not exists bank_transactions_import_hash_idx
    on public.bank_transactions (tenant_id, import_hash);

create index if not exists bank_transactions_tenant_datum_idx
    on public.bank_transactions (tenant_id, booking_date desc);

create index if not exists bank_transactions_konto_idx
    on public.bank_transactions (payment_account_id, booking_date desc);

drop trigger if exists trg_bank_import_batches_updated on public.bank_import_batches;
create trigger trg_bank_import_batches_updated
    before update on public.bank_import_batches
    for each row execute function public.set_updated_at();

drop trigger if exists trg_bank_transactions_updated on public.bank_transactions;
create trigger trg_bank_transactions_updated
    before update on public.bank_transactions
    for each row execute function public.set_updated_at();

alter table public.bank_import_batches enable row level security;
alter table public.bank_transactions   enable row level security;

drop policy if exists bank_import_batches_tenant on public.bank_import_batches;
create policy bank_import_batches_tenant on public.bank_import_batches
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists bank_transactions_tenant on public.bank_transactions;
create policy bank_transactions_tenant on public.bank_transactions
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Finanzdaten: nur der Server (service_role) liest und schreibt (Wurzel 6).
revoke select, insert, update, delete on public.bank_import_batches from anon, authenticated;
revoke select, insert, update, delete on public.bank_transactions   from anon, authenticated;
