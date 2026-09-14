-- 0665_kontakte_customer_contacts.sql — Ansprechpartner je Kunde (Bereich »kontakte«)
--
-- WARUM: Das alte Taskilo-Werkzeug hängte Ansprechpartner als jsonb-Array
-- `contacts` an die Kundenzeile (`POST /finance/customers/{id}/contact`,
-- docs/buchhaltung/TASKILO-BIBLIOTHEKEN-BACKEND.md Z. 139) — ohne Tabelle,
-- ohne Schlüssel, „Hauptkontakt" wurde im Browser umgeschaltet. Hier bekommt
-- der Ansprechpartner erstmals eine eigene Zeile:
--
--   * `customer_id … on delete cascade`: ein Ansprechpartner existiert nur zu
--     seinem Kunden. `tenant_id` steht ZUSÄTZLICH in der Zeile, damit jeder
--     per-ID-Zugriff über `load_scoped(tenant_id)` läuft (Wurzel 3) und der
--     Service den Kunden aus dem Pfad gegen `customer_id` prüft (Wurzel 9).
--   * Genau EIN Hauptkontakt je Kunde: der Service räumt beim Setzen die alten
--     ab (Wurzel 1), der partielle Unique-Index ist der DB-Backstop gegen
--     Doppelklick und Retry (Wurzel 2).
--
-- Finanz-nahe PII (Wurzel 6): RLS + revoke für anon/authenticated, KEINE
-- Realtime-Publikation. Nur der Server (service_role) liest und schreibt.

create table if not exists public.customer_contacts (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    customer_id  uuid not null references public.customers(id) on delete cascade,
    name         text not null,
    role         text,
    email        text,
    phone        text,
    is_primary   boolean not null default false,
    notes        text,
    created_by   uuid,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index if not exists customer_contacts_tenant_customer_idx
    on public.customer_contacts (tenant_id, customer_id);

-- Backstop: höchstens ein Hauptkontakt je Kunde.
create unique index if not exists customer_contacts_ein_hauptkontakt
    on public.customer_contacts (customer_id)
    where is_primary;

drop trigger if exists trg_customer_contacts_updated on public.customer_contacts;
create trigger trg_customer_contacts_updated
    before update on public.customer_contacts
    for each row execute function public.set_updated_at();

alter table public.customer_contacts enable row level security;

drop policy if exists customer_contacts_tenant on public.customer_contacts;
create policy customer_contacts_tenant on public.customer_contacts
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: der Direktpfad (PostgREST mit anon-Key + JWT) bleibt zu.
revoke select, insert, update, delete on public.customer_contacts from anon, authenticated;
