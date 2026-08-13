-- Archivierte Buchungen (`reservations.archived_at`)
--
-- WOZU: Im Buchungs-Posteingang stapeln sich Vorgänge, die abgeschlossen sind,
-- aber nicht gelöscht werden dürfen — abgelehnte Anfragen, doppelte Importe,
-- Altbestand aus der Übernahme. Ohne einen Ablage-Zustand bleibt die Liste für
-- immer die Summe aller Vorgänge, und die Arbeit von heute steht zwischen
-- Vorgängen von 2024. Lodgify löst das mit „Archivieren" im Buchungsmenü;
-- genau dieser Zustand fehlte hier.
--
-- WARUM EIN ZEITSTEMPEL UND KEIN BOOLEAN: `archived_at` sagt zusätzlich WANN
-- abgelegt wurde. Ein `archived = true` müsste man später um genau diese Spalte
-- ergänzen, sobald jemand fragt „seit wann liegt das in der Ablage?".
--
-- ABGRENZUNG zum Storno: Archivieren ist eine ANSICHTS-Entscheidung und
-- verändert nichts an der Buchung — kein Statuswechsel, keine Freigabe von
-- Nächten, keine Meldung an die Portale. Eine archivierte Buchung belegt den
-- Kalender weiterhin, wenn sie ihn belegt hat. Wer Nächte freigeben will,
-- storniert (dafür gibt es `cancel` mit Pflicht-Begründung und Audit).
--
-- WARUM KEIN LÖSCHEN: Buchungen sind aufbewahrungspflichtige Geschäftsvorfälle
-- (GoBD). „In den Papierkorb" heisst hier deshalb Ablage, nicht Entfernung.

alter table public.reservations
    add column if not exists archived_at timestamptz;

comment on column public.reservations.archived_at is
    'Wann die Buchung aus der Arbeitsliste in die Ablage gelegt wurde '
    '(NULL = aktiv). Reine Ansichts-Entscheidung: Status, Belegung und '
    'Kalenderwirkung bleiben unverändert — freigegeben wird nur per Storno.';

-- Die Liste filtert „aktiv" (der Normalfall) und „Ablage". Partieller Index auf
-- den seltenen Fall: nur archivierte Zeilen landen im Index, aktive nicht.
create index if not exists reservations_archived_idx
    on public.reservations (tenant_id, archived_at desc)
    where archived_at is not null;
