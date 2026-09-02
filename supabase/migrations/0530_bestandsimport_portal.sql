-- 0530 — Bestandsimport: „bereits ueber das Portal da" als eigener Zaehler.
--
-- WARUM: Der CSV-Bestandsimport fand ueber den Bestaetigungscode Buchungen,
-- die der Portal-Feed (Channex) laengst angelegt hatte, und schrieb sie mit
-- seinen zwoelf Spalten komplett um — Quelle `csv:<code>`, Buchungszeitpunkt
-- leer, Preis-Aufstellung (Reinigungs-/Resortgebuehr) weg. Live am
-- 31.08.2026 08:50 in EINEM Upload: 54 Feed-Buchungen des Beta-Betriebs.
-- Sichtbar wurde es erst in der Eigentuemer-Abrechnung („Portal hat keine
-- Gebuehren gemeldet"), obwohl der Payload in `channex_booking.raw` vorlag.
--
-- Ab jetzt laesst der Import solche Zeilen in Ruhe (Riegel in der Projektion
-- UND Vorab-Blick im Import). Damit die Zahl nicht unter „ohne Wirkung"
-- verschwindet, bekommt der Lauf einen eigenen Zaehler: der Betrieb muss
-- sehen, dass diese Zeilen nicht FEHLEN, sondern vollstaendiger dastehen als
-- in seiner Datei (Wurzel 5: kein stilles Ueberspringen).
alter table public.bestandsimport_lauf
  add column if not exists portal integer not null default 0;

comment on column public.bestandsimport_lauf.portal is
  'Zeilen, deren Buchung der Portal-Feed schon angelegt hat (Quelle ist die '
  'Channex-ID, nicht csv:). Bewusst belassen, weil die Datei aermer ist als '
  'der Feed. Getrennt von `uebersprungen`, damit die Zahl sichtbar bleibt.';
