-- 0499 — Benachrichtigungs-Kategorie „KI-Eskalation"
--
-- Eine Regel mit `benachrichtigen = true` (0493) meldet — bisher gab es dafür
-- keinen Kanal. Ohne diese Kategorie liefe die Meldung entweder gar nicht oder
-- über eine fremde Kategorie mit, und der Betrieb könnte sie nur zusammen mit
-- etwas anderem abschalten.
--
-- KANÄLE: E-Mail und Push. Kein SMS — dieselbe Abwägung wie bei den anderen
-- Posteingang-Kategorien: eine Beschwerde ist dringend, aber SMS ist für
-- Fristen von Stunden reserviert (`anfrage_offen`), nicht für „ein Gast ist
-- verärgert". Die Glocke läuft ohnehin mit (Kanal.INAPP hat keine Spalte).
--
-- E-MAIL NICHT PFLICHT: anders als bei `anfrage_offen` ist Nichtstun hier
-- keine Entscheidung mit Geldfolge — die Eskalation bleibt im Posteingang
-- sichtbar, auch wenn niemand eine Mail bekommt. Ein Betrieb, der den
-- Posteingang ohnehin den ganzen Tag offen hat, darf den Mail-Kanal abwählen.
--
-- VORGABE TRUE für beide: wer die KI selbständig antworten lässt, will
-- erfahren, wenn sie es NICHT tut. Ein stiller Vorgabewert wäre hier die
-- falsche Richtung — man würde von der ersten Eskalation erst erfahren, wenn
-- man zufällig hinsieht.
--
-- Der Schalter „Benachrichtigung senden" AN DER REGEL entscheidet, OB gemeldet
-- wird; diese Kategorie entscheidet, WIE und an wen. Zwei Ebenen, wie überall
-- sonst im Produkt.

alter table public.notification_settings
    add column if not exists ki_eskalation_email boolean not null default true,
    add column if not exists ki_eskalation_push boolean not null default true;

comment on column public.notification_settings.ki_eskalation_email is
    'Die KI hat einen Thread eskaliert (negative Stimmung oder Eskalationsregel). '
    'Abwählbar: die Eskalation bleibt im Posteingang sichtbar.';
comment on column public.notification_settings.ki_eskalation_push is
    'Dieselbe Meldung als Push auf mobile-nextdays.';
