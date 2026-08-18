-- 0411 — Karenzzeit vor der Auszahlung (Prüffrist nach der Abreise)
--
-- WAS SICH ÄNDERT: Bisher war eine Auszahlung ab dem Checkout fällig (bzw. ab
-- geplanter Abreise + 1 Tag Nachtragefrist). Künftig liegt davor eine KARENZ:
-- eine Frist, in der das Geld noch bei uns liegt, obwohl der Aufenthalt vorbei
-- ist.
--
-- WOFÜR: Mit den separaten Charges (ADR-0018) liegt der volle Buchungsbetrag
-- zwischen Zahlung und Auszahlung auf UNSEREM Saldo — buchhalterisch eine
-- Verbindlichkeit gegenüber dem Betrieb, nur die 8 % sind Ertrag. Genau in
-- diesem Fenster kommen die Ereignisse, die den Betrag noch verändern:
-- Gastbeschwerde, Schadensmeldung, verkürzter Aufenthalt, Chargeback. Ist das
-- Geld schon beim Betrieb, gibt es keinen Weg zurück — Rückforderungen werden
-- ausschliesslich mit der NÄCHSTEN Auszahlung verrechnet, nie eingezogen
-- (Airbnb-Modell, `faelligkeit.verrechne()`). Liegt es noch bei uns, ist die
-- Korrektur eine Buchung statt einer Forderung.
--
-- WARUM DIE SPALTE UND NICHT NUR EINE KONSTANTE: Der Default steht als
-- `KARENZ_TAGE` in `payouts/faelligkeit.py`; geführt wird der Wert je Betrieb,
-- damit eine Sonderkondition (langjähriger Partner, Risikofall) ohne
-- Code-Änderung möglich ist.
--
-- WER SIE SETZT: die PLATTFORM, nicht der Betrieb. Wie `paused` ist die Karenz
-- unser Risikopuffer — der Auszahlungs-Endpunkt des Betriebs
-- (`PUT /payouts/settings`) nimmt weiterhin nur den Rhythmus an. Ein Betrieb,
-- der seine eigene Prüffrist auf 0 stellen könnte, hätte die Frist nicht.
--
-- KEINE RLS-/GRANT-ÄNDERUNG: Spalte an einer bestehenden Tabelle.
-- `payout_settings` ist seit 0217 RLS-geschützt und für anon/authenticated
-- schreibgesperrt (0224 write_lockdown) — genau deshalb ist die Spalte hier
-- sicher, obwohl sie über Geld entscheidet.

alter table public.payout_settings
    add column if not exists karenz_tage smallint not null default 3
        -- Obergrenze wie `KARENZ_TAGE_MAX` im Code. Ohne sie wäre ein
        -- Zahlendreher (300 statt 3) eine Auszahlung, die nie fällig wird —
        -- und niemand sähe einen Fehler, nur ausbleibendes Geld (Wurzel 8).
        constraint payout_settings_karenz_bereich
            check (karenz_tage between 0 and 30);

comment on column public.payout_settings.karenz_tage is
    'Prüffrist in Tagen NACH der Abreise, bevor die Auszahlung fällig wird '
    '(Default 3, siehe KARENZ_TAGE in payouts/faelligkeit.py). Setzt die '
    'Plattform, nicht der Betrieb. Wirkt auf beide Fälligkeitspfade — auch '
    'wenn der Checkout eingetragen ist.';
