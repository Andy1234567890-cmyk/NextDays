-- 0099: Rechnungssprache = Gastsprache.
--
-- Beim Erzeugen einer Rechnung aus einer Buchung (Check-out / Vorab-Rechnung)
-- werden die Belegtexte (Positions-Labels, head_text) in der Korrespondenz-
-- sprache des Gastes (reservations.guest_language) erzeugt. Die Sprache wird
-- am Beleg gespeichert, damit die PDF-Darstellung (Beschriftungen, Datums-
-- format) und der Versand-Dialog dieselbe Sprache vorbelegen.
--
-- NULL = Bestand bzw. manuell erstellte Rechnung ohne Sprachangabe → Anzeige
-- fällt auf Deutsch (Betreibersprache) zurück.

alter table public.invoices
  add column if not exists language text;

comment on column public.invoices.language is
  'Dokumentsprache des Belegs (ISO 639-1, z. B. de/en/it). Aus der Gast-'
  'sprache der Buchung übernommen; NULL = Bestand/manuell → de.';
