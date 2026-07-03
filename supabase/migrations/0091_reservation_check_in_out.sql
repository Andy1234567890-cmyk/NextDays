-- 0091_reservation_check_in_out.sql — echter Check-in/Check-out an der Buchung
--
-- Bisher war „Eingecheckt" nur ein Anzeige-Status, der aus dem Anreisedatum
-- abgeleitet wurde; der Enum-Wert reservation_status 'completed' wurde nie
-- gesetzt. Für das Hotel-/Ferienobjekt-Geschäft braucht es den ECHTEN Zustand:
-- Rechnungen aus Buchungen sind erst nach Check-in erlaubt, und beim Check-out
-- wird verpflichtend die finale Rechnung erzeugt (Service setzt dann zusätzlich
-- status = 'completed' — kein Enum-Umbau nötig, der Wert existiert bereits).
--
-- Zeitstempel statt Enum-Erweiterung: 'wann' ist fachlich relevant (Beleg,
-- Anzeige „Eingecheckt seit …") und die Übergänge bleiben aus den Feldern
-- ableitbar (beide null = vor Anreise, nur checked_in_at = im Haus, beide
-- gesetzt = abgereist).

alter table public.reservations
    add column if not exists checked_in_at  timestamptz,
    add column if not exists checked_out_at timestamptz;

-- „Im Haus"-Lookup (billable-reservations, Dashboards): kleiner Teil-Index
-- statt Vollindex — nur aktuell eingecheckte Buchungen sind heiß.
create index if not exists reservations_in_house_idx
    on public.reservations (tenant_id)
    where checked_in_at is not null and checked_out_at is null;

-- RLS + Realtime für reservations bestehen bereits (0004 / 0048).
