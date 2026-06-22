-- 0036_sandbox_message.sql
-- Lokaler Test-Nachrichtenspeicher für den Sandbox-Posteingang.
--
-- Die echte Channex-Messaging-API (message_threads/messages) ist ein separat
-- freizuschaltendes Add-on (unser Staging-Key bekommt aktuell HTTP 403). Damit
-- der Posteingang-Flow (lesen + senden + KI-Antwort) trotzdem end-to-end testbar
-- ist, speichert der Sandbox-Modus Nachrichten hier lokal statt bei Channex.
--
-- NUR Test: greift ausschließlich, wenn channex_sandbox_portals=true. Im Prod
-- läuft Messaging über Channex; diese Tabelle bleibt dann ungenutzt.
--
-- NextDays-Muster: tenant-scoped, RLS via current_tenant_id(), gen_random_uuid().

create table if not exists public.sandbox_message (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants(id) on delete cascade,
    -- Bezug auf die Buchung (channex_booking.id = unsere Thread-ID).
    thread_id   uuid not null references public.channex_booking(id) on delete cascade,
    sender      text not null default 'guest',  -- guest | property
    message     text not null,
    created_at  timestamptz not null default now()
);

create index if not exists sandbox_message_thread_idx
    on public.sandbox_message(thread_id, created_at);
create index if not exists sandbox_message_tenant_idx
    on public.sandbox_message(tenant_id);

alter table public.sandbox_message enable row level security;

create policy sandbox_message_tenant on public.sandbox_message
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
