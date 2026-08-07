-- Automationen: Versatz in MINUTEN, STUNDEN oder TAGEN — und die Uhrzeit
-- abschaltbar.
--
-- Bisher war der Versatz fest in Tagen (`offset_days`) und es GAB immer eine
-- Uhrzeit: fehlte `send_time`, rechnete der Planer stillschweigend Mitternacht.
-- „3 Tage vor Anreise" ließ sich damit ausdrücken, „2 Stunden nach Abreise"
-- nicht.
--
-- Neu sind zwei Spalten:
--   * `offset_unit`  — minutes|hours|days. Default 'days', damit jede
--     bestehende Zeile unverändert weiterrechnet.
--   * `offset_value` — der Betrag in dieser Einheit. Wird aus `offset_days`
--     vorbelegt, also ohne Umdeutung des Bestands.
--
-- `offset_days` bleibt bestehen und wird weiter gepflegt (Tage-Regeln
-- schreiben beides). Sie fällt nicht in derselben Migration weg, in der die
-- neue Logik ausgerollt wird: liefe etwas schief, wäre der alte Wert sonst
-- verloren. Das Aufräumen ist ein eigener, späterer Schritt.
--
-- Zur Uhrzeit: `send_time` ist bereits nullable, aber NULL hieß bisher
-- „Mitternacht". Ab jetzt heißt NULL „keine feste Uhrzeit" — bei Tagen wird
-- dann Mitternacht des Ankertags gerechnet (unverändert), bei Minuten/Stunden
-- ist eine Uhrzeit ohnehin sinnlos, weil der Versatz selbst die Zeit bestimmt.

alter table public.message_automation
  add column if not exists offset_unit text not null default 'days',
  add column if not exists offset_value integer not null default 0;

-- Bestand übernehmen: was in Tagen stand, bleibt in Tagen.
update public.message_automation
   set offset_value = offset_days
 where offset_value = 0
   and offset_days <> 0;

-- Nur die drei Einheiten, die der Planer kennt — ein Tippfehler in der Spalte
-- wäre sonst eine Regel, die nie feuert, ohne dass es jemand merkt.
alter table public.message_automation
  drop constraint if exists message_automation_offset_unit_chk;
alter table public.message_automation
  add constraint message_automation_offset_unit_chk
  check (offset_unit in ('minutes', 'hours', 'days'));
