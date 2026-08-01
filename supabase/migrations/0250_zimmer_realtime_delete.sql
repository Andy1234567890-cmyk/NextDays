-- 0250 — Zimmer-Abo hoert auch das Loeschen
--
-- 0246 hat property_rooms in die Publikation aufgenommen und das select-Grant
-- gesetzt, aber die replica identity auf dem Standard (nur Primaerschluessel)
-- gelassen. Folge: ein DELETE-Event traegt ausser der id KEINE Spalten — der
-- clientseitige Filter `property_id=eq.<id>` kann darauf nicht passen, das
-- Event wird verworfen. INSERT und UPDATE kamen an, DELETE nicht: die
-- Zimmerliste blieb nach dem Loeschen stehen, bis jemand die Seite neu lud.
-- Live nachgestellt am 01.08.2026 (Zaehler blieb auf 2, zweiter Loeschversuch
-- quittierte "Zimmer nicht gefunden" — die Zeile war serverseitig laengst weg).
--
-- replica identity full ist im Projekt der Normalfall fuer jede Tabelle mit
-- gefiltertem Abo (properties, travel_agencies, whatsapp_* u. a.).

begin;

alter table public.property_rooms replica identity full;

commit;
