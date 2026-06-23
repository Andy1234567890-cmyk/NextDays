-- 0045_inbox_assignment_audit.sql
-- Enterprise-Posteingang: Audit der Thread-Zuweisung. Wer hat wann an wen
-- zugewiesen? Spalten auf channex_booking + optionale Historien-Tabelle.
-- Tenant-scoped, RLS via current_tenant_id() (Muster wie 0040).

-- 1) Audit-Spalten direkt am Thread (letzter Zuweisungsvorgang).
alter table public.channex_booking
    add column if not exists assigned_by uuid references public.users(id) on delete set null;
alter table public.channex_booking
    add column if not exists assigned_at timestamptz;

-- 2) inbox_assignment_log — vollständige Zuweisungs-Historie (Audit-Trail).
create table if not exists public.inbox_assignment_log (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    thread_id    uuid not null references public.channex_booking(id) on delete cascade,
    from_user_id uuid references public.users(id) on delete set null,  -- vorher zugewiesen
    to_user_id   uuid references public.users(id) on delete set null,  -- neu zugewiesen (null = aufgehoben)
    by_user_id   uuid references public.users(id) on delete set null,  -- ausführender Nutzer
    created_at   timestamptz not null default now()
);
create index if not exists inbox_assignment_log_thread_idx
    on public.inbox_assignment_log(thread_id);
create index if not exists inbox_assignment_log_tenant_idx
    on public.inbox_assignment_log(tenant_id);

-- RLS
alter table public.inbox_assignment_log enable row level security;

create policy inbox_assignment_log_tenant on public.inbox_assignment_log
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
