-- Angebot als Aufenthaltsangebot (Hotel/FeWo) statt Handelsbeleg.
--
-- Ein Buchungsangebot gehört zu EINEM Objekt (Bild, Check-in-Zeiten,
-- Stornobedingungen, Hausregeln kommen von dort) und nennt, was jetzt zu
-- zahlen ist (Anzahlung). Beides hatte `quotes` nicht — der Spiegel eines
-- Kalender-Angebots (0699) verlor Objekt und Anzahlung, das PDF konnte weder
-- Bild noch Zahlungsplan zeigen.
alter table public.quotes
  add column if not exists property_id uuid references public.properties (id) on delete set null,
  add column if not exists deposit_amount numeric(12, 2);

create index if not exists quotes_property_idx on public.quotes (property_id);

comment on column public.quotes.property_id is
  'Objekt des Aufenthaltsangebots (Bild, Zeiten, Storno, Hausregeln); NULL = Beleg ohne Objektbezug.';
comment on column public.quotes.deposit_amount is
  'Anzahlung, die der Gast bei Annahme zahlt (Belegwährung). NULL = Gesamtbetrag sofort fällig.';
