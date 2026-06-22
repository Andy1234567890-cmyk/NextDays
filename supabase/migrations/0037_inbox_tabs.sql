-- 0037_inbox_tabs.sql
-- Posteingang-Erweiterungen: Nachrichten-Vorlagen, KI-Einstellungen,
-- Automatisierungen. Tenant-scoped, RLS via current_tenant_id().

-- 1) message_template — wiederverwendbare Antwort-Vorlagen.
create table if not exists public.message_template (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants(id) on delete cascade,
    title       text not null,
    body        text not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index if not exists message_template_tenant_idx
    on public.message_template(tenant_id);

-- 2) inbox_ai_settings — KI-Antwort-Konfiguration pro Tenant (1 Zeile).
create table if not exists public.inbox_ai_settings (
    tenant_id     uuid primary key references public.tenants(id) on delete cascade,
    tone          text not null default 'freundlich',   -- freundlich|formell|locker
    language      text not null default 'auto',          -- auto|de|en|…
    signature     text,                                  -- Grußformel/Name
    extra_prompt  text,                                  -- zusätzliche Anweisung
    auto_suggest  boolean not null default true,         -- Vorschlag automatisch
    updated_at    timestamptz not null default now()
);

-- 3) message_automation — regelbasierte Auto-Nachrichten.
create table if not exists public.message_automation (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants(id) on delete cascade,
    name          text not null,
    trigger       text not null,            -- booking_new|before_checkin|after_checkout
    offset_days   integer not null default 0,  -- Tage relativ zum Trigger
    template_id   uuid references public.message_template(id) on delete set null,
    message       text,                     -- Inline-Text (falls keine Vorlage)
    is_active     boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists message_automation_tenant_idx
    on public.message_automation(tenant_id);

-- updated_at-Trigger
create trigger trg_message_template_updated
    before update on public.message_template
    for each row execute function public.set_updated_at();
create trigger trg_inbox_ai_settings_updated
    before update on public.inbox_ai_settings
    for each row execute function public.set_updated_at();
create trigger trg_message_automation_updated
    before update on public.message_automation
    for each row execute function public.set_updated_at();

-- RLS
alter table public.message_template   enable row level security;
alter table public.inbox_ai_settings  enable row level security;
alter table public.message_automation enable row level security;

create policy message_template_tenant on public.message_template
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
create policy inbox_ai_settings_tenant on public.inbox_ai_settings
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
create policy message_automation_tenant on public.message_automation
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
