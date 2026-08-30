-- 0497 — Antwortlänge und der zweite Eskalations-Schalter
--
-- ZWEI kleine Ergänzungen, beide aus der Vorlage:
--
-- 1. `inbox_ai_settings.antwortlaenge` — bisher bekam jeder Betrieb dieselbe
--    Antwortlänge. Für ein Hotel mit 120 Zimmern ist eine ausführliche Antwort
--    zu lang, für eine Ferienwohnung mit einem Gast pro Woche ist eine knappe
--    zu abweisend. Die Einstellung wirkt auf ZWEI Dinge: das Token-Budget des
--    Vertex-Aufrufs (300 / 600 / 1200) und eine Zeile im System-Prompt. Nur
--    das Token-Budget zu setzen genügt nicht — das Modell schreibt dann
--    denselben langen Text und bricht mitten im Satz ab.
--
-- 2. `ki_regel.eskalation_posteingang` — bis hierher gab es EIN Feld
--    (`ist_eskalation`) plus `benachrichtigen`. Die Vorlage zeigt ZWEI
--    getrennte Schalter, und das sind fachlich zwei Entscheidungen:
--
--      „Im Posteingang melden"    markiert den Thread sichtbar
--      „Benachrichtigung senden"  schickt zusätzlich E-Mail/Push
--
--    Wer jede Beschwerde als Mail will, ist ein anderer Betrieb als wer sie
--    beim nächsten Blick in den Posteingang sehen will. In einem Feld
--    verschmolzen liesse sich „nur markieren, nicht klingeln" nicht mehr
--    ausdrücken — und das ist der häufigere der beiden Fälle.
--
-- `ist_eskalation` bleibt und behält seine Bedeutung: es sagt, ob die Regel
-- ÜBERHAUPT eskaliert (statt zu antworten). Die zwei neuen Schalter sagen,
-- WIE gemeldet wird. Ohne `ist_eskalation` sind sie wirkungslos.

-- --------------------------------------------------------------------------
-- Antwortlänge
-- --------------------------------------------------------------------------
alter table public.inbox_ai_settings
    add column if not exists antwortlaenge text not null default 'standard';

alter table public.inbox_ai_settings
    drop constraint if exists inbox_ai_settings_antwortlaenge_chk;
alter table public.inbox_ai_settings
    add constraint inbox_ai_settings_antwortlaenge_chk
    check (antwortlaenge in ('kurz', 'standard', 'ausfuehrlich'));

comment on column public.inbox_ai_settings.antwortlaenge is
    'kurz | standard | ausfuehrlich. Wirkt auf MAX_ANTWORT_TOKENS UND auf eine '
    'Zeile im System-Prompt — nur das Token-Budget zu senken bricht den Satz ab.';

-- --------------------------------------------------------------------------
-- Der zweite Eskalations-Schalter
-- --------------------------------------------------------------------------
-- Vorgabe TRUE, nicht false: wer eine Eskalationsregel anlegt, will sie im
-- Posteingang sehen — das ist der Sinn der Regel. Die Benachrichtigung
-- (`benachrichtigen`) bleibt bei false, weil sie hinausgeht und stört.
alter table public.ki_regel
    add column if not exists eskalation_posteingang boolean not null default true;

comment on column public.ki_regel.eskalation_posteingang is
    'Markiert den Thread sichtbar im Posteingang. Getrennt von '
    '`benachrichtigen` (E-Mail/Push), weil „nur markieren" der häufigere Fall ist.';
