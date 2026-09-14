-- 0671_kontenplan_booking_accounts.sql — Buchungskonten (Bereich »kontenplan«)
--
-- WARUM: `GET /buchhaltung/booking-accounts/{company}` lieferte seit dem
-- 11.09.2026 eine leere Liste — eine Tabelle gab es nie (die
-- `booking_accounts` aus docs/buchhaltung/TASKILO-BIBLIOTHEKEN-BACKEND.md ist
-- das Live-Schema des ALTEN Werkzeugs). Der alte Frontend-Service
-- (web/services/bookingAccountService.ts) rief PATCH/DELETE dazu ins Leere
-- (TASKILO-ABGLEICH §3d). Hier bekommt der Kontenplan seine Tabelle.
--
-- Was ein Konto trägt:
--   * `number` (Kontonummer im Kontenrahmen des Betriebs) — unique je Tenant:
--     ein zweiter Import oder Doppelklick legt kein Duplikat an (Wurzel 2).
--   * `type` deckungsgleich mit dem Pydantic-Literal in
--     bereiche/kontenplan/schemas.py (Regel „DB-CHECK und Pydantic-Literal
--     deckungsgleich").
--   * `tax_rate` OHNE Default: nur Konten, die ihren Satz im Namen tragen
--     („Erlöse 19 % USt"), bekommen ihn beim Standard-Import; alle anderen
--     bleiben leer (Wurzel 4 — kein erfundener Satz).
--   * `kontenrahmen`/`skr_reference`: aus welchem Standardkontenrahmen das
--     Konto stammt und welche Nummer es dort trägt (für DATEV-Export).
--   * `is_system`: Standardkonten aus dem Import — nicht löschbar (409), nur
--     deaktivierbar. Eigene Konten sind löschbar.
--
-- Finanz-Stammdaten sind server-only (Wurzel 6): RLS + Tenant-Policy UND
-- revoke für anon/authenticated. Nicht in supabase_realtime.

create table if not exists public.booking_accounts (
    id                 uuid primary key default gen_random_uuid(),
    tenant_id          uuid not null references public.tenants(id) on delete cascade,
    number             text not null check (number ~ '^[0-9]{1,10}$'),
    name               text not null check (length(name) between 1 and 200),
    type               text not null
                       check (type in ('INCOME', 'EXPENSE', 'ASSET', 'LIABILITY')),
    tax_rate           numeric(5,2) check (tax_rate is null or tax_rate between 0 and 100),
    kontenrahmen       text check (kontenrahmen is null or kontenrahmen in ('SKR03', 'SKR04')),
    skr_reference      text,
    description        text,
    automatic_booking  boolean not null default false,
    is_system          boolean not null default false,
    active             boolean not null default true,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    constraint booking_accounts_nummer_eindeutig unique (tenant_id, number)
);

comment on table public.booking_accounts is
    'Buchungskonten (Kontenplan) des Betriebs. Standardkonten (is_system) aus '
    'SKR03/SKR04-Import sind nur deaktivierbar; tax_rate ohne Default.';

create index if not exists booking_accounts_tenant_type_idx
    on public.booking_accounts (tenant_id, type, active);

drop trigger if exists trg_booking_accounts_updated on public.booking_accounts;
create trigger trg_booking_accounts_updated
    before update on public.booking_accounts
    for each row execute function public.set_updated_at();

alter table public.booking_accounts enable row level security;

drop policy if exists booking_accounts_tenant on public.booking_accounts;
create policy booking_accounts_tenant on public.booking_accounts
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: Direktpfad (PostgREST mit anon-Key + JWT) bleibt zu.
revoke select, insert, update, delete on public.booking_accounts from anon, authenticated;
