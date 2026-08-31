-- 0515 — „Am Anreisetag" und „Am Abreisetag" als eigene Auslöser.
--
-- WAS FEHLTE
-- ==========
-- Der Katalog kannte nur ABSTÄNDE: vor/nach Anreise, vor/nach Abreise. Der
-- häufigste Fall überhaupt — „am Tag selbst, um 06:00" — hatte keinen eigenen
-- Wert und wurde als Abstand NULL abgelegt:
--
--     Anreisetag          trigger=before_checkin   offset_value=0   06:00
--     Bewertung in Ruhe   trigger=after_checkout   offset_value=0   13:00
--
-- Ein Abstand von null ist kein Abstand. Die Zeile behauptet „vor der Anreise"
-- und meint „an der Anreise"; im Dropdown war der Fall gar nicht wählbar, man
-- musste ihn aus Auslöser + einer 0 zusammensetzen. Dass beide Bestandsregeln
-- ihre wahre Bedeutung im NAMEN tragen („Anreisetag"), ist der Beleg: die
-- Bedeutung musste am Modell vorbei transportiert werden.
--
-- Fachlich sind es zwei verschiedene Dinge, und genau deshalb bekommen sie
-- zwei Werte: „Vor Anreise" ist ein Abstand zu einem Datum, „Am Anreisetag"
-- IST ein Datum. Ein Feld, das mal das eine und mal das andere bedeutet, je
-- nachdem ob eine Null darin steht, ist die Diskrepanz.
--
-- WARUM ECHTE ENUM-WERTE UND KEINE OBERFLÄCHEN-KOMBINATION
-- ========================================================
-- Denkbar wäre gewesen, im Dropdown zwei Einträge zu zeigen, die intern
-- weiterhin `before_checkin`/0 schreiben. Dann stünde in der Datenbank
-- weiterhin etwas anderes, als gemeint ist — und jede spätere Auswertung
-- (Statistik, Export, Fehlersuche) läse den Abstand statt des Ereignisses.
-- Die Entscheidung ist bewusst gefallen: der Auslöser ist die Wahrheit.
--
-- RICHTUNG 0 IST NEU
-- ==================
-- `ANKER_UND_RICHTUNG` kannte bisher nur +1/−1. Die neuen Werte tragen 0:
-- `versatz_normieren` zwingt damit JEDEN hereingereichten Betrag auf null —
-- ein Client, der versehentlich „3" mitschickt, kann den Tag nicht verschieben.
-- Der Versatz ist bei diesen Auslösern kein Eingabefeld mehr, sondern eine
-- Eigenschaft des Auslösers selbst.
--
-- DER BESTAND WIRD MITGEZOGEN (Wurzel 1)
-- ======================================
-- Zwei Zeilen systemweit, beide `offset_unit='days'` und `offset_value=0`,
-- gemessen am 31.08.2026. Sie bekommen die neuen Werte; der SENDEZEITPUNKT
-- ändert sich dabei nicht — 0 bleibt 0, 06:00 bleibt 06:00, 13:00 bleibt
-- 13:00. Nur das Etikett stimmt danach.
--
-- Blieben sie stehen, gäbe es dauerhaft ZWEI Schreibweisen für denselben
-- Sachverhalt, und jeder Lesepfad müsste beide kennen — die Sorte zweiter
-- Wahrheit, die beim nächsten Feature auseinanderläuft.
--
-- Die Bedingung ist eng gefasst: NUR `offset_unit = 'days'`. „0 Minuten nach
-- Abreise" ist etwas anderes als „am Abreisetag um 06:00" — es meint den
-- Abreisezeitpunkt selbst. Solche Zeilen gibt es aktuell nicht, aber die
-- Migration darf sie nicht mitnehmen, falls doch eine entsteht, bevor sie
-- läuft.

-- == 1. Die drei CHECKs, die den Auslöser einschnüren ========================
-- Alle drei müssen ERWEITERT werden, bevor eine Zeile geschrieben wird —
-- sonst wirft jeder Insert 23514.

alter table public.message_automation
  drop constraint if exists message_automation_trigger_chk;

alter table public.message_automation
  add constraint message_automation_trigger_chk check (
    trigger in (
      'booking_new',
      'before_checkin',
      'after_checkin',
      'before_checkout',
      'after_checkout',
      -- Am Tag des Ereignisses, zur festen Uhrzeit. Kein Abstand.
      'on_checkin',
      'on_checkout',
      'message_received'
    )
  );

-- Auslöser und Anker gehören zusammen: bis 0307 waren sie frei kombinierbar,
-- und live stand eine Regel „Vor Anreise" mit anchor='departure' — sie feuerte
-- vor der ABREISE. Die neuen Werte werden hier genauso festgenagelt.
alter table public.message_automation
  drop constraint if exists message_automation_trigger_anchor_chk;

alter table public.message_automation
  add constraint message_automation_trigger_anchor_chk check (
    (trigger = 'booking_new' and anchor = 'booking')
    or (trigger in ('before_checkin', 'after_checkin', 'on_checkin')
        and anchor = 'arrival')
    or (trigger in ('before_checkout', 'after_checkout', 'on_checkout')
        and anchor = 'departure')
    or (trigger = 'message_received' and anchor = 'arrival')
  );

-- Die Richtung des Versatzes. Für die neuen Auslöser ist er GENAU null —
-- nicht „<= 0" und nicht „>= 0": ein Tag ist ein Tag, jede andere Zahl wäre
-- ein Widerspruch zum Auslöser und käme sonst als stille Verschiebung durch.
alter table public.message_automation
  drop constraint if exists message_automation_offset_richtung_chk;

alter table public.message_automation
  add constraint message_automation_offset_richtung_chk check (
    trigger = 'message_received'
    or (trigger in ('before_checkin', 'before_checkout')
        and coalesce(offset_value, 0) <= 0)
    or (trigger in ('booking_new', 'after_checkin', 'after_checkout')
        and coalesce(offset_value, 0) >= 0)
    or (trigger in ('on_checkin', 'on_checkout')
        and coalesce(offset_value, 0) = 0
        and coalesce(offset_days, 0) = 0)
  );

-- == 2. Bestand nachziehen ===================================================
-- Erst JETZT, nachdem die CHECKs die neuen Werte kennen.

update public.message_automation
   set trigger = 'on_checkin'
 where trigger = 'before_checkin'
   and coalesce(offset_value, 0) = 0
   and coalesce(offset_days, 0) = 0
   and coalesce(offset_unit, 'days') = 'days';

update public.message_automation
   set trigger = 'on_checkout'
 where trigger = 'after_checkout'
   and coalesce(offset_value, 0) = 0
   and coalesce(offset_days, 0) = 0
   and coalesce(offset_unit, 'days') = 'days';

-- Auch die Gegenrichtung: „0 nach Anreise" und „0 vor Abreise" meinen
-- dasselbe. Aktuell gibt es keine solche Zeile, aber sie ist erlaubt gewesen
-- und darf nicht als einzige in der alten Schreibweise zurückbleiben.
update public.message_automation
   set trigger = 'on_checkin'
 where trigger = 'after_checkin'
   and coalesce(offset_value, 0) = 0
   and coalesce(offset_days, 0) = 0
   and coalesce(offset_unit, 'days') = 'days';

update public.message_automation
   set trigger = 'on_checkout'
 where trigger = 'before_checkout'
   and coalesce(offset_value, 0) = 0
   and coalesce(offset_days, 0) = 0
   and coalesce(offset_unit, 'days') = 'days';

comment on constraint message_automation_trigger_chk on public.message_automation is
    'Erlaubte Auslöser. Deckungsgleich mit ANKER_UND_RICHTUNG in '
    'inbox/ausloeser.py und AUSLOESER in web/lib/automation-phasen.ts — '
    'alle drei Stellen immer gemeinsam pflegen (0515).';
