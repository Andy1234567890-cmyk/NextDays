-- 0337 — availability.block_request_id: welcher Sperrantrag diese Nacht sperrt.
--
-- DAS PROBLEM (Wurzel 1 — der Gegenzustand riss zu viel auf):
-- `CalendarService._unblock` loescht ALLES mit `status='blocked' AND
-- source='manual'` im Zeitraum. Eine von der AGENTUR manuell gesetzte Sperre
-- (Renovierung, Eigenbedarf des Betriebs) traegt exakt dieselbe Signatur wie
-- eine aus einem genehmigten Eigentuemer-Antrag. Ablauf, der dabei Geld kostet:
--
--   1. Agentur sperrt das Objekt 1.–20. wegen Handwerkern (manual).
--   2. Ein Eigentuemer beantragt 5.–7.; die Agentur genehmigt (auch manual).
--   3. Der Antrag wird spaeter widerrufen → `_unblock` loescht 5.–7.
--   4. Die HANDWERKER-Sperre fuer 5.–7. ist mit weg, das Objekt geht ueber
--      Channex wieder als verfuegbar an die Portale und ist buchbar.
--
-- Der EXCLUDE-Constraint aus 0333 faengt das nicht: er sichert nur, dass nicht
-- ZWEI genehmigte Antraege ueberlappen. Auf der Gegenseite steht hier gar kein
-- Antrag, sondern eine gewoehnliche Betriebssperre.
--
-- DIE LOESUNG: Die Nacht traegt, WER sie gesperrt hat. Ein Widerruf loescht dann
-- gezielt nur die Zeilen SEINES Antrags; alles ohne Antragsbezug (die
-- Agentur-Sperre) bleibt unangetastet. Das ist der schmalste Eingriff mit dem
-- ehrlichsten Datenmodell — die Alternative (Vorher-Zustand beim Genehmigen
-- sichern und beim Widerruf differenziell zurueckspielen) braeuchte eine
-- zweite Tabelle als Schattenkopie und liefe bei jeder Aenderung dazwischen
-- (neue Buchung, zweite Sperre) auseinander.
--
-- NULL ist der Normalfall und KEIN Datenloch: der ganze Altbestand und jede
-- Agentur-Sperre haben keinen Antrag. Genau darum ist die Spalte nullable.

alter table public.availability
  add column if not exists block_request_id uuid
    references public.block_requests(id) on delete set null;

comment on column public.availability.block_request_id is
  'Genehmigter Sperrantrag (block_requests), der diese Nacht gesperrt hat. '
  'NULL = Sperre ohne Antragsbezug (Agentur-Sperre, Altbestand). Der Widerruf '
  'einer Genehmigung loescht NUR Zeilen mit passender ID — sonst riss er '
  'fremde Sperren im selben Zeitraum mit auf (Wurzel 1).';

-- Der Widerruf filtert genau hierauf. Partiell, weil die weit ueberwiegende
-- Mehrheit der Zeilen NULL traegt und nicht in den Index gehoert.
create index if not exists availability_block_request_idx
  on public.availability (block_request_id)
  where block_request_id is not null;

-- Wurzel 6 — der DB-Direktpfad: `availability` ist bereits ueber die
-- bestehenden Grants/Policies geregelt (lesen erlaubt, schreiben nur
-- service_role). Die neue Spalte traegt eine Antrags-ID, keine Begruendung und
-- keinen Finanzwert; `block_requests` selbst bleibt fuer `authenticated`
-- gesperrt (0332), sodass aus der ID nichts abzuleiten ist. Es wird deshalb
-- KEIN zusaetzliches Grant vergeben und keins entzogen — eine Spalte, die
-- niemandem neue Rechte gibt.
