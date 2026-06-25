-- 0078_reservation_currency_nullable.sql — reservations.currency darf NULL sein
--
-- Bisher war currency NOT NULL ohne Default. Hat ein Objekt keine Währung
-- hinterlegt (kein rate_plan), wurde ein leerer String '' gespeichert → in der
-- UI „220" ohne Währung. Richtig ist: keine Währung = NULL (kein erfundener
-- €-Fallback, 27 EU-Länder/Mehrwährung). Die UI zeigt dann den nackten Betrag.
-- Leere Strings werden zu NULL normalisiert.

alter table public.reservations alter column currency drop not null;

update public.reservations set currency = null where currency = '';
