-- „Angelegt" und „aktualisiert" getrennt zaehlen.
--
-- WARUM: `bestandsimport_lauf` fuehrte nur `angelegt`, und der Import zaehlte
-- dort alles hinein, was geschrieben wurde — die Projektion
-- (`_project_booking_to_reservation`) liefert True fuer angelegt UND
-- aktualisiert. Nach dem zweiten Upload derselben Datei stand im
-- Fortschritts-Fenster „251 angelegt, 0 vorhanden".
--
-- Das ist genau die Zahl, an der ein Betrieb ablesen will, ob ein
-- Wiederholungs-Upload etwas verdoppelt hat — und sie behauptete das
-- Gegenteil. Nachgemessen war die DB in Ordnung (259 Zeilen, 259 verschiedene
-- `source_channex_booking_id`, keine fachlichen Duplikate): es war allein die
-- Anzeige. Eine Kennzahl, die das Gegenteil ihrer Lage meldet, ist so schlimm
-- wie ein verschluckter Fehler (Wurzel 5).
alter table public.bestandsimport_lauf
  add column if not exists aktualisiert integer not null default 0;

comment on column public.bestandsimport_lauf.aktualisiert is
  'Zeilen, die eine SCHON VORHANDENE Buchung aktualisiert haben (Dedup ueber '
  'source_channex_booking_id). Getrennt von `angelegt`, damit ein zweiter '
  'Upload sichtbar „0 neu, n aktualisiert" meldet statt faelschlich „n neu".';
