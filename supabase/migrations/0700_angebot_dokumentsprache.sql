-- Angebote bekommen eine Dokumentsprache wie Rechnungen (0099).
--
-- Bis zum 14.09.2026 hatte `quotes` keine Sprache: der Spiegel eines
-- Kalender-Angebots (0699) baute seine Positionen in der Gastsprache
-- („1 fast beløb"), die Vorschau beschriftete das Dokument aber in der
-- Oberflächensprache — ein Beleg in zwei Sprachen. Die Sprache steht jetzt am
-- Angebot; Vorschau, PDF und Versand lesen sie von dort.
alter table public.quotes
  add column if not exists language text;

comment on column public.quotes.language is
  'Dokumentsprache des Angebots (ISO 639-1). Aus der Gastsprache des '
  'Kalender-Angebots bzw. der Editor-Auswahl; NULL = Bestand/manuell → de.';
