-- 0311_offene_provisionen_auf_0_5_prozent.sql — Altbestand nachziehen
--
-- 0310 hat den geltenden Satz auf einheitlich 0,5 % gestellt, aber bewusst
-- KEINE Daten angefasst. Entscheidung vom 07.08.2026: die zum Umstellungs-
-- zeitpunkt noch OFFENEN Provisionszeilen sollen ebenfalls mit 0,5 % eingezogen
-- werden — ein Betrieb, der am 1. September zahlt, soll nicht den alten Satz
-- für Buchungen tragen, die zum neuen Preis beworben wurden.
--
-- Scope, eng und bewusst:
--   * NUR status='pending'. Zeilen mit status='invoiced' bleiben unangetastet —
--     sie hängen an einem gestellten Stripe-Invoice-Item; sie nachträglich zu
--     halbieren würde Rechnung und Ledger auseinanderlaufen lassen.
--   * NUR rate > 0.005. Zeilen, die schon den neuen Satz tragen, werden nicht
--     ein zweites Mal halbiert (Wurzel 2: die Migration ist idempotent, ein
--     erneuter Lauf ändert nichts).
--   * commission_amount wird aus gross_amount NEU berechnet, nicht halbiert —
--     der Betrag folgt der einen Formel (gross * rate), nicht einer Herleitung
--     aus dem alten Wert.

update public.commission_ledger
   set rate = 0.005,
       commission_amount = round(gross_amount * 0.005, 2)
 where status = 'pending'
   and rate > 0.005;
