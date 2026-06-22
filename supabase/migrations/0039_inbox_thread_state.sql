-- 0039_inbox_thread_state.sql
-- Posteingang: Lese-/Archiv-Status + Erinnerung pro Konversation (Thread).
-- Interne Gastgeber-Hilfen (nicht an die OTA übertragen).

alter table public.channex_booking
    add column if not exists is_read boolean not null default true;
alter table public.channex_booking
    add column if not exists is_archived boolean not null default false;
alter table public.channex_booking
    add column if not exists remind_at timestamptz;
