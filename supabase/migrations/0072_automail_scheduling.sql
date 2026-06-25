-- 0072_automail_scheduling.sql — Planbare Automails (Zeit + Zuweisung Haus/Kanal)
--
-- Erweitert die bestehende message_automation (0037) um:
--   - send_time:  Uhrzeit des Versands (z. B. 07:45)
--   - anchor:     Bezugsdatum (arrival|departure|booking); offset_days bleibt das
--                 Vorzeichen-behaftete Tagesdelta (−3 = 3 Tage vor, +1 = 1 Tag nach)
--   - property_ids: nur an Gäste dieser Objekte (leer/NULL = alle Objekte)
--   - channels:     nur an diese Buchungskanäle/OTAs (leer/NULL = alle Kanäle)
-- Zuweisung wirkt UND-verknüpft (Objekt UND Kanal müssen passen); leer = alle.
--
-- Neu: automation_scheduled_message — je (Automation, Thread) EINE geplante
-- Automail mit berechnetem send_at. Analog inbox_scheduled_message (0040), aber
-- mit Bezug zur Automation und Dedup-Constraint gegen Doppelversand.

alter table public.message_automation
    add column if not exists send_time time,
    add column if not exists anchor text not null default 'arrival',
    add column if not exists property_ids uuid[],
    add column if not exists channels text[];

-- anchor robust einschränken (idempotent).
do $$
begin
  alter table public.message_automation
    add constraint message_automation_anchor_chk
    check (anchor in ('arrival', 'departure', 'booking'));
exception when duplicate_object then null;
end $$;

create table if not exists public.automation_scheduled_message (
    id            uuid primary key default gen_random_uuid(),
    tenant_id     uuid not null references public.tenants(id) on delete cascade,
    automation_id uuid not null references public.message_automation(id) on delete cascade,
    thread_id     uuid not null references public.channex_booking(id) on delete cascade,
    body          text not null,
    send_at       timestamptz not null,
    status        text not null default 'pending',  -- pending|sent|failed|skipped|cancelled
    last_error    text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- Dedup: pro Automation max. eine geplante Automail je Thread.
create unique index if not exists automation_scheduled_unique
    on public.automation_scheduled_message(automation_id, thread_id);
-- Cron-Abfrage: fällige, noch ausstehende Automails über alle Tenants.
create index if not exists automation_scheduled_due_idx
    on public.automation_scheduled_message(status, send_at);
create index if not exists automation_scheduled_tenant_idx
    on public.automation_scheduled_message(tenant_id);

-- RLS (tenant-scoped, Service-Role schreibt; Lese-Policy für eingeloggte Tenants).
alter table public.automation_scheduled_message enable row level security;
do $$
begin
  create policy automation_scheduled_tenant on public.automation_scheduled_message
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
exception when duplicate_object then null;
end $$;

-- updated_at-Trigger (gleiche Funktion wie übrige Inbox-Tabellen).
do $$
begin
  create trigger trg_automation_scheduled_updated
    before update on public.automation_scheduled_message
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

-- Realtime: Automail-Planung live (Posteingang/Automations-UI ohne Reload).
do $$
begin
  alter publication supabase_realtime add table public.automation_scheduled_message;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.message_automation;
exception when duplicate_object then null;
end $$;
