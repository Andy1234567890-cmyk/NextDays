-- 0675_steuer_tax_returns.sql — eingefrorene Umsatzsteuer-Meldungen (Bereich »steuer«)
--
-- WARUM EINE TABELLE UND KEIN LIVE-BERICHT:
-- Die Auswertung `GET /tax/vat-return?period=…` rechnet jederzeit live aus
-- `invoices` und `expenses`. Eine abgegebene Meldung ist aber eine TATSACHE zum
-- Abgabezeitpunkt: kommt später eine Storno-Rechnung für den Juli, ändert sich
-- die Live-Zahl, die gemeldete nicht. Deshalb friert `POST /tax/vat-return/freeze`
-- die Werte als jsonb ein (`values`), samt Land und Währung, mit denen gerechnet
-- wurde. Eine Korrektur ist eine NEUE Version derselben Periode (`version`+1),
-- die alte bekommt `status = 'corrected'` — nichts wird überschrieben.
--
--   * unique (tenant_id, period, version): Doppelklick/Retry auf „Einfrieren"
--     legt keine zweite Version an (Wurzel 2; der Service gibt die vorhandene
--     Entwurfs-Version mit identischen Werten zurück, sonst 409).
--   * `period` ist der normalisierte Schlüssel: `2026-08` (Monat), `2026-Q3`
--     (Quartal), `2026` (Jahr). Der Zeitraum steht zusätzlich als
--     `period_start`/`period_end`, damit SQL-Auswertungen nicht parsen müssen.
--   * `country` (ISO-3166-1 alpha-2) und `currency` (ISO-4217) kommen aus
--     `tenants` — NOT NULL OHNE Default: fehlt eine, schlägt das Einfrieren mit
--     422 fehl (Wurzel 4). Nie „EUR" raten, 27 Länder.
--   * `values` trägt die länderneutralen Zeilen (Summen je Steuersatz und
--     Kategorie), `mapping` das Kennzahlen-Mapping des Landes (bei DE: Kz 81/86/
--     66/83 aus de_ustva.py) — beides eingefroren, damit ein später geändertes
--     Mapping die Historie nicht umdeutet.
--   * Status deckungsgleich mit dem Pydantic-Literal in
--     apps/api/src/features/buchhaltung/bereiche/steuer/schemas.py
--     (Regel „DB-CHECK und Pydantic-Literal deckungsgleich").
--   * KEINE ELSTER-Übertragung: es gibt kein Zertifikat und kein ERiC. Die
--     Meldung wird als JSON/CSV exportiert und von Hand eingereicht;
--     `submitted_at` setzt der Nutzer, wenn er es getan hat.
--
-- Finanzdaten sind server-only (Wurzel 6): RLS + revoke für anon/authenticated,
-- KEINE Realtime-Publikation.

create table if not exists public.tax_returns (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants(id) on delete cascade,
    kind            text not null default 'vat'
                    check (kind in ('vat')),
    period          text not null,
    period_kind     text not null
                    check (period_kind in ('month', 'quarter', 'year')),
    period_start    date not null,
    period_end      date not null,
    version         integer not null default 1 check (version >= 1),
    status          text not null default 'draft'
                    check (status in ('draft', 'submitted', 'corrected')),
    country         text not null,
    currency        text not null,
    small_business  boolean not null default false,
    values          jsonb not null,
    mapping         jsonb not null default '{}'::jsonb,
    sales_net_total numeric(14,2) not null,
    sales_tax_total numeric(14,2) not null,
    input_tax_total numeric(14,2) not null,
    payable         numeric(14,2) not null,
    submitted_at    timestamptz,
    note            text,
    created_by      uuid,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint tax_returns_periode_version_eindeutig unique (tenant_id, kind, period, version),
    constraint tax_returns_zeitraum_gueltig check (period_end >= period_start)
);

create index if not exists tax_returns_tenant_period_idx
    on public.tax_returns (tenant_id, period_start desc, version desc);

drop trigger if exists trg_tax_returns_updated on public.tax_returns;
create trigger trg_tax_returns_updated
    before update on public.tax_returns
    for each row execute function public.set_updated_at();

alter table public.tax_returns enable row level security;

drop policy if exists tax_returns_tenant on public.tax_returns;
create policy tax_returns_tenant on public.tax_returns
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: der Direktpfad (PostgREST mit anon-Key + JWT) bleibt zu. Nur der
-- Server (service_role) liest und schreibt Steuermeldungen.
revoke select, insert, update, delete on public.tax_returns from anon, authenticated;
