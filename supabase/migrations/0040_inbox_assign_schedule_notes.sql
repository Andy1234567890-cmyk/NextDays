-- 0040_inbox_assign_schedule_notes.sql
-- Posteingang-Erweiterungen: Zuweisung an Benutzer, geplante Nachrichten,
-- interne Notizen im Verlauf (gelb). Tenant-scoped, RLS via current_tenant_id().

-- 1) Zuweisung: Konversation (channex_booking) einem Tenant-Benutzer zuordnen.
alter table public.channex_booking
    add column if not exists assigned_user_id uuid references public.users(id) on delete set null;
create index if not exists channex_booking_assigned_idx
    on public.channex_booking(assigned_user_id);

-- 2) inbox_scheduled_message — manuell geplante Nachrichten (zeitversetzt).
--    status: pending → sent | failed | cancelled. Versand via internem Cron.
create table if not exists public.inbox_scheduled_message (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    thread_id    uuid not null references public.channex_booking(id) on delete cascade,
    body         text not null,
    send_at      timestamptz not null,
    status       text not null default 'pending',  -- pending|sent|failed|cancelled
    last_error   text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists inbox_scheduled_message_tenant_idx
    on public.inbox_scheduled_message(tenant_id);
-- Cron-Abfrage: fällige, noch ausstehende Nachrichten über alle Tenants.
create index if not exists inbox_scheduled_message_due_idx
    on public.inbox_scheduled_message(status, send_at);

-- 3) inbox_thread_note — interne Notizen im Verlauf (gelb, nicht an die OTA).
create table if not exists public.inbox_thread_note (
    id           uuid primary key default gen_random_uuid(),
    tenant_id    uuid not null references public.tenants(id) on delete cascade,
    thread_id    uuid not null references public.channex_booking(id) on delete cascade,
    author_id    uuid references public.users(id) on delete set null,
    body         text not null,
    created_at   timestamptz not null default now()
);
create index if not exists inbox_thread_note_thread_idx
    on public.inbox_thread_note(thread_id);

-- updated_at-Trigger
create trigger trg_inbox_scheduled_message_updated
    before update on public.inbox_scheduled_message
    for each row execute function public.set_updated_at();

-- RLS
alter table public.inbox_scheduled_message enable row level security;
alter table public.inbox_thread_note       enable row level security;

create policy inbox_scheduled_message_tenant on public.inbox_scheduled_message
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
create policy inbox_thread_note_tenant on public.inbox_thread_note
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
