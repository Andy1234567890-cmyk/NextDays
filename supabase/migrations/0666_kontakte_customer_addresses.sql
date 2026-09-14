-- 0666_kontakte_customer_addresses.sql — Liefer-/Rechnungsadressen je Kunde (Bereich »kontakte«)
--
-- WARUM: `customers.address` (0023, jsonb) ist die EINE Stammanschrift und
-- bleibt es — sie steht auf dem Beleg. Das alte Werkzeug legte weitere
-- Anschriften als jsonb-Array `addresses` in dieselbe Kundenzeile
-- (`POST /finance/customers/{id}/address`), und „Standard" wurde im Browser
-- umgeschaltet. Hier bekommt jede weitere Anschrift eine eigene Zeile mit Art:
--
--   * `type` deckungsgleich mit dem Pydantic-Literal in
--     apps/api/src/features/buchhaltung/bereiche/kontakte/schemas.py
--     (Regel „DB-CHECK und Pydantic-Literal deckungsgleich").
--   * `country` ist ISO-3166-1 alpha-2 und Pflicht: eine Anschrift ohne Land
--     ist für eine Lieferung oder einen Beleg unbrauchbar, ein erfundenes
--     Land (Wurzel 4) wäre schlimmer als ein 422.
--   * Genau EINE Standardanschrift je Kunde UND Art: der Service räumt beim
--     Setzen die alte ab (Wurzel 1), der partielle Unique-Index fängt
--     Doppelklick und Retry (Wurzel 2).
--
-- PII (Wurzel 6): RLS + revoke für anon/authenticated, KEINE Realtime-Publikation.

create table if not exists public.customer_addresses (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants(id) on delete cascade,
    customer_id   uuid not null references public.customers(id) on delete cascade,
    type          text not null check (type in ('billing', 'shipping', 'other')),
    label         text,
    recipient     text,
    street        text,
    house_number  text,
    postal_code   text,
    city          text,
    country       text not null check (country ~ '^[A-Z]{2}$'),
    is_default    boolean not null default false,
    created_by    uuid,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists customer_addresses_tenant_customer_idx
    on public.customer_addresses (tenant_id, customer_id);

-- Backstop: höchstens eine Standardanschrift je Kunde und Art.
create unique index if not exists customer_addresses_ein_standard_je_art
    on public.customer_addresses (customer_id, type)
    where is_default;

drop trigger if exists trg_customer_addresses_updated on public.customer_addresses;
create trigger trg_customer_addresses_updated
    before update on public.customer_addresses
    for each row execute function public.set_updated_at();

alter table public.customer_addresses enable row level security;

drop policy if exists customer_addresses_tenant on public.customer_addresses;
create policy customer_addresses_tenant on public.customer_addresses
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: der Direktpfad (PostgREST mit anon-Key + JWT) bleibt zu.
revoke select, insert, update, delete on public.customer_addresses from anon, authenticated;
