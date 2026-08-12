-- 0374 — Dritte Herkunft: „Portal-Buchung ohne Aufstellung"
--
-- 0366 kannte zwei Herkünfte: `ota` (das Portal hat gemeldet) und `stammdaten`
-- (aus den Objekt-Gebühren geschätzt, weil der Payload nichts trug). Die zweite
-- war für Portal-Buchungen die falsche Antwort, und sie hat Geld verschoben.
--
-- WAS DER STAMMDATEN-RÜCKFALL ANGERICHTET HAT, live gemessen am 11.08.2026:
--   * cleaning_fee — 191 Posten (186.120 DKK)
--   * resort       — 151 Posten  (20.950 DKK), während die Abrechnung des
--     Betriebs dieselben Buchungen mit 0,00 ausweist
--   * pet_fee      —  73 Posten  (10.950 DKK) bei nur 18 Buchungen mit Tier
-- Jeder dieser Posten floss als Ertrag in die Eigentümer-Auszahlung, ohne dass
-- ihn ein Gast bezahlt hatte. Die Zahlen sahen plausibel aus — das ist der Grund,
-- warum es ein halbes Jahr niemandem auffiel.
--
-- BELEGT AN DEN LIVE-DATEN, dass die Stammdaten nicht die Wahrheit sind:
--   * „FeWo Lille Lægehus" hat Resort 25/Nacht gepflegt. Booking hat sie bei
--     Buchung 5012668004 NICHT erhoben: 1.150 Nächte + 150 Haustier = 1.300 =
--     Gesamtbetrag, exakt aufgegangen.
--   * Der Payload sagt selbst, warum — `rooms[].meta.charge_periods` führt
--     RESORTFEE und CLEANINGFEE erst ab 2026-08-04. Buchungen von vorher haben
--     sie nicht bezahlt.
--
-- DIE NEUE HERKUNFT: `ota_ohne_aufstellung` — Portal-Buchung, deren Payload keine
-- Gebührenaufstellung trägt (die 51 Channex-Importe; Channex sagt in seiner Doku
-- selbst, dass Importe „not include extras and cleaning fees"). Die Gebührenliste
-- ist dann LEER, und das ist eine Aussage, kein Ausfall: nicht gemeldet heißt
-- nicht gezahlt. Die Abrechnung weist die Buchung als solche aus, statt eine Zahl
-- zu zeigen, die niemand nachrechnen kann.
--
-- `stammdaten` BLEIBT und ist weiter richtig — aber nur dort, wo es nie einen
-- Portal-Payload gab: eigene Website, Telefon, Rezeption. Dort hat der Betrieb
-- selbst nach seinen Stammdaten abgerechnet.

alter table public.reservation_portal_finanzen
  drop constraint if exists reservation_portal_finanzen_quelle_check;

alter table public.reservation_portal_finanzen
  add constraint reservation_portal_finanzen_quelle_check
  check (quelle in ('ota', 'ota_ohne_aufstellung', 'stammdaten'));

comment on column public.reservation_portal_finanzen.quelle is
  'ota = aus der Preisaufstellung des Portals (so hat der Gast gezahlt). '
  'ota_ohne_aufstellung = Portal-Buchung, deren Payload keine Aufstellung '
  'trägt (Channex-Importe) — die Gebührenliste ist dann LEER, weil nicht '
  'gemeldet nicht gezahlt heißt. stammdaten = keine Portal-Buchung (eigene '
  'Website, Telefon); dort sind die Objekt-Gebühren die richtige Quelle.';
