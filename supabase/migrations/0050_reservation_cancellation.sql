-- 0050_reservation_cancellation.sql
-- Storno einer Reservierung MIT Pflicht-Begründung und Audit-Dokumentation.
-- Gilt kanal-agnostisch: Direkt, eigene Plattform (plattform/) und alle 45+
-- Channex-OTAs (Booking.com, Airbnb, Expedia, Agoda, …). Eine lokale Storno
-- hebt eine OTA-Buchung NICHT beim Portal auf — der Hinweis dazu erfolgt im UI.
-- Muster wie inbox_assignment_log (0045): denormalisierte Felder am Datensatz +
-- eigene append-only Audit-Tabelle.

-- ---------------------------------------------------------------------------
-- 1) reservations: Storno-Felder (wer/wann/warum), nullable.
-- ---------------------------------------------------------------------------
alter table public.reservations
    add column if not exists cancel_reason text,
    add column if not exists cancelled_by  uuid references public.users(id) on delete set null,
    add column if not exists cancelled_at  timestamptz;

-- ---------------------------------------------------------------------------
-- 2) reservation_cancellation_log: append-only Audit-Historie.
--    Jede Storno (auch wiederholte/korrigierte) hinterlässt eine Zeile.
-- ---------------------------------------------------------------------------
create table if not exists public.reservation_cancellation_log (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants(id) on delete cascade,
    reservation_id uuid not null references public.reservations(id) on delete cascade,
    by_user_id     uuid references public.users(id) on delete set null,
    reason         text not null,                 -- Pflicht-Begründung
    channel        text,                           -- Kanal der Buchung (Doku)
    ota_name       text,                           -- echtes Portal (bei OTA)
    created_at     timestamptz not null default now()
);
create index if not exists reservation_cancellation_log_res_idx
    on public.reservation_cancellation_log(tenant_id, reservation_id);

-- ---------------------------------------------------------------------------
-- RLS — tenant-scoped (Muster 0023/0046).
-- ---------------------------------------------------------------------------
alter table public.reservation_cancellation_log enable row level security;

create policy reservation_cancellation_log_tenant on public.reservation_cancellation_log
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
