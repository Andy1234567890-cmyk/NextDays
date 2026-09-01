-- Der FAKTURIERTE Betrag neben dem ENTSTANDENEN (Wurzel 1: Gegenzustand).
--
-- Befund vom 01.09.2026: Für AirSmil entstanden im August 2.580,76 DKK
-- Provision, fakturiert wurden nach dem 250-EUR-Monatsdeckel 1.868,80 DKK.
-- Alle 95 Ledger-Zeilen standen danach auf 'invoiced' und behaupteten damit
-- die volle Summe -- die gedeckelte Differenz von 711,96 DKK hinterliess in
-- der DB KEINE Spur. Wer den Ledger liest, kann nicht sehen, was wirklich
-- berechnet wurde.
--
-- Zusaetzlich fiel auf: die Buchungswaehrung (DKK) und die Abo-Waehrung des
-- Stripe-Kunden (EUR) koennen auseinanderfallen. Ein DKK-Invoice-Item auf
-- einem EUR-Kunden bleibt bei Stripe stumm liegen (invoice: null) und wird
-- NIE fakturiert. Deshalb wird ab 0516 in der Abo-Waehrung fakturiert und
-- hier festgehalten, mit welchem Kurs das geschah.
--
-- billed_amount ist der Anteil DIESER Zeile am tatsaechlich fakturierten
-- Betrag, in billed_currency. Bleibt NULL fuer Altbestand und solange eine
-- Zeile pending ist.
alter table public.commission_ledger
  add column if not exists billed_amount numeric(12,2),
  add column if not exists billed_currency text,
  add column if not exists fx_rate numeric(18,8);

comment on column public.commission_ledger.billed_amount is
  'Anteil dieser Zeile am tatsaechlich fakturierten Betrag (nach Monatsdeckel), in billed_currency. NULL solange pending.';
comment on column public.commission_ledger.billed_currency is
  'Waehrung der Rechnung (= Waehrung des Stripe-Abos). Kann von currency (Buchungswaehrung) abweichen.';
comment on column public.commission_ledger.fx_rate is
  'Kurs currency -> billed_currency am Stichtag (1. des abgerechneten Monats), ECB. 1 wenn gleich.';

alter table public.dynpricing_ledger
  add column if not exists billed_amount numeric(12,2),
  add column if not exists billed_currency text,
  add column if not exists fx_rate numeric(18,8);

comment on column public.dynpricing_ledger.billed_amount is
  'Anteil dieser Zeile am tatsaechlich fakturierten Betrag, in billed_currency. NULL solange pending.';
comment on column public.dynpricing_ledger.billed_currency is
  'Waehrung der Rechnung (= Waehrung des Stripe-Abos).';
comment on column public.dynpricing_ledger.fx_rate is
  'Kurs currency -> billed_currency am Stichtag, ECB. 1 wenn gleich.';
