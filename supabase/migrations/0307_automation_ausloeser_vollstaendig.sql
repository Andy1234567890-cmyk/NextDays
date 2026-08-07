-- 0307_automation_ausloeser_vollstaendig.sql — Auslöser vollständig + widerspruchsfrei
--
-- Zwei Auslöser fehlten: „Nach Anreise" und „Vor Abreise". Damit ließen sich
-- die zwei häufigsten Nachrichten des Aufenthalts nicht bauen — die Begrüßung
-- am Tag nach der Ankunft und die Check-out-Anweisung am Vortag der Abreise.
--
-- Der eigentliche Fehler lag tiefer: der Auslöser war reine BESCHRIFTUNG. Anker
-- (Anreise/Abreise/Buchung) und Richtung (vor/nach) standen zusätzlich als
-- eigene Felder in der Maske, ohne jede Kopplung an den Auslöser. Live
-- vorgefunden (07.08.2026, Beta-Betrieb):
--
--     name = 'Check-out-Anweisungen'
--     trigger = 'before_checkin'      ← die Regel heißt „Vor Anreise"
--     anchor  = 'departure', -1 Tag   ← sie feuert vor der ABREISE
--
-- Die Regel tat also etwas anderes, als ihr Auslöser sagte, und niemand konnte
-- das an der Liste erkennen. Seit dieser Migration ist der Auslöser die Quelle:
-- Anker und Vorzeichen des Versatzes werden daraus ABGELEITET (Wurzel 4 — keine
-- zweite Wahrheit für dieselbe Aussage), und zwei CHECKs halten das durch, auch
-- gegen einen direkten DB-Schreiber.
--
-- Bestand wird NICHT umgedeutet, sondern nach seinem tatsächlichen Verhalten
-- umbenannt: maßgeblich ist, was die Regel wirklich tat (anchor + Vorzeichen),
-- nicht, wie sie hieß. Aus obigem Beispiel wird 'before_checkout'.

-- 1. Auslöser-Katalog um die zwei fehlenden erweitern.
alter table public.message_automation
    drop constraint if exists message_automation_trigger_chk;

alter table public.message_automation
    add constraint message_automation_trigger_chk
    check (trigger in (
        'booking_new',
        'before_checkin', 'after_checkin',
        'before_checkout', 'after_checkout',
        'message_received'
    ));

-- 2. Bestand auf den Auslöser umschreiben, der das bisherige Verhalten trägt.
--    Maßgeblich ist der Versatz, mit dem wirklich gerechnet wird: offset_value
--    (0303), ersatzweise offset_days. 0 zählt als „nach" (am Anreisetag selbst).
update public.message_automation
   set trigger = case
        when anchor = 'booking' then 'booking_new'
        when anchor = 'arrival' and coalesce(offset_value, offset_days, 0) < 0
            then 'before_checkin'
        when anchor = 'arrival' then 'after_checkin'
        when coalesce(offset_value, offset_days, 0) < 0 then 'before_checkout'
        else 'after_checkout'
       end
 where trigger <> 'message_received';

-- Die Tages-Sicht mitziehen: bei Tages-Regeln derselbe Wert wie offset_value,
-- sonst 0 („in Tagen" ist bei Minuten/Stunden keine Aussage). Sonst widerspräche
-- die alte Spalte dem neuen Vorzeichen-CHECK bei Servern, die noch sie lesen.
update public.message_automation
   set offset_days = case when offset_unit = 'days'
                          then coalesce(offset_value, offset_days, 0)
                          else 0 end
 where trigger <> 'message_received';

-- 3. Anker an den Auslöser koppeln. `message_received` hängt an keinem Datum —
--    dort ist der Anker bedeutungslos und wird auf 'arrival' normalisiert,
--    damit nicht jeder Rest-Wert als eigene Bedeutung missverstanden wird.
update public.message_automation
   set anchor = case
        when trigger = 'booking_new' then 'booking'
        when trigger in ('before_checkin', 'after_checkin') then 'arrival'
        when trigger in ('before_checkout', 'after_checkout') then 'departure'
        else 'arrival'
       end;

alter table public.message_automation
    drop constraint if exists message_automation_trigger_anchor_chk;

alter table public.message_automation
    add constraint message_automation_trigger_anchor_chk
    check (
        (trigger = 'booking_new' and anchor = 'booking')
        or (trigger in ('before_checkin', 'after_checkin') and anchor = 'arrival')
        or (trigger in ('before_checkout', 'after_checkout') and anchor = 'departure')
        or (trigger = 'message_received' and anchor = 'arrival')
    );

-- 4. Vorzeichen an die Richtung koppeln: „vor" ist negativ, „nach" ist positiv.
--    Ohne diesen CHECK ließe sich ein 'before_checkin' mit +3 speichern — die
--    Liste zeigte „vor Anreise", gesendet würde drei Tage danach.
alter table public.message_automation
    drop constraint if exists message_automation_offset_richtung_chk;

alter table public.message_automation
    add constraint message_automation_offset_richtung_chk
    check (
        trigger = 'message_received'
        or (trigger in ('before_checkin', 'before_checkout')
            and coalesce(offset_value, 0) <= 0)
        or (trigger in ('booking_new', 'after_checkin', 'after_checkout')
            and coalesce(offset_value, 0) >= 0)
    );

comment on column public.message_automation.trigger is
    'Auslöser = Anker UND Richtung. anchor/Vorzeichen von offset_value werden '
    'daraus abgeleitet (0307), nicht getrennt gepflegt.';
comment on column public.message_automation.anchor is
    'Abgeleitet aus trigger (0307). Nicht eigenständig setzen.';

-- 5. Anstehende Automails aus der Zeit vor dieser Migration verwerfen.
--
-- Sie wurden EINMAL beim Import der Buchung berechnet und danach nie wieder —
-- eine Änderung an der Regel erreichte sie nicht. Live standen deshalb Zeilen
-- an, die zu keiner bestehenden Einstellung mehr passten: „Anreisetag" (0 Tage,
-- 06:00) war als −3 Tage/09:00 eingeplant, und 30 Buchungsbestätigungen für
-- Buchungen aus Februar bis Juni hingen gebündelt auf dem 11.08.2026 09:00 —
-- weil als Buchungszeitpunkt UNSERE created_at diente (Wurzel 5b) und der beim
-- Massenimport für alle derselbe war. Sie wären in einem Rutsch an Gäste
-- gegangen, deren Aufenthalt längst vorbei ist.
--
-- Die Planung baut sie aus den korrigierten Regeln neu auf (`replan_tenant`,
-- stündlicher Worker-Tick); was dabei in der Vergangenheit liegt, wird als
-- 'skipped' vermerkt statt verspätet verschickt.
update public.automation_scheduled_message s
   set status = 'cancelled',
       last_error = 'Neu geplant mit 0307 (Auslöser/Buchungszeitpunkt korrigiert).'
  from public.message_automation a
 where a.id = s.automation_id
   and s.status = 'pending'
   and a.trigger <> 'message_received';
