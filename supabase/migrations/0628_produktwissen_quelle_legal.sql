-- 0628 — Produktwissen: Quelle 'legal' erlauben, 'preise' entfernen
--
-- WARUM EINE NEUE NUMMER statt 0626 zu ändern: 0626 ist eingespielt. Eine
-- angewendete Migration läuft nie wieder — eine Korrektur dort wäre in der
-- Datei sichtbar und in der Datenbank wirkungslos.
--
-- WAS SICH ÄNDERT:
--
-- `legal` kommt DAZU. Die Rechtsdokumente (Datenschutz, Impressum, AGB, AVV,
-- Cookie-Richtlinie) liegen fertig und in 24 Sprachen vor, und die Fragen
-- daraus kommen VOR dem Kauf: „Ist das DSGVO-konform?", „Wo stehen die
-- Server?", „Gibt es einen AV-Vertrag?". Ohne sie landete jede dieser Fragen
-- im Support, obwohl die Antwort geschrieben und juristisch geprüft dasteht.
-- 72 Abschnitte je Sprache.
--
-- `preise` FÄLLT WEG. Der Wert stand in 0626 als Platzhalter, wurde aber nie
-- benutzt — und darf es auch nicht: die Beträge kommen live aus Stripe in den
-- Prompt (`features/produktwissen/preiskontext.py`), niemals als eingebettetes
-- Wissensstück. Eine eingefrorene Preiskopie ist genau der Fehler, den
-- `marketing/lib/preise.ts` schon einmal begründet ausgeschlossen hat. Der
-- Wert bleibt im CHECK zu lassen hieße, diese Tür offen zu halten, bis jemand
-- sie benutzt.
--
-- Kein Datenumzug nötig: es existiert keine Zeile mit quelle='preise'
-- (geprüft) — der CHECK kann direkt ersetzt werden.

alter table public.produktwissen
    drop constraint if exists produktwissen_quelle_check;

alter table public.produktwissen
    add constraint produktwissen_quelle_check
    check (quelle in ('hilfe', 'funktion', 'faq', 'legal'));

comment on column public.produktwissen.quelle is
    'Woher das Wissensstück stammt. NICHT ''preise'' — Beträge kommen live '
    'aus Stripe in den Prompt, nie als eingebettete Kopie (Wurzel 4).';
