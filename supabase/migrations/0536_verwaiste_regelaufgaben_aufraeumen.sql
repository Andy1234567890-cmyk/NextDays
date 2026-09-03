-- Offene Aufgaben ohne Regel wegräumen (Altbestand, 03.09.2026).
--
-- WARUM SIE EXISTIEREN: `tasks.rule_id` steht auf `on delete set null`. Wer
-- eine planmäßige Regel löschte, liess ihre Aufgaben zurück — ohne Herkunft,
-- ohne Weg sie loszuwerden, und ohne dass irgendwo etwas darauf hinwies. Der
-- Nachzug legt sie nicht neu an (die Regel ist ja weg), also blieben sie
-- einfach stehen.
--
-- SICHTBAR WURDE ES als Dopplung: eine Regel wurde umgebaut, indem man sie
-- löschte und neu anlegte. Danach stand jede Anreise ZWEIMAL im Kalender —
-- einmal aus der alten, einmal aus der neuen Regel. Gemeldet wurde es nicht
-- vom System, sondern vom Auge: „warum sind die jetzt doppelt?".
--
-- Der Code-Gegenzustand steckt jetzt in `TasksService.delete_rule`; diese
-- Migration räumt auf, was vorher entstanden ist.
--
-- WAS BLEIBT:
--   * ERLEDIGTE Aufgaben (`done`) — sie belegen geleistete Arbeit, hängen an
--     Kosten und Fotos. Sie zu löschen wäre Geschichtsfälschung.
--   * Aufgaben IN ARBEIT (`in_progress`) — dort ist gerade jemand dran.
--     Entscheidung des Betriebs vom 03.09.2026: die eine laufende bleibt.
--   * Aufgaben, die NIE aus einer Regel kamen (`source <> 'auto'`) — von Hand
--     angelegte haben ohnehin keine `rule_id` und sind hier nicht gemeint.

-- Sicherungskopie VOR dem Löschen. Keine temporäre Tabelle: wer in zwei Wochen
-- fragt „was wurde da entfernt?", soll eine Antwort bekommen.
create table if not exists public.tasks_verwaist_0536 as
select * from public.tasks
 where rule_id is null
   and source = 'auto'
   and status = 'open';

-- Nur der Server sieht die Sicherung (Wurzel 6): sie trägt dieselben Gast- und
-- Objektbezüge wie `tasks` und hat in keiner Client-Rolle etwas zu suchen.
alter table public.tasks_verwaist_0536 enable row level security;
revoke all on public.tasks_verwaist_0536 from anon, authenticated;

delete from public.tasks
 where rule_id is null
   and source = 'auto'
   and status = 'open';
