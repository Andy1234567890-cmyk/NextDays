-- 0038_inbox_thread_flags.sql
-- Posteingang: Favorit-Markierung + interne Notiz pro Konversation (Thread).
-- Ein Thread = eine OTA-Buchung (channex_booking). Beide Felder sind interne
-- Hilfen für den Gastgeber (nicht an die OTA übertragen).

alter table public.channex_booking
    add column if not exists is_starred boolean not null default false;
alter table public.channex_booking
    add column if not exists note text;
