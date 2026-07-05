-- 0111_partial_refund_status.sql — Teilerstattung als eigener Status
--
-- BUG (Loop-Fund): charge.refunded (Webhook) und refund_payment setzen die
-- Reservierung/Zahlung IMMER auf 'refunded' — auch bei TEILerstattungen (Stripe
-- feuert charge.refunded auch dann). Eine 10-€-Teilerstattung auf eine 200-€-
-- Buchung markierte die ganze Buchung als erstattet.
--
-- FIX: neuer Enum-Wert 'partially_refunded' für beide payment_status-Typen.
-- ALTER TYPE ... ADD VALUE ist ab PG 12 auch in einer Transaktion erlaubt,
-- SOLANGE der neue Wert nicht in derselben Transaktion VERWENDET wird — hier
-- wird er nur angelegt (die Nutzung erfolgt im App-Code), also unkritisch.

alter type public.reservation_payment_status add value if not exists 'partially_refunded';
alter type public.payment_status add value if not exists 'partially_refunded';
