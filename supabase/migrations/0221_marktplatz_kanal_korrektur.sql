-- Marktplatz-Buchungen tragen den richtigen Kanal.
--
-- PROBLEM: Die Buchungs-Engine schrieb für Buchungen über unseren eigenen
-- Marktplatz `channel = 'direct'` (Kommentar im Code: „eigene Plattform =
-- Direktbuchung"). Das vermischt zwei Dinge, die die Preisliste ausdrücklich
-- trennt:
--
--   * Eigenes myNextDays-Portal  → 8 % all-in (Preisliste §2)
--   * Direktbuchung über die Website des Betriebs → provisionsfrei (§5:
--     „provisionsfreie Direktbuchungen zusätzlich")
--
-- Mit 'direct' entging uns die Provision auf jede Marktplatz-Buchung, und der
-- Betrieb hätte für eine Buchung gehaftet, an der wir verdienen.
--
-- ERKENNUNGSMERKMAL: `ota_name = 'myNextDays'` wird ausschließlich von der
-- Marktplatz-Strecke gesetzt (booking_engine/service.py). Buchungen über die
-- eigene Website des Betriebs tragen dort NULL.
--
-- Der Code schreibt ab sofort 'portal'; diese Migration zieht den Bestand nach.

update public.reservations
   set channel = 'portal'
 where ota_name = 'myNextDays'
   and channel = 'direct';

comment on column public.reservations.channel is
  'Vertriebskanal der Buchung. Bestimmt die Provision (Preisliste §2): '
  'portal = eigenes myNextDays-Portal (8 % all-in, Zahlung über die '
  'Plattform), direct = eigene Buchungsstrecke des Betriebs '
  '(provisionsfrei, Direct Charge), booking/airbnb/vrbo = OTA '
  '(1 % monatlich fakturiert, keine Zahlung über uns).';
