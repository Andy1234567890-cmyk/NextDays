-- Posteingang: WANN wurde ein Thread gelesen?
--
-- `channex_booking.is_read` ist ein reines Handflag: beim Öffnen eines Threads
-- auf true gesetzt, bleibt es dort für immer stehen. Schreibt der Gast danach
-- erneut, gilt der Thread weiter als gelesen — die neue Nachricht fällt
-- niemandem auf. Live gemessen am 07.08.2026: alle 22 Threads is_read = true,
-- während in der Liste bei jedem „Neu" stand (das war der BUCHUNGS-Status).
-- Zusammen ergab das eine Anzeige, die nichts unterschied.
--
-- Mit dem Zeitpunkt lässt sich die Frage beantworten, um die es wirklich geht:
-- gelesen = Flag gesetzt UND seither keine neue Gastnachricht
-- (`portal_messages.sent_at` mit `sender = 'guest'`).
--
-- Kein Backfill mit einem erfundenen Wert: NULL heißt „nie gelesen markiert",
-- und dann gilt weiterhin allein das Flag (Wurzel 4 — kein Ersatzwert, der
-- eine Tatsache behauptet, die wir nicht kennen).

alter table public.channex_booking
  add column if not exists read_at timestamptz;

comment on column public.channex_booking.read_at is
  'Wann der Betrieb diesen Thread zuletzt als gelesen markiert hat. Zusammen '
  'mit is_read und der jüngsten Gastnachricht ergibt sich der echte Lesestand; '
  'NULL = nie markiert, dann zählt allein is_read.';

-- Die Liste fragt „jüngste Gastnachricht je Thread" für bis zu 200 Threads in
-- EINEM Query. Ohne diesen Index wäre das ein Seq-Scan über portal_messages,
-- und zwar bei jedem Laden des Posteingangs.
create index if not exists portal_messages_gast_idx
  on public.portal_messages (tenant_id, thread_ref, sent_at desc)
  where sender = 'guest';
