-- 0559_marktbeobachtung_50km_umstellung.sql — Zelle 0,25 → 0,45 Grad, Feinraster abgelöst
--
-- WAS SICH GEAENDERT HAT (Code, 04.09.2026)
-- =========================================
-- 1) Die Rasterzelle der Marktbeobachtung ist von 0,25 Grad (~28 km) auf
--    0,45 Grad (~50 km) gewachsen. Anlass war die Karte: in Nordjuetland blieben
--    je Zelle nur 15 bis 27 Objekte, nach Teilgebieten aufgeteilt war sie an
--    einzelnen Tagen leer. Entscheidung des Nutzers: „in der Region 50 km alle
--    objekte nur mit preis".
-- 2) Das Feinraster `markt_beobachtung_zelle` (0557) ist damit ABGELOEST. Die
--    Karte zeigt jeden beobachteten Preis als eigenen Punkt (`markt_punkt`,
--    0558) statt Teilgebiets-Mediane ab fuenf Objekten. Der Lauf schreibt die
--    Tabelle nicht mehr, kein Leser fragt sie ab.
--
-- WARUM DER ALTBESTAND GELOESCHT WIRD (bewusst, nicht versehentlich)
-- ==================================================================
-- Eine Zelle ist durch die Koordinate ihrer Mitte benannt. Mit der neuen
-- Kantenlaenge rechnet `Zelle.fuer()` fuer dasselbe Objekt andere Mitten
-- (Stjerneskud: 57.625/10.125 → 57.375/10.125). Die alten Zeilen findet
-- deshalb kein Leser mehr — weder der Preisfaktor noch die Karte. Sie
-- umzurechnen lohnt nicht: es sind Werte von EINEM Tag (Abruf 04.09.2026,
-- 8 Mediane + 11 Teilgebiete), die der naechste Lauf ohnehin frisch holt.
-- Umrechnen hiesse zudem, einen 28-km-Median als 50-km-Median auszugeben —
-- eine Zahl, die etwas anderes misst als sie behauptet (Wurzel 5b).
--
-- GESCOPT, nicht `delete` ohne `where`: nur Zeilen, die VOR dem Umbau
-- abgerufen wurden. Zeilen aus dem neuen Raster (ab 05.09.2026) bleiben.
-- Der Verfall im Lauf (`beobachtung_service._verfallenes_aufraeumen`,
-- 14 Tage) raeumt denselben Bestand als Backstop ab, falls diese Migration
-- spaeter eingespielt wird.

delete from public.markt_beobachtung
 where abgerufen_am < timestamptz '2026-09-05 00:00:00+00';

delete from public.markt_punkt
 where abgerufen_am < timestamptz '2026-09-05 00:00:00+00';

-- Das Feinraster komplett leeren: es hat keinen Leser mehr, und ein Bestand
-- in einer abgeloesten Tabelle liest sich spaeter wie „wird noch benutzt".
delete from public.markt_beobachtung_zelle
 where abgerufen_am < timestamptz '2026-09-05 00:00:00+00';

-- Tabelle und Migration 0557 bleiben stehen (kein Loeschauftrag). Der
-- Kommentar sagt, dass sie abgeloest ist — wer sie findet, soll nicht
-- annehmen, sie sei nur gerade leer.
comment on table public.markt_beobachtung_zelle is
  'ABGELOEST seit 04.09.2026 durch markt_punkt (0558): die Karte zeigt jeden '
  'beobachteten Preis als Punkt statt Teilgebiets-Mediane ab fuenf Objekten. '
  'Grund: in duenn besiedelten Ferienregionen erreichte kaum ein Teilgebiet '
  'die Schwelle, die Karte blieb leer. Wird nicht mehr geschrieben und nicht '
  'mehr gelesen; steht nur noch, weil Tabellen hier nicht eigenmaechtig '
  'geloescht werden.';
