-- 0044_inbox_status.sql
-- Posteingang-Lebenszyklus als EIN Status statt mehrerer Bool-Flags:
--   active   – normaler Posteingang
--   archived – Archiv (aus dem Weg, wiederherstellbar)
--   trashed  – Papierkorb (wiederherstellbar oder endgültig löschen)
--   deleted  – endgültig gelöscht (nur Posteingang-Sicht; Buchung bleibt!)
-- Soft-Delete durchgängig: kein channex_booking-Datensatz wird zerstört, damit
-- die zugehörige Reservierung/Buchung (Kalender) unangetastet bleibt.

alter table public.channex_booking
    add column if not exists inbox_status text not null default 'active';

-- Bestehende Archivierungen aus is_archived übernehmen (Flag bleibt für Kompat.).
update public.channex_booking
    set inbox_status = 'archived'
    where is_archived = true and inbox_status = 'active';

-- Schnelles Filtern nach Status pro Tenant.
create index if not exists channex_booking_inbox_status_idx
    on public.channex_booking(tenant_id, inbox_status);
