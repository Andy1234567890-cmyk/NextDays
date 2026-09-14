-- 0672_kontenplan_cost_centers.sql — Kostenstellen (Bereich »kontenplan«)
--
-- WARUM: Das alte Werkzeug zeigte Kostenstellen (components/accounting/
-- CostCentersTab.tsx: Nummer, Name, Beschreibung, aktiv), speicherte sie aber
-- nirgends serverseitig. Ausgaben und Belege sollen sich künftig einer
-- Kostenstelle zuordnen lassen (z. B. je Objekt/Gebäude) — dafür braucht es
-- eine Tabelle mit eindeutiger Nummer je Tenant (Wurzel 2: Doppelklick legt
-- keine zweite an).
--
-- Finanz-Stammdaten sind server-only (Wurzel 6): RLS + Tenant-Policy UND
-- revoke für anon/authenticated. Nicht in supabase_realtime.

create table if not exists public.cost_centers (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    number       text not null check (length(number) between 1 and 20),
    name         text not null check (length(name) between 1 and 200),
    description  text,
    -- Optional an ein Objekt geheftet (Kostenstelle je Ferienobjekt/Zimmertyp).
    property_id  uuid references public.properties(id) on delete set null,
    active       boolean not null default true,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    constraint cost_centers_nummer_eindeutig unique (tenant_id, number)
);

comment on table public.cost_centers is
    'Kostenstellen des Betriebs (Nummer je Tenant eindeutig), optional an ein '
    'Objekt geheftet.';

create index if not exists cost_centers_tenant_idx
    on public.cost_centers (tenant_id, active);

drop trigger if exists trg_cost_centers_updated on public.cost_centers;
create trigger trg_cost_centers_updated
    before update on public.cost_centers
    for each row execute function public.set_updated_at();

alter table public.cost_centers enable row level security;

drop policy if exists cost_centers_tenant on public.cost_centers;
create policy cost_centers_tenant on public.cost_centers
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.cost_centers from anon, authenticated;
