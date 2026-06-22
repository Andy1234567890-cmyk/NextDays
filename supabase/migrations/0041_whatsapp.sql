-- 0041_whatsapp.sql
-- WhatsApp-Kanal (Meta WhatsApp Cloud API): bidirektionale Gäste-Kommunikation.
-- Eine Konversation pro (Tenant, Telefonnummer). Nachrichten in beide Richtungen
-- mit Meta-Message-ID + Zustellstatus. Tenant-scoped, RLS via current_tenant_id().

-- 1) whatsapp_conversation — ein Chat je Gast-Telefonnummer.
create table if not exists public.whatsapp_conversation (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants(id) on delete cascade,
    wa_phone      text not null,                 -- E.164 ohne '+', wie von Meta geliefert
    guest_name    text,                          -- Profilname (von Meta), falls vorhanden
    reservation_id uuid references public.reservations(id) on delete set null,
    last_message  text,
    last_at       timestamptz,
    is_read       boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    unique (tenant_id, wa_phone)
);
create index if not exists whatsapp_conversation_tenant_idx
    on public.whatsapp_conversation(tenant_id);

-- 2) whatsapp_message — einzelne Nachrichten (ein/aus).
create table if not exists public.whatsapp_message (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants(id) on delete cascade,
    conversation_id uuid not null references public.whatsapp_conversation(id) on delete cascade,
    direction       text not null,               -- 'in' (Gast) | 'out' (Gastgeber)
    body            text not null,
    wa_message_id   text,                         -- Meta-Message-ID (Idempotenz)
    status          text not null default 'sent', -- sent|delivered|read|failed|received
    last_error      text,
    created_at      timestamptz not null default now()
);
create index if not exists whatsapp_message_conv_idx
    on public.whatsapp_message(conversation_id);
-- Idempotenz beim Webhook-Empfang: gleiche Meta-ID nicht doppelt einfügen.
create unique index if not exists whatsapp_message_waid_uidx
    on public.whatsapp_message(tenant_id, wa_message_id)
    where wa_message_id is not null;

-- updated_at-Trigger
create trigger trg_whatsapp_conversation_updated
    before update on public.whatsapp_conversation
    for each row execute function public.set_updated_at();

-- RLS
alter table public.whatsapp_conversation enable row level security;
alter table public.whatsapp_message      enable row level security;

create policy whatsapp_conversation_tenant on public.whatsapp_conversation
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
create policy whatsapp_message_tenant on public.whatsapp_message
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
