-- 0314 — Automails: die zwei Zustände absichern, die still verhungern lassen.
--
-- Beide Lücken haben dieselbe Form: die DB nimmt einen Wert an, den KEIN
-- Codepfad je wieder anfasst. Die Regel steht danach in der Oberfläche als
-- „aktiv" und sendet nie — der Fehler meldet sich erst beim Gast, der nichts
-- bekommen hat (Wurzel 5: nicht still verschlucken).
--
-- 1) send_time = '24:00'
--    Postgres akzeptiert '24:00' als gültigen `time`-Wert (dokumentierter
--    Sonderfall), Python nicht (`hour must be in 0..23`). Der Planer fängt das
--    inzwischen ab und überspringt die Regel — aber gespeichert wird sie
--    weiterhin als gültig. Vorher riss ein einziger solcher Wert die komplette
--    Neuplanung des Betriebs ab: ALLE Automails blieben stehen.
--
-- 2) status ohne CHECK
--    0072 nannte im Spaltenkommentar pending|sent|failed|skipped|cancelled;
--    der Code nutzt zusätzlich 'sending' (der Claim vor dem Versand) — das ging
--    nur gut, WEIL kein CHECK existierte. Kehrseite: jeder Tippfehler-Status
--    erzeugt eine Zeile, die weder Dispatch ('pending') noch Reaper ('sending')
--    noch die Neuplanung (UEBERSCHREIBBAR) je wieder berührt.
--    Der CHECK schreibt die SECHS real benutzten Zustände fest, inklusive
--    'sending', das damit endlich auch im Schema dokumentiert ist.

-- --- 1) Uhrzeiten -----------------------------------------------------------
-- '24:00' ist der einzige `time`-Wert, den Postgres kennt und Python ablehnt.
alter table public.message_automation
  drop constraint if exists message_automation_send_time_chk;
alter table public.message_automation
  add constraint message_automation_send_time_chk
  check (send_time is null or send_time < time '24:00');

-- Zeitfenster der Abwesenheitsantwort: gleiche Falle, gleiche Grenze.
alter table public.message_automation
  drop constraint if exists message_automation_window_zeit_gueltig_chk;
alter table public.message_automation
  add constraint message_automation_window_zeit_gueltig_chk
  check (
    (window_from is null or window_from < time '24:00')
    and (window_to is null or window_to < time '24:00')
  );

-- --- 2) Zustände ------------------------------------------------------------
alter table public.automation_scheduled_message
  drop constraint if exists automation_scheduled_status_chk;
alter table public.automation_scheduled_message
  add constraint automation_scheduled_status_chk
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled'));

alter table public.inbox_scheduled_message
  drop constraint if exists inbox_scheduled_status_chk;
alter table public.inbox_scheduled_message
  add constraint inbox_scheduled_status_chk
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled'));

-- Kommentare nachziehen: 'sending' fehlte in beiden.
comment on column public.automation_scheduled_message.status is
  'pending | sending | sent | failed | skipped | cancelled. '
  '"sending" ist der atomare Claim vor dem Versand; bleibt eine Zeile darin '
  'haengen (Prozessabbruch), gibt der Reaper sie nach SENDING_REAP_MINUTES frei.';
comment on column public.inbox_scheduled_message.status is
  'pending | sending | sent | failed | skipped | cancelled. '
  '"sending" ist der atomare Claim vor dem Versand.';
